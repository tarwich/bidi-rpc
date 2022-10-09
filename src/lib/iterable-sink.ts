/**
 * Class that implements the async iterator protocol, but also adds a push, and
 * end method to the iterator. The push method can be used to push values into
 * the iterator, and the end method can be used to end the iterator.
 */
export class AsyncIterableSink<T> implements AsyncIterable<T> {
  private _done: boolean;
  iterator: AsyncIterator<T>;
  queue: Array<IteratorResult<T>> = [];
  resolvers: Array<(value: IteratorResult<T>) => void> = [];

  get done() {
    return (
      this._done &&
      // (I don't know why this line was recommended)
      // this.resolvers.length === 0 &&
      this.queue.length === 0
    );
  }

  constructor() {
    this.iterator = {
      next: (value) => {
        if (this.done) {
          return Promise.resolve({ value, done: true });
        }

        if (this.queue.length > 0) {
          return Promise.resolve(this.queue.shift()!);
        }

        return new Promise((resolve) => {
          this.resolvers.push(resolve);
        });
      },
    };
  }

  [Symbol.asyncIterator](): AsyncIterator<T, any, undefined> {
    return this.iterator;
  }

  next() {
    return this.iterator.next();
  }

  push(value: T) {
    if (this._done) {
      throw new Error('Cannot push after end');
    }

    if (this.resolvers.length > 0) {
      this.resolvers.shift()!({ value, done: false });
    } else {
      this.queue.push({ value, done: false });
    }
  }

  end() {
    if (this._done) {
      throw new Error('Cannot end after end');
    }

    this._done = true;

    if (this.resolvers.length > 0) {
      this.resolvers.shift()!({ value: undefined, done: true });
    } else {
      this.queue.push({ value: undefined, done: true });
    }
  }
}
