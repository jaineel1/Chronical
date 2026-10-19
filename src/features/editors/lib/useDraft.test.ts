import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useDraft } from './useDraft';

interface Form {
  level: string;
  hours: string;
  name: string;
}

describe('useDraft', () => {
  it('follows the live row until a field is touched, then keeps the edit', () => {
    const first: Form = { level: '62', hours: '212', name: 'Running' };
    const { result, rerender } = renderHook(({ live }) => useDraft(live), { initialProps: { live: first } });
    expect(result.current[0]).toEqual(first);
    expect(result.current[2]()).toBe(false);

    act(() => result.current[1]({ name: 'Trail running' }));
    expect(result.current[0].name).toBe('Trail running');
    expect(result.current[2]()).toBe(true);

    // "Log hours" on the same page changes level and hours in the store.
    rerender({ live: { level: '62.2', hours: '214', name: 'Running' } });
    expect(result.current[0]).toEqual({ level: '62.2', hours: '214', name: 'Trail running' });
  });

  it('keeps the same object when nothing untouched changed', () => {
    const live: Form = { level: '1', hours: '0', name: 'x' };
    const { result, rerender } = renderHook(({ l }) => useDraft(l), { initialProps: { l: live } });
    const before = result.current[0];
    rerender({ l: { ...live } });
    expect(result.current[0]).toBe(before);
  });
});
