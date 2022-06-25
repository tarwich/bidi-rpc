import { uuidV4 } from './uuid';
import {
  jsonrpc,
  FunctionCallMessage,
  isFunctionCallMessage,
  methodNotFoundError,
  internalError,
  FunctionCallResponse,
  ErrorResponse,
} from './jsonrpc';

enum WebSocketState {
  CONNECTING = 0,
  OPEN = 1,
  CLOSING = 2,
  CLOSED = 3,
}

type SocketEventOptions = { once: boolean };

export interface ISocket extends Pick<WebSocket, 'send' | 'readyState'> {
  addEventListener(
    type: 'message',
    listener: (event: { data: any }) => void,
    options?: SocketEventOptions
  ): void;
  addEventListener(
    type: 'open',
    listener: (event: {}) => void,
    options?: SocketEventOptions
  ): void;
  addEventListener(
    type: 'message',
    listener: (event: { data: any }) => void,
    options?: SocketEventOptions
  ): void;
}

type FilterValues<T, U> = {
  [P in keyof T]: T[P] extends U ? P : never;
}[keyof T];
type FilterProperties<T, U> = Pick<T, FilterValues<T, U>>;

type FunctionPropertyNames<T> = {
  [K in keyof T]: K extends string
    ? T[K] extends (...args: any[]) => any
      ? K
      : never
    : never;
}[keyof T];
type Functions<T> = { [K in FunctionPropertyNames<T>]: T[K] };

type ToPromise<R> = R extends Promise<any> ? R : Promise<R>;

export type PromiseMethods<T> = {
  [K in keyof FilterProperties<T, (...args: any[]) => any>]: T[K] extends (
    ...args: infer A
  ) => infer R
    ? (...args: A) => ToPromise<R>
    : never;
};

export type Rpc<T> = PromiseMethods<T>;

// Make a socket JSON-RPC 2.0 compatible
export const makeSocketRpc = <
  TRemote extends object,
  TLocal extends object = any
>(
  socket: ISocket,
  localHandlers?: TLocal
): Rpc<TRemote> => {
  const calls = new Map<
    string,
    {
      resolve: (value: any) => void;
      reject: (reason: any) => void;
    }
  >();
  const connected = new Promise<void>((resolve, reject) => {
    if (socket.readyState === WebSocketState.CONNECTING) {
      socket.addEventListener(
        'open',
        () => {
          resolve();
        },
        { once: true }
      );
    } else if (socket.readyState === WebSocketState.OPEN) {
      resolve();
    } else {
      reject(new Error('Socket is closed'));
    }
  });

  const sendCall = (method: string, params: any[]) => {
    const id = uuidV4();
    // TODO: Handle errors on JSON.stringify
    const payload = JSON.stringify({ jsonrpc, id, method, params });

    return new Promise((resolve, reject) => {
      calls.set(id, { resolve, reject });
      socket.send(payload);
    });
  };

  const result = new Proxy(
    {},
    {
      get(target, propKey) {
        return async (...args: any[]) => {
          await connected;
          return sendCall(String(propKey), args);
        };
      },
    }
  ) as Rpc<TRemote>;

  socket.addEventListener('message', async (event) => {
    try {
      const data = JSON.parse(event.data) as
        | FunctionCallMessage
        | FunctionCallResponse
        | ErrorResponse;

      const send = (message: any) =>
        socket.send(JSON.stringify({ jsonrpc, ...message }));

      if (data.jsonrpc !== jsonrpc) {
        return;
      }

      if (isFunctionCallMessage(data)) {
        const method =
          localHandlers && localHandlers[data.method as keyof TLocal];

        if (!method || typeof method !== 'function') {
          return send(methodNotFoundError(data.id));
        }

        try {
          const result = await method.call(localHandlers, ...data.params);
          return send({ id: data.id, result });
        } catch (e) {
          return send(internalError(data.id, e));
        }
      } else if ('result' in data) {
        const call = calls.get(data.id);

        if (call) {
          call.resolve(data.result);
          calls.delete(data.id);
        }
      } else if ('error' in data) {
        const call = calls.get(data.id);

        if (call) {
          call.reject(data.error);
          calls.delete(data.id);
        }
      }
    } catch (error) {
      console.error(error);
      socket.send(
        JSON.stringify({
          jsonrpc,
          error: { code: -32601, message: 'Invalid JSON' },
        })
      );
    }
  });

  return result;
};
