import { useLayoutEffect, useRef, useState } from 'react';

/**
 * Watches per-row values that come from the database and reports the rows whose value just moved
 * the way `fires(was, now)` asks for (a tick going on, a streak going up). The first render only
 * records values, so opening a screen never plays anything; rows that appear later are recorded
 * the same way. Each firing gets a fresh number so the caller can restart its animation.
 */
export function useDataEdges<T extends string | number | boolean>(
  entries: ReadonlyArray<readonly [string, T]>,
  fires: (was: T, now: T) => boolean,
  /** Rows whose value moved back the other way stop firing (their pop is cleared). */
  clears?: (was: T, now: T) => boolean,
): ReadonlyMap<string, number> {
  const prev = useRef<Map<string, T> | null>(null);
  const counter = useRef(0);
  const [fired, setFired] = useState<ReadonlyMap<string, number>>(() => new Map());
  const signature = entries.map(([id, v]) => `${id}=${String(v)}`).join('|');

  useLayoutEffect(() => {
    const last = prev.current;
    const now = new Map(entries);
    prev.current = now;
    if (!last) return;
    const on: string[] = [];
    const off: string[] = [];
    for (const [id, value] of now) {
      if (!last.has(id)) continue;
      const was = last.get(id) as T;
      if (was === value) continue;
      if (fires(was, value)) on.push(id);
      else if (clears?.(was, value)) off.push(id);
    }
    if (!on.length && !off.length) return;
    setFired((cur) => {
      const next = new Map(cur);
      for (const id of off) next.delete(id);
      for (const id of on) next.set(id, ++counter.current);
      return next;
    });
    // `signature` captures every id and value in `entries`; `fires`/`clears` are read from this render.
  }, [signature]);

  return fired;
}
