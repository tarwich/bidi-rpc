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
});
