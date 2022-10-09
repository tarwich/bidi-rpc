import { AsyncIterableSink } from './iterable-sink';

describe('IterableSink', () => {
  it('should allow pushing and pulling items', async () => {
    const sink = new AsyncIterableSink();

    sink.push(1);
    sink.push(2);

    {
      // Get the next value from the iterator
      const { value } = await sink.iterator.next();
      expect(value).toBe(1);
    }

    {
      // Get the next value from the iterator
      const { value } = await sink.iterator.next();
      expect(value).toBe(2);
    }

    {
      // Wait for the next value before it exists
      const promise = sink.iterator.next();
      sink.push(3);
      const { value, done } = await promise;
      expect(value).toBe(3);
      expect(done).toBe(false);
    }

    {
      // Wait for the next value. Iterator is done
      const promise = sink.iterator.next();
      sink.end();
      const { value, done } = await promise;
      expect(value).toBe(undefined);
      expect(done).toBe(true);
    }
  });

  it('should not allow pushing after end', () => {
    const sink = new AsyncIterableSink();

    sink.end();

    expect(() => sink.push(1)).toThrow('Cannot push after end');
  });

  it('should not allow ending after end', () => {
    const sink = new AsyncIterableSink();

    sink.end();

    expect(() => sink.end()).toThrow('Cannot end after end');
  });

  it('should allow pushing and pulling items with for await', async () => {
    const sink = new AsyncIterableSink();

    sink.push(1);
    sink.push(2);
    sink.end();

    const values = [];

    for await (const value of sink) {
      values.push(value);
    }

    expect(values).toEqual([1, 2]);
  });

  it('should allow pushing and pulling items with for await and async generator', async () => {
    const sink = new AsyncIterableSink();

    sink.push(1);
    sink.push(2);
    sink.end();

    const values = [];

    async function* gen() {
      for await (const value of sink) {
        yield value;
      }
    }

    for await (const value of gen()) {
      values.push(value);
    }

    expect(values).toEqual([1, 2]);
  });

  it('should return done when iterating after end', async () => {
    const sink = new AsyncIterableSink();

    sink.push(1);
    sink.end();

    const values = [];

    for await (const value of sink) {
      values.push(value);
    }

    expect(values).toEqual([1]);

    const { done } = await sink.iterator.next();

    expect(done).toBe(true);
  });

  // Allow calling next directly on the iterable
  it('should allow calling next directly on the iterable', async () => {
    const sink = new AsyncIterableSink();

    sink.push(1);
    sink.push(2);
    sink.end();

    const { value } = await sink.next();
    expect(value).toBe(1);
  });
});
