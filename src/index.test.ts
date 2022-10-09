import 'jest-extended';
import 'jest-json';
import { ISocket, makeSocketRpc } from './index';

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
        params: ['bar'],
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

    client.addEventListener('message', (event: any) => {
      expect(event.data).toMatchObject({
        code: -32700,
        message: 'Parse error',
      });
    });

    const result = client.send('not json');
    expect(result).toBeUndefined();
  });
});
