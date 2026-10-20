import { describe, expect, it } from 'vitest';
import type { DayLog, Photo, Quest } from '@/data/types';
import { addDays } from '@/lib/dates';
import { computeBadges, longestStreak, type Badge, type BadgeInput } from './achievements';
import { pointsForLevel } from './level';
import { makeLog, makeRoutine } from './testkit';

type Day = BadgeInput['dayLogs'][number];

const START = '2026-09-01';

function day(date: string, over: Partial<DayLog> = {}): Day {
  return { date, quests: [], ...over };
}

/** `n` consecutive day keys from `start`. */
function run(n: number, start = START): string[] {
  return Array.from({ length: n }, (_, i) => addDays(start, i));
}

function empty(over: Partial<BadgeInput> = {}): BadgeInput {
  return { routines: [], routineLogs: [], dayLogs: [], meals: [], photos: [], pillarPoints: [0, 0, 0, 0, 0], ...over };
}

function badge(input: BadgeInput, id: string): Badge {
  const b = computeBadges(input).find((x) => x.id === id);
  if (!b) throw new Error(`no badge ${id}`);
  return b;
}

function quest(done: boolean): Quest {
  return { id: Math.random().toString(36), text: 'q', done };
}

describe('computeBadges', () => {
  it('earns nothing on an empty world and shows progress from zero', () => {
    const all = computeBadges(empty());
    expect(all.length).toBeGreaterThanOrEqual(10);
    expect(all.every((b) => !b.earned && b.earnedOn === undefined)).toBe(true);
    expect(new Set(all.map((b) => b.id)).size).toBe(all.length);
    expect(badge(empty(), 'nights-7').progress).toBe('0 of 7 nights');
  });

  it('counts closed nights and dates the badge on the 7th', () => {
    const dates = run(9);
    const logs = dates.map((d, i) => day(d, i === 3 ? {} : { closedAt: `${d}T22:00:00.000Z` }));
    const b = badge(empty({ dayLogs: logs }), 'nights-7');
    expect(b.earned).toBe(true);
    // Day 4 was not closed, so the 7th closed night is the 8th day.
    expect(b.earnedOn).toBe(dates[7]);
    const thirty = badge(empty({ dayLogs: logs }), 'nights-30');
    expect(thirty.earned).toBe(false);
    expect(thirty.progress).toBe('8 of 30 nights');
    expect(thirty.current).toBe(8);
  });

  it('orders by day even when rows arrive out of order', () => {
    const dates = run(7);
    const logs = [...dates].reverse().map((d) => day(d, { closedAt: 'x' }));
    expect(badge(empty({ dayLogs: logs }), 'nights-7').earnedOn).toBe(dates[6]);
  });

  it('earns the first letter on the first day with a brief, ignoring blank ones', () => {
    const logs = [day('2026-09-03', { briefMd: 'Dear you' }), day('2026-09-02', { briefMd: '   ' }), day('2026-09-05', { briefMd: 'Again' })];
    const b = badge(empty({ dayLogs: logs }), 'letter-1');
    expect(b.earned).toBe(true);
    expect(b.earnedOn).toBe('2026-09-03');
  });

  it('needs 10,000 steps, not 9,999', () => {
    const dates = run(6);
    const logs = dates.map((d, i) => day(d, { steps: i === 0 ? 9_999 : 10_000 }));
    const b = badge(empty({ dayLogs: logs }), 'steps-5');
    expect(b.earned).toBe(true);
    expect(b.earnedOn).toBe(dates[5]);
    const four = badge(empty({ dayLogs: logs.slice(0, 5) }), 'steps-5');
    expect(four.earned).toBe(false);
    expect(four.progress).toBe('4 of 5 days');
  });

  it('counts water only when some was logged', () => {
    const logs = run(7).map((d, i) => day(d, { waterL: i === 2 ? 0 : 2 }));
    const b = badge(empty({ dayLogs: logs }), 'water-7');
    expect(b.earned).toBe(false);
    expect(b.progress).toBe('6 of 7 days');
  });

  it('counts a workout by type or by minutes', () => {
    const dates = run(12);
    const logs = dates.map((d, i) => day(d, i < 5 ? { workoutType: 'run' } : i < 9 ? { workoutMin: 30 } : i === 9 ? { workoutType: ' ', workoutMin: 0 } : { workoutType: 'lift', workoutMin: 45 }));
    const b = badge(empty({ dayLogs: logs }), 'workout-10');
    expect(b.earned).toBe(true);
    // Day 10 (index 9) has neither, so the 10th workout is index 10.
    expect(b.earnedOn).toBe(dates[10]);
  });

  it('earns "every meal counted" on the first day where all meals have calories', () => {
    const meals: BadgeInput['meals'] = [
      { date: '2026-09-01', nutrition: { kcal: 400 } },
      { date: '2026-09-01' },
      { date: '2026-09-02', nutrition: { kcal: 300 } },
      { date: '2026-09-02', nutrition: { kcal: 0 } },
      { date: '2026-09-03', nutrition: { kcal: 500 } },
    ];
    const b = badge(empty({ meals }), 'meals-counted');
    expect(b.earned).toBe(true);
    expect(b.earnedOn).toBe('2026-09-02');
  });

  it('shows the closest day while "every meal counted" is locked', () => {
    const meals: BadgeInput['meals'] = [
      { date: '2026-09-01', nutrition: { kcal: 400 } },
      { date: '2026-09-01', nutrition: { grams: 100 } },
      { date: '2026-09-01' },
      { date: '2026-09-02', nutrition: { kcal: 300 } },
      { date: '2026-09-02' },
    ];
    const b = badge(empty({ meals }), 'meals-counted');
    expect(b.earned).toBe(false);
    expect(b.progress).toBe('1 of 2 meals');
    expect(badge(empty(), 'meals-counted').progress).toBe('0 of 1 days');
  });

  it('dates photo badges by photo day, several angles on one day count once', () => {
    const photos: Pick<Photo, 'date'>[] = [{ date: '2026-09-10' }, { date: '2026-09-10' }, { date: '2026-09-03' }, { date: '2026-09-20' }];
    const first = badge(empty({ photos }), 'photo-1');
    expect(first.earned).toBe(true);
    expect(first.earnedOn).toBe('2026-09-03');
    const four = badge(empty({ photos }), 'photo-days-4');
    expect(four.earned).toBe(false);
    expect(four.progress).toBe('3 of 4 days');
    const more = badge(empty({ photos: [...photos, { date: '2026-10-01' }] }), 'photo-days-4');
    expect(more.earned).toBe(true);
    expect(more.earnedOn).toBe('2026-10-01');
  });

  it('earns level 10 when any pillar reaches it, without a date', () => {
    const locked = badge(empty({ pillarPoints: [pointsForLevel(9.98), 10, 0, 0, 0] }), 'pillar-10');
    expect(locked.earned).toBe(false);
    expect(locked.progress).toBe('level 9.9 of 10');
    const earned = badge(empty({ pillarPoints: [0, pointsForLevel(10.2), 0, 0, 0] }), 'pillar-10');
    expect(earned.earned).toBe(true);
    expect(earned.earnedOn).toBeUndefined();
  });

  it('counts done quests across days and dates the 21st', () => {
    const dates = run(6);
    const logs = dates.map((d) => day(d, { quests: [quest(true), quest(true), quest(true), quest(true), quest(false)] }));
    const b = badge(empty({ dayLogs: logs }), 'quests-21');
    expect(b.earned).toBe(true);
    // 4 a day: the 21st lands on the 6th day.
    expect(b.earnedOn).toBe(dates[5]);
    const few = badge(empty({ dayLogs: logs.slice(0, 2) }), 'quests-21');
    expect(few.progress).toBe('8 of 21 quests');
  });
});

describe('streak badges', () => {
  it('earns a week from 7 done days and dates it on the 7th', () => {
    const dates = run(8);
    const r = makeRoutine({ id: 'r' });
    const logs = dates.map((d) => makeLog('r', d, true));
    const b = badge(empty({ routines: [r], routineLogs: logs }), 'streak-7');
    expect(b.earned).toBe(true);
    expect(b.earnedOn).toBe(dates[6]);
    const month = badge(empty({ routines: [r], routineLogs: logs }), 'streak-30');
    expect(month.progress).toBe('8 of 30 days');
  });

  it('keeps the longest run after a break', () => {
    const dates = run(15);
    const logs = dates.map((d, i) => makeLog('r', d, i !== 9));
    // 9 done, 1 miss, 5 done.
    expect(longestStreak(makeRoutine({ id: 'r' }), logs).longest).toBe(9);
  });

  it('a shielded miss keeps the run, a missing log breaks it', () => {
    const dates = run(8);
    const shielded = dates.map((d, i) => makeLog('r', d, i !== 3, i === 3));
    expect(longestStreak(makeRoutine({ id: 'r' }), shielded).longest).toBe(7);
    const gap = dates.filter((_, i) => i !== 3).map((d) => makeLog('r', d, true));
    expect(longestStreak(makeRoutine({ id: 'r' }), gap).longest).toBe(4);
  });

  it('skips days the routine is not scheduled', () => {
    // Weekdays only, from Monday 2026-09-07 for two weeks, logs on weekdays only.
    const r = makeRoutine({ id: 'r', days: [1, 2, 3, 4, 5] });
    const dates = run(12, '2026-09-07').filter((d) => ![0, 6].includes(new Date(`${d}T12:00:00`).getDay()));
    const logs = dates.map((d) => makeLog('r', d, true));
    const rec = longestStreak(r, logs, [7]);
    expect(rec.longest).toBe(10);
    expect(rec.reachedOn.get(7)).toBe('2026-09-15');
  });

  it('ignores other routines in the logs and takes the earliest date across routines', () => {
    const a = makeRoutine({ id: 'a' });
    const b = makeRoutine({ id: 'b' });
    const logs = [...run(7, '2026-09-05').map((d) => makeLog('a', d, true)), ...run(7, '2026-09-02').map((d) => makeLog('b', d, true))];
    const badgeA = badge(empty({ routines: [a, b], routineLogs: logs }), 'streak-7');
    expect(badgeA.earnedOn).toBe('2026-09-08');
    expect(longestStreak(a, logs).longest).toBe(7);
  });

  it('trusts the cached streak on the routine when logs are missing, without a date', () => {
    const r = makeRoutine({ id: 'r', streak: 12 });
    const b = badge(empty({ routines: [r] }), 'streak-7');
    expect(b.earned).toBe(true);
    expect(b.earnedOn).toBeUndefined();
  });
});
