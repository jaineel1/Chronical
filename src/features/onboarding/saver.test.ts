import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDebouncedSaver } from './saver';

describe('createDebouncedSaver', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('writes only the latest value after the quiet period', async () => {
    const writes: number[] = [];
    const saver = createDebouncedSaver<number>(async (v) => void writes.push(v), 300);
    saver.schedule(1);
    await vi.advanceTimersByTimeAsync(200);
    saver.schedule(2);
    await vi.advanceTimersByTimeAsync(200);
    saver.schedule(3);
    expect(writes).toEqual([]);
    await vi.advanceTimersByTimeAsync(300);
    expect(writes).toEqual([3]);
  });

  it('flush writes immediately and waits for the queue', async () => {
    const writes: number[] = [];
    const saver = createDebouncedSaver<number>(async (v) => void writes.push(v), 300);
    saver.schedule(7);
    expect(saver.hasPending()).toBe(true);
    await saver.flush();
    expect(writes).toEqual([7]);
    expect(saver.hasPending()).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    expect(writes).toEqual([7]);
  });

  it('serialises queued jobs in order, even when a write is slow', async () => {
    const log: string[] = [];
    const saver = createDebouncedSaver<string>(async (v) => {
      await new Promise((r) => setTimeout(r, 50));
      log.push(`answers:${v}`);
    }, 10);
    saver.schedule('a');
    await vi.advanceTimersByTimeAsync(10);
    const step = saver.enqueue(async () => void log.push('step'));
    await vi.advanceTimersByTimeAsync(100);
    await step;
    expect(log).toEqual(['answers:a', 'step']);
  });

  it('keeps going after a failed write', async () => {
    const errors: unknown[] = [];
    const writes: number[] = [];
    const saver = createDebouncedSaver<number>(
      async (v) => {
        if (v === 1) throw new Error('disk full');
        writes.push(v);
      },
      10,
      (e) => errors.push(e),
    );
    saver.schedule(1);
    await saver.flush();
    saver.schedule(2);
    await saver.flush();
    expect(writes).toEqual([2]);
    expect(errors).toHaveLength(1);
  });
});
