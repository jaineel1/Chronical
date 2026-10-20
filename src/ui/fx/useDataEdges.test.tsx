import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useDataEdges } from './useDataEdges';

const on = (was: boolean, now: boolean) => !was && now;
const off = (was: boolean, now: boolean) => was && !now;

describe('useDataEdges', () => {
  it('ignores the first values, fires on a rising edge, clears on a falling one', () => {
    const { result, rerender } = renderHook(({ e }: { e: [string, boolean][] }) => useDataEdges(e, on, off), {
      initialProps: { e: [['a', false], ['b', true]] },
    });
    expect(result.current.size).toBe(0);

    rerender({ e: [['a', true], ['b', true]] });
    const first = result.current.get('a');
    expect(first).toBeDefined();
    expect(result.current.has('b')).toBe(false);

    rerender({ e: [['a', false], ['b', true]] });
    expect(result.current.has('a')).toBe(false);

    rerender({ e: [['a', true], ['b', true]] });
    expect(result.current.get('a')).not.toBe(first);
  });

  it('records a new row instead of firing for it', () => {
    const { result, rerender } = renderHook(({ e }: { e: [string, boolean][] }) => useDataEdges(e, on), {
      initialProps: { e: [['a', false]] },
    });
    rerender({ e: [['a', false], ['c', true]] });
    expect(result.current.size).toBe(0);
  });

  it('fires when a number goes up', () => {
    const { result, rerender } = renderHook(({ e }: { e: [string, number][] }) => useDataEdges(e, (was, now) => now > was), {
      initialProps: { e: [['run', 3]] },
    });
    rerender({ e: [['run', 4]] });
    expect(result.current.has('run')).toBe(true);
  });
});
