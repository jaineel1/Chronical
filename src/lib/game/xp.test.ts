import { describe, expect, it } from 'vitest';
import { pointsForLevel } from './level';
import { formatToNext, playerSummary, weekGrid } from './xp';
import { makeLog, makeRoutine } from './testkit';
import { dayNoFor, formatRange, mondayOf, monthBounds, weekDates } from './calendar';

describe('playerSummary', () => {
  it('uses the mean of the five pillars on the shared curve', () => {
    const p = (points: number) => ({ points });
    const s = playerSummary({ BODY: p(10), SKIN: p(20), MIND: p(30), WORK: p(40), DOPAMINE: p(50) });
    expect(s.points).toBe(30);
    expect(s.level).toBeCloseTo(10 * Math.log2(1 + 30 / 50), 6);
    expect(s.toNext.nextLevel).toBe(7);
    expect(s.toNext.current).toBeCloseTo(30 - pointsForLevel(6), 6);
    expect(s.toNext.span).toBeCloseTo(pointsForLevel(7) - pointsForLevel(6), 6);
  });

  it('treats missing pillars as zero', () => {
    expect(playerSummary({ BODY: { points: 50 } }).points).toBe(10);
    expect(playerSummary({}).level).toBe(0);
  });

  it('formats progress with separators and never rounds past what was earned', () => {
    const s = { points: 0, level: 0, toNext: { current: 1240.9, span: 1600.2, nextLevel: 8 } };
    expect(formatToNext(s)).toBe('1,240 of 1,600 to level 8');
    expect(formatToNext({ ...s, toNext: { current: 5.9, span: 5.44, nextLevel: 7 } })).toBe('5 of 5 to level 7');
  });
});

describe('weekGrid', () => {
  const monday = '2026-10-12';
  const gym = makeRoutine({ id: 'gym', pillar: 'BODY', days: [1, 2, 3, 4, 5, 6] });
  const run = makeRoutine({ id: 'run', pillar: 'BODY', subStat: 'Endurance', days: [1, 3, 5] });
  const read = makeRoutine({ id: 'read', pillar: 'MIND', subStat: 'Learning' });

  it('fills a pillar-day only when every routine scheduled that day was done', () => {
    const logs = [
      makeLog('gym', '2026-10-12', true),
      makeLog('run', '2026-10-12', true),
      makeLog('gym', '2026-10-13', true), // Tuesday: no run scheduled
      makeLog('gym', '2026-10-14', true),
      makeLog('run', '2026-10-14', false),
      makeLog('read', '2026-10-18', true),
    ];
    const grid = weekGrid([gym, run, read], logs, monday);
    expect(grid.days).toEqual(weekDates(monday));
    expect(grid.done.BODY).toEqual([true, true, false, false, false, false, false]);
    expect(grid.scheduled.BODY).toEqual([true, true, true, true, true, true, false]);
    expect(grid.done.MIND).toEqual([false, false, false, false, false, false, true]);
    expect(grid.done.WORK.every((d) => !d)).toBe(true);
    expect(grid.scheduled.WORK.every((d) => !d)).toBe(true);
  });

  it('ignores routines that did not exist yet', () => {
    const late = makeRoutine({ id: 'late', pillar: 'BODY', subStat: 'Recovery', createdAt: '2026-10-15T08:00:00.000Z' });
    const logs = [makeLog('gym', '2026-10-13', true)];
    const grid = weekGrid([gym, late], logs, monday, 4);
    expect(grid.done.BODY[1]).toBe(true);
  });
});

describe('calendar helpers', () => {
  it('numbers days and finds Mondays', () => {
    expect(dayNoFor('2026-09-26T06:00:00', '2026-10-18')).toBe(23);
    expect(mondayOf('2026-10-18')).toBe('2026-10-12');
    expect(mondayOf('2026-10-12')).toBe('2026-10-12');
    expect(formatRange('2026-10-12', '2026-10-18')).toBe('12 to 18 Oct');
    expect(formatRange('2026-09-28', '2026-10-04')).toBe('28 Sep to 4 Oct');
    expect(monthBounds('2026-02-14')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
    expect(monthBounds('2026-10-01')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
  });
});
