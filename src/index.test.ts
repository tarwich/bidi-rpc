import 'jest-extended';
import 'jest-json';
import { AsyncIterableSink, ISocket, makeSocketRpc } from './index';
import { JsonRpcMessage } from './jsonrpc';

interface ISocketPrivate extends ISocket {
  listeners: Record<string, ((arg: any) => void)[]>;
}

const MockWebSocket = jest.fn(() => ({
  readyState: 1,
  listeners: {} as Record<string, ((arg: any) => void)[]>,
  addEventListener: jest.fn(function (this: ISocketPrivate, type, listener) {
    this.listeners[type] = this.listeners[type] || [];
    this.listeners[type].push(listener);
  }),
  send: jest.fn(),
  emit: jest.fn(function (this: ISocketPrivate, type, data) {
    const listeners: ((arg: any) => void)[] = this.listeners[type] || [];
    listeners.forEach((listener) => listener(data));
  }),
}));

describe('SocketRPC', () => {
  const setupSocket = () => new MockWebSocket();

  let server: ReturnType<typeof MockWebSocket>;
  let client: ReturnType<typeof MockWebSocket>;

  beforeEach(() => {
    server = setupSocket();
    client = setupSocket();

    server.send.mockImplementation(
      (data) => void client.emit('message', { data })
    );
    client.send.mockImplementation(
      (data) => void server.emit('message', { data })
    );
  });

  it('should send messages', async () => {
    const clientRpc = makeSocketRpc<{ foo(m: string): void }>(client);
    makeSocketRpc(server, { foo: () => '' });
    await clientRpc.foo('bar');

    expect(client.send).toHaveBeenCalledWith(
      expect.jsonMatching({
        jsonrpc: '2.0',
        id: expect.any(String),
        method: 'foo',
        params: [{ type: 'string', value: '"bar"' }],
      })
    );
  }, 1000);

  // --> {"jsonrpc": "2.0", "method": "subtract", "params": [42, 23], "id": 1}
  // <-- {"jsonrpc": "2.0", "result": 19, "id": 1}
  it('should subtract', async () => {
    makeSocketRpc(server, { subtract: (a: number, b: number) => a - b });
    const result = await makeSocketRpc<{
      subtract: (a: number, b: number) => number;
    }>(client).subtract(42, 23);

    expect(result).toBe(19);
  }, 100);

  // --> {"jsonrpc": "2.0", "method": "subtract", "params": [23, 42], "id": 2}
  // <-- {"jsonrpc": "2.0", "result": -19, "id": 2}
  it('should subtract inverse', async () => {
    makeSocketRpc(server, { subtract: (a: number, b: number) => a - b });
    const result = await makeSocketRpc<{
      subtract: (a: number, b: number) => number;
    }>(client).subtract(23, 42);

    expect(result).toBe(-19);
  });

  it('should reject on error', async () => {
    makeSocketRpc(server, {
      test: () => {
        throw new Error('test');
      },
    });
    const result = makeSocketRpc<{ test(): void }>(client).test();

    expect(result).rejects.toMatchObject({
      code: -32603,
      message: 'Unexpected error',
    });
  });

  it("should be able to wrap a socket that's already opened", async () => {
    makeSocketRpc(client, { foo: () => 'bar' });
    const serverRpc = makeSocketRpc<{ foo(): string }>(server);

    await serverRpc.foo();

    expect(server.send).toHaveBeenCalled();
  }, 200);

  it('Should fail when run on sockets that are closed', async () => {
    const client = new MockWebSocket();
    const server = new MockWebSocket();
    server.readyState = 3; // CLOSED

    makeSocketRpc(client);
    const serverRpc = makeSocketRpc<{ foo(): string }>(server);

    const call = serverRpc.foo();
    await expect(call).rejects.toThrowError('Socket is closed');

    {
      server.readyState = 2; // CLOSING
      const call = serverRpc.foo();

      await expect(call).rejects.toThrowError('Socket is closed');
    }
  });

  it('Should fail when run on sockets that are closing', async () => {
    const client = new MockWebSocket();
    const server = new MockWebSocket();
    server.readyState = 2; // CLOSING

    makeSocketRpc(client);
    const serverRpc = makeSocketRpc<{ foo(): string }>(server);

    const call = serverRpc.foo();
    await expect(call).rejects.toThrowError('Socket is closed');
  });

  it('Should wait for sockets that are connecting', async () => {
    server.readyState = 0; // CONNECTING

    makeSocketRpc(client, { foo: () => 'bar' });
    const serverRpc = makeSocketRpc<{ foo(): string }>(server);

    let resolved = false;
    const call = serverRpc.foo().then((result) => {
      resolved = true;
      return result;
    });
    expect(resolved).toBe(false);
    server.emit('open', null);
    await expect(call).resolves.toBe('bar');
  }, 500);

  it('should ignore messages with the wrong jsonrpc version', async () => {
    const handlers = {
      foo: jest.fn().mockReturnValue('bar'),
    };
    makeSocketRpc(server, handlers);
    const clientRpc = makeSocketRpc<{ foo(): void }>(client);

    // This message should go through
    server.emit('message', {
      data: JSON.stringify({
        jsonrpc: '2.0',
        method: 'foo',
        params: [],
      }),
    });

    expect(handlers.foo).toHaveBeenCalledTimes(1);

    // This message be ignored
    server.emit('message', {
      data: JSON.stringify({
        jsonrpc: '1.0',
        method: 'foo',
        params: [],
      }),
    });

    expect(handlers.foo).toHaveBeenCalledTimes(1);
  });

  it('should return a method not found error', async () => {
    makeSocketRpc(server, {});
    const clientRpc = makeSocketRpc<{ foo(): void }>(client);

    const result = clientRpc.foo();

    await expect(result).rejects.toMatchObject({
      code: -32601,
      message: 'Method not found',
    });
  });

  it('should return a parse error', async () => {
    makeSocketRpc(server, {});

    let receivedMessage: any;
    client.addEventListener('message', (event: any) => {
      receivedMessage = event.data;
    });

    const result = client.send('not json');
    expect(result).toBeUndefined();

    expect(JSON.parse(receivedMessage)).toMatchObject({
      jsonrpc: '2.0',
      error: {
        code: -32601,
        message: 'Invalid JSON',
      },
    });
  });

  // We should be able to call an endpoint and receive streaming results
  it('should support streaming', async () => {
    const serverRpc = makeSocketRpc(server, {
      foo: async function* () {
        yield 'bar';
        yield 'bin';
        yield 'baz';
      },
    });

    const clientRpc = makeSocketRpc<{ foo(): AsyncIterableIterator<string> }>(
      client
    );

    const result = await clientRpc.foo();

    expect(await result.next()).toMatchObject({ value: 'bar', done: false });
    expect(await result.next()).toMatchObject({ value: 'bin', done: false });
    expect(await result.next()).toMatchObject({ value: 'baz', done: false });
    expect(await result.next()).toMatchObject({ value: undefined, done: true });
  }, 500);

  // Use foreach on streaming results
  it('should support streaming with foreach', async () => {
    const serverRpc = makeSocketRpc(server, {
      foo: async function* () {
        yield 'bar';
        yield 'baz';
      },
    });

    const clientRpc = makeSocketRpc<{ foo(): AsyncIterableIterator<string> }>(
      client
    );

    const result = await clientRpc.foo();

    const values: string[] = [];

    for await (const value of result) {
      values.push(value);
    }

    expect(values).toEqual(['bar', 'baz']);
  });

  // Handle async iterators that yield results with an inner function that is an
  // event handler
  it('should support streaming with event handlers', async () => {
    const dispatcher = {
      handlers: [] as { (event: any): void }[],
      on: (event: any, handler: (event: any) => void) => {
        dispatcher.handlers.push(handler);
      },
      emit: (event: any, value: any) => {
        for (const handler of dispatcher.handlers) {
          handler(value);
        }
      },
    };

    const serverRpc = makeSocketRpc(server, {
      foo: async function () {
        const sink = new AsyncIterableSink<string>();

        dispatcher.on('event', (event: any) => {
          sink.push(event);
        });

        setTimeout(() => {
          dispatcher.emit('event', 'bar');
          dispatcher.emit('event', 'baz');
          sink.end();
        });

        return sink;
      },
    });

    const clientRpc = makeSocketRpc<{ foo(): AsyncIterableIterator<string> }>(
      client
    );

    const result = await clientRpc.foo();

    const values: string[] = [];

    for await (const value of result) {
      values.push(value);
    }

    expect(values).toEqual(['bar', 'baz']);
  }, 500);

  // If an async iterator yields zero results and is closed, we should still
  // receive a response
  it('should support streaming with no results', async () => {
    const serverRpc = makeSocketRpc(server, {
      foo: async function* () {
        yield* [];
      },
    });

    const clientRpc = makeSocketRpc<{ foo(): AsyncIterableIterator<string> }>(
      client
    );

    const result = await clientRpc.foo();

    expect(await result.next()).toMatchObject({ value: undefined, done: true });
  }, 500);

  it('should resolve client promise when server response is empty', async () => {
    client.addEventListener.mockImplementation(function (event, callback) {
      if (event === 'message') this.callback = callback;
    });
    client.send.mockImplementation(function (data) {
      const message = JSON.parse(data) as JsonRpcMessage;
      // Fake receiving a response from the server
      this.callback({
        data: JSON.stringify({
          jsonrpc: '2.0',
          id: message.id,
          result: undefined,
        }),
      });
    });
    const clientRpc = makeSocketRpc<{ foo(): void }>(client);

    const result = clientRpc.foo();

    await expect(result).resolves.toBeUndefined();
  }, 200);

  it('should be able to transmit a JavaScript function', async () => {
    // - Call the server, pasing in a function
    // - The server executes the function and returns the result
    // - The client receives the result
    const handlers = {
      foo: jest.fn().mockImplementation(async function (fn: () => string) {
        return `test: ${fn()}`;
      }),
    };
    const serverRpc = makeSocketRpc(server, handlers);

    const clientRpc = makeSocketRpc<{ foo(fn: () => string): Promise<string> }>(
      client
    );

    const promise = clientRpc.foo(() => 'asdf');

    await expect(promise).resolves.toBe('test: asdf');
    expect(handlers.foo).toHaveBeenCalledWith(expect.any(Function));
  }, 200);

  it('should be able to call require() in the transmittable function', async () => {
    const saved = { require };

    const handlers = {
      foo: jest.fn().mockImplementation(async function (fn: () => string) {
        const { require } = saved;

        fn = new Function('require', `return ${fn}`)(require);

        return `test: ${fn()}`;
      }),
    };
    makeSocketRpc(server, handlers);

    const clientRpc = makeSocketRpc<{ foo(fn: () => string): Promise<string> }>(
      client
    );

    const promise = clientRpc.foo(() => require('os').platform());

    await expect(promise).resolves.toBe(`test: ${process.platform}`);
    expect(handlers.foo).toHaveBeenCalledWith(expect.any(Function));
  }, 200);
});
