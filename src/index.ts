import {
  internalError,
  isErrorResponse,
  isFunctionCallMessage,
  isFunctionCallResponse,
  isIterableFunctionCallResponse,
  jsonrpc,
  JsonRpcMessage,
  methodNotFoundError,
} from './jsonrpc';
import { isAsyncIterable } from './lib/is-iterable';
import { AsyncIterableSink } from './lib/iterable-sink';
import { decodeParams, encodeParams } from './lib/parameters';
import { uuidV4 } from './uuid';
export { AsyncIterableSink } from './lib/iterable-sink';

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
      iterableSink?: AsyncIterableSink<any>;
    }
  >();
  const connected = new Promise<void>((resolve, reject) => {
    if (socket.readyState === WebSocketState.CONNECTING) {
      // If the socket is connecting, add an event listener to resolve the promise
      // when it opens
      socket.addEventListener(
        'open',
        () => {
          resolve();
        },
        { once: true }
      );
    } else if (socket.readyState === WebSocketState.OPEN) {
      // If the socket is already open, resolve the promise immediately
      resolve();
    } else {
      // If the socket is closed or closing, reject the promise
      reject(new Error('Socket is closed'));
    }
  });

  const sendCall = (method: string, params: any[]) => {
    const id = uuidV4();

    // TODO: Handle errors on JSON.stringify
    const payload = JSON.stringify({
      jsonrpc,
      id,
      method,
      params: encodeParams(params),
    });

    return new Promise((resolve, reject) => {
      calls.set(id, { resolve, reject });
      socket.send(payload);
    });
  };

  // Create a lazy getter that will wait for the socket to be connected before
  // sending any calls
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
      // The data coule be a function call, a response to a function call, or an
      // error
      const data = JSON.parse(event.data) as JsonRpcMessage;

      const send = (message: any) =>
        socket.send(JSON.stringify({ jsonrpc, ...message }));

      // If the jsonrpc version is the wrong version, ignore the message
      if (data.jsonrpc !== jsonrpc) {
        return;
      }

      // Handle function call
      if (isFunctionCallMessage(data)) {
        const method =
          localHandlers && localHandlers[data.method as keyof TLocal];

        // Calling a method that doesn't exist
        if (!method || typeof method !== 'function') {
          return send(methodNotFoundError(data.id));
        }

        try {
          const params = decodeParams(data.params);
          const result = await method.call(localHandlers, ...params);

          // If the result is async iterable, send a notification for each item
          if (isAsyncIterable(result)) {
            for await (const item of result) {
              send({ id: data.id, value: item });
            }

            return send({ id: data.id, done: true });
          }
          // Only one result, send a response
          else {
            send({ id: data.id, result });
          }

          return;
        } catch (e) {
          return send(internalError(data.id, e));
        }
      }
      // Handle async iterable response
      else if (isIterableFunctionCallResponse(data)) {
        const call = calls.get(data.id);

        if (call) {
          const sink = call.iterableSink || new AsyncIterableSink();
          call.iterableSink = sink;

          if (data.done) {
            sink.end();
            calls.delete(data.id);
            call.resolve(sink);
          } else {
            sink.push(data.value);
            call.resolve(sink);
          }
        }
      }
      // Handle error response
      else if (isErrorResponse(data)) {
        const call = calls.get(data.id);

        if (call) {
          call.reject(data.error);
          calls.delete(data.id);
        }
      }
      // Handle function call response
      //
      // This must be last because it will match all other types of responses
      else if (isFunctionCallResponse(data)) {
        const call = calls.get(data.id);

        if (call) {
          call.resolve(data.result);
          calls.delete(data.id);
        }
      }
    } catch (error) {
      console.error('Error handling message', error, event.data);

      // Handle generic errors, such as JSON parsing errors
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
