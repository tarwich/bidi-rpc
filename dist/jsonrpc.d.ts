export declare const jsonrpc: "2.0";
export declare type FunctionCallMessage = {
    jsonrpc: typeof jsonrpc;
    id: string;
    method: string;
    params: any[];
};
export declare const isFunctionCallMessage: (message: any) => message is FunctionCallMessage;
export declare const methodNotFoundError: (id: string) => {
    jsonrpc: "2.0";
    id: string;
    error: {
        code: number;
        message: string;
    };
};
export declare const internalError: (id: string, error: any) => {
    jsonrpc: "2.0";
    id: string;
    error: {
        code: number;
        message: string;
        data: any;
    };
};
export declare type FunctionCallResponse = {
    jsonrpc: typeof jsonrpc;
    result: any;
    id: string;
};
export declare type ErrorResponse = {
    jsonrpc: typeof jsonrpc;
    id: string;
    error: {
        code: number;
        message: string;
    };
};
//# sourceMappingURL=jsonrpc.d.ts.map