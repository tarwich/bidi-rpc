declare type SocketEventOptions = {
    once: boolean;
};
export interface ISocket extends Pick<WebSocket, 'send' | 'readyState'> {
    addEventListener(type: 'message', listener: (event: {
        data: any;
    }) => void, options?: SocketEventOptions): void;
    addEventListener(type: 'open', listener: (event: {}) => void, options?: SocketEventOptions): void;
    addEventListener(type: 'message', listener: (event: {
        data: any;
    }) => void, options?: SocketEventOptions): void;
}
declare type FilterValues<T, U> = {
    [P in keyof T]: T[P] extends U ? P : never;
}[keyof T];
declare type FilterProperties<T, U> = Pick<T, FilterValues<T, U>>;
declare type ToPromise<R> = R extends Promise<any> ? R : Promise<R>;
export declare type PromiseMethods<T> = {
    [K in keyof FilterProperties<T, (...args: any[]) => any>]: T[K] extends (...args: infer A) => infer R ? (...args: A) => ToPromise<R> : never;
};
export declare type Rpc<T> = PromiseMethods<T>;
export declare const makeSocketRpc: <TRemote extends object, TLocal extends object = any>(socket: ISocket, localHandlers?: TLocal | undefined) => Rpc<TRemote>;
export {};
//# sourceMappingURL=index.d.ts.map