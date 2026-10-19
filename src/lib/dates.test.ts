import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addDays, dayNumber, daysBetween, todayKey, weekKey, weekdayOf } from './dates';

describe('todayKey', () => {
  it('rolls over at the rollover hour, local time', () => {
    expect(todayKey(4, new Date(2026, 9, 19, 1, 0))).toBe('2026-10-18');
    expect(todayKey(4, new Date(2026, 9, 19, 3, 59))).toBe('2026-10-18');
    expect(todayKey(4, new Date(2026, 9, 19, 4, 0))).toBe('2026-10-19');
    expect(todayKey(0, new Date(2026, 9, 19, 0, 30))).toBe('2026-10-19');
    expect(todayKey(4, new Date(2026, 0, 1, 2, 0))).toBe('2025-12-31');
  });

  describe('on daylight-saving days', () => {
    let previous: string | undefined;
    beforeAll(() => {
      previous = process.env.TZ;
      process.env.TZ = 'America/New_York';
    });
    afterAll(() => {
      if (previous === undefined) delete process.env.TZ;
      else process.env.TZ = previous;
    });

    it('counts wall-clock hours, not elapsed ones', () => {
      // Clocks jump from 2:00 to 3:00 on 8 March 2026: 4:30 is past the rollover.
      expect(todayKey(4, new Date(2026, 2, 8, 4, 30))).toBe('2026-03-08');
      // Clocks fall back from 2:00 to 1:00 on 1 November 2026: 3:30 is still the night before.
      expect(todayKey(4, new Date(2026, 10, 1, 3, 30))).toBe('2026-10-31');
      expect(todayKey(4, new Date(2026, 10, 1, 4, 0))).toBe('2026-11-01');
    });

    it('keeps day arithmetic whole across the change', () => {
      expect(addDays('2026-03-07', 1)).toBe('2026-03-08');
      expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2);
      expect(daysBetween('2026-10-31', '2026-11-02')).toBe(2);
      expect(weekdayOf('2026-11-01')).toBe(0);
    });
  });
});

describe('day helpers', () => {
  it('numbers days from the start day', () => {
    const start = new Date(2026, 9, 1, 22, 0).toISOString();
    expect(dayNumber(start, 4, new Date(2026, 9, 1, 23, 0))).toBe(1);
    expect(dayNumber(start, 4, new Date(2026, 9, 2, 3, 0))).toBe(1);
    expect(dayNumber(start, 4, new Date(2026, 9, 2, 9, 0))).toBe(2);
  });

  it('builds Monday-based ISO week keys', () => {
    expect(weekKey('2026-10-19')).toBe('2026-W43');
    expect(weekKey('2026-10-25')).toBe('2026-W43');
    expect(weekKey('2026-10-26')).toBe('2026-W44');
    expect(weekKey('2027-01-01')).toBe('2026-W53');
  });
});
