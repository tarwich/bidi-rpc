/**
 * Class that implements the async iterator protocol, but also adds a push, and
 * end method to the iterator. The push method can be used to push values into
 * the iterator, and the end method can be used to end the iterator.
 */
export declare class AsyncIterableSink<T> implements AsyncIterable<T> {
    private _done;
    iterator: AsyncIterator<T>;
    queue: Array<IteratorResult<T>>;
    resolvers: Array<(value: IteratorResult<T>) => void>;
    get done(): boolean;
    constructor();
    [Symbol.asyncIterator](): AsyncIterator<T, any, undefined>;
    next(): Promise<IteratorResult<T, any>>;
    push(value: T): void;
    end(): void;
}
//# sourceMappingURL=iterable-sink.d.ts.map