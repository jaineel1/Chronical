/**
 * Debounced, serialised profile writes for the wizard. Every answer change schedules one write of
 * the whole answer map ~300 ms later; other profile writes (current step, settings toggles) join
 * the same queue, so two read-modify-write updates of the profile row can never interleave.
 */
export interface DebouncedSaver<T> {
  /** Remember the latest value and write it after `delay` ms of quiet. */
  schedule(value: T): void;
  /** Write the pending value now (if any) and resolve when the queue is empty. */
  flush(): Promise<void>;
  /** Queue any other write behind the pending ones. */
  enqueue(job: () => Promise<unknown>): Promise<void>;
  /** True while a value is waiting for its timer. */
  hasPending(): boolean;
  /** Drop the timer (the pending value is kept until the next flush). */
  dispose(): void;
}

export function createDebouncedSaver<T>(write: (value: T) => Promise<unknown>, delay = 300, onError: (e: unknown) => void = console.error): DebouncedSaver<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  let pending: { value: T } | undefined;
  let chain: Promise<void> = Promise.resolve();

  const enqueue = (job: () => Promise<unknown>): Promise<void> => {
    chain = chain.then(job).then(
      () => undefined,
      (e: unknown) => onError(e),
    );
    return chain;
  };

  const flush = (): Promise<void> => {
    if (timer !== undefined) {
      clearTimeout(timer);
      timer = undefined;
    }
    if (!pending) return chain;
    const { value } = pending;
    pending = undefined;
    return enqueue(() => write(value));
  };

  return {
    schedule(value: T) {
      pending = { value };
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = undefined;
        void flush();
      }, delay);
    },
    flush,
    enqueue,
    hasPending: () => pending !== undefined,
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
    },
  };
}
