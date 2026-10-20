import { describe, expect, it } from 'vitest';
import { weekKey } from '@/lib/dates';
import { shieldState } from './shields';

// 2026-10-20 is a Tuesday (weekday 2).
const TODAY = '2026-10-20';
const base = { days: [] as number[], shields: 1, shieldWeek: undefined as string | undefined, streak: 5 };

describe('shieldState', () => {
  it('is unused with no shield spent this week', () => {
    expect(shieldState({ ...base, shieldWeek: weekKey(TODAY), shields: 1 }, TODAY, true).used).toBe(false);
  });

  it('is used when this week has no shields left', () => {
    expect(shieldState({ ...base, shieldWeek: weekKey(TODAY), shields: 0 }, TODAY, true).used).toBe(true);
  });

  it('gets the shield back in a new week', () => {
    expect(shieldState({ ...base, shieldWeek: weekKey('2026-10-12'), shields: 0 }, TODAY, true).used).toBe(false);
  });

  it('is at risk when today is scheduled, not done, and a streak is running', () => {
    expect(shieldState({ ...base, days: [2] }, TODAY, false).atRisk).toBe(true);
    expect(shieldState({ ...base, days: [] }, TODAY, false).atRisk).toBe(true);
  });

  it('is not at risk once done, when unscheduled, or with no streak', () => {
    expect(shieldState({ ...base, days: [2] }, TODAY, true).atRisk).toBe(false);
    expect(shieldState({ ...base, days: [3] }, TODAY, false).atRisk).toBe(false);
    expect(shieldState({ ...base, days: [2], streak: 0 }, TODAY, false).atRisk).toBe(false);
  });
});
