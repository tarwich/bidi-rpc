export const isAsyncIterable = <T>(value: any): value is AsyncIterable<T> => {
  return value && typeof value[Symbol.asyncIterator] === 'function';
};
