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
    message: 'Method not found!',
  },
});

export const internalError = (id: string, error: any) => ({
  jsonrpc,
  id,
  error: {
    code: -32603,
    message: 'Unexpected error',
    data: error,
  },
});

export type FunctionCallResponse = {
  jsonrpc: typeof jsonrpc;
  result: any;
  id: string;
};

export type ErrorResponse = {
  jsonrpc: typeof jsonrpc;
  id: string;
  error: {
    code: number;
    message: string;
  };
};
