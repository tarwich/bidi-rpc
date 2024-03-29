export const jsonrpc = '2.0' as const;

export type FunctionCallMessage = {
  jsonrpc: typeof jsonrpc;
  id: string;
  method: string;
  params: any[];
};

export const isFunctionCallMessage = (
  message: any
): message is FunctionCallMessage => {
  return (
    message.jsonrpc === jsonrpc &&
    typeof message.method === 'string' &&
    Array.isArray(message.params)
  );
};

export const methodNotFoundError = (id: string) => ({
  jsonrpc,
  id,
  error: {
    code: -32601,
    message: 'Method not found',
  },
});

export const internalError = (id: string, error: any) => {
  console.error(error);

  return {
    jsonrpc,
    id,
    error: {
      code: -32603,
      message: 'Unexpected error',
      data: error,
    },
  };
};

export type FunctionCallResponse = {
  jsonrpc: typeof jsonrpc;
  result: any;
  id: string;
};

export const isFunctionCallResponse = (
  message?: any
): message is FunctionCallResponse => {
  return (
    message && message.jsonrpc === jsonrpc && typeof message.id === 'string'
  );
};

export type ErrorResponse = {
  jsonrpc: typeof jsonrpc;
  id: string;
  error: {
    code: number;
    message: string;
  };
};

export const isErrorResponse = (message: any): message is ErrorResponse => {
  return (
    message &&
    message.jsonrpc === jsonrpc &&
    typeof message.id === 'string' &&
    message.error &&
    // Suggested by IDE, but doesn't seem necessary
    // typeof message.error.code === 'number' &&
    typeof message.error.message === 'string'
  );
};

export type IterableFunctionCallResponse<T = any> = {
  jsonrpc: typeof jsonrpc;
  id: string;
  value: T;
  done: boolean;
};

export const isIterableFunctionCallResponse = (
  message?: any
): message is IterableFunctionCallResponse => {
  return (
    message &&
    message.jsonrpc === jsonrpc &&
    typeof message.id === 'string' &&
    ('value' in message || 'done' in message)
  );
};

export type JsonRpcMessage =
  | FunctionCallMessage
  | FunctionCallResponse
  | ErrorResponse;
