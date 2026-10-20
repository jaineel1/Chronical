import { describe, expect, it } from 'vitest';
import type { DayLog, Quest } from '@/data/types';
import { PERIOD_QUEST_PREFIX } from '@/lib/parse/weekly';
import { SUN_HIGH_TOP, SUN_HORIZON_TOP, sunTop, todaysQuestProgress } from './sun';

describe('sunTop', () => {
  it('sits on the horizon with nothing done and high with everything done', () => {
    expect(sunTop(0, 3)).toBe(SUN_HORIZON_TOP);
    expect(sunTop(3, 3)).toBe(SUN_HIGH_TOP);
  });
  it('climbs in between, in whole pixels', () => {
    const one = sunTop(1, 3);
    const two = sunTop(2, 3);
    expect(one).toBeLessThan(SUN_HORIZON_TOP);
    expect(two).toBeLessThan(one);
    expect(two).toBeGreaterThan(SUN_HIGH_TOP);
    expect(Number.isInteger(one)).toBe(true);
  });
  it('stays high when there are no quests and clamps odd counts', () => {
    expect(sunTop(0, 0)).toBe(SUN_HIGH_TOP);
    expect(sunTop(5, 3)).toBe(SUN_HIGH_TOP);
    expect(sunTop(-1, 3)).toBe(SUN_HORIZON_TOP);
  });
});

describe('todaysQuestProgress', () => {
  const q = (id: string, done: boolean): Quest => ({ id, text: id, done });
  it('counts only the day quests on the brief', () => {
    const log = { quests: [q('a', true), q('b', false), q(`${PERIOD_QUEST_PREFIX.weekly}x`, true)] } as unknown as DayLog;
    expect(todaysQuestProgress(log)).toEqual({ done: 1, total: 2 });
  });
  it('is empty without a brief', () => {
    expect(todaysQuestProgress(null)).toEqual({ done: 0, total: 0 });
    expect(todaysQuestProgress(undefined)).toEqual({ done: 0, total: 0 });
  });
});
