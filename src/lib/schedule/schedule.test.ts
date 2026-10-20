import { describe, expect, it } from 'vitest';
import type { PlanBlock, Routine, TimetableEntry } from '@/data/types';
import { buildTimeline, formatMinute, gameMinute, layoutLanes, nowAndNext, parseTime, parseWindow } from './schedule';

const STAMP = '2026-07-01T00:00:00.000Z';

function entry(over: Partial<TimetableEntry> & Pick<TimetableEntry, 'day' | 'start' | 'end' | 'title'>): TimetableEntry {
  return { id: `${over.title}-${over.day}-${over.start}`, createdAt: STAMP, updatedAt: STAMP, kind: 'class', ...over };
}

function routine(over: Partial<Routine> & Pick<Routine, 'name'>): Routine {
  return {
    id: over.name,
    createdAt: STAMP,
    updatedAt: STAMP,
    pillar: 'BODY',
    subStat: 'Strength',
    weight: 2,
    days: [],
    upside: '',
    cost: '',
    streak: 0,
    shields: 1,
    archived: false,
    sortOrder: 0,
    ...over,
  };
}

// 2026-10-19 is a Monday, 2026-10-24 a Saturday, 2026-10-25 a Sunday.
const MON = '2026-10-19';
const SAT = '2026-10-24';
const SUN = '2026-10-25';

const os = entry({ day: 1, start: '15:10', end: '16:05', title: 'Operating System', room: 'F-504', teacher: 'Shilpa Pandey' });
const cd = entry({ day: 1, start: '14:10', end: '15:05', title: 'Compiler Design', room: 'F1-302' });
const lunch = entry({ day: 1, start: '13:10', end: '14:05', title: 'Lunch break', kind: 'break' });

describe('parseTime and parseWindow', () => {
  it('reads HH:MM and rejects nonsense', () => {
    expect(parseTime('06:30')).toBe(390);
    expect(parseTime('6:30')).toBe(390);
    expect(parseTime('24:00')).toBe(1440);
    expect(parseTime('24:01')).toBeUndefined();
    expect(parseTime('12:60')).toBeUndefined();
    expect(parseTime('noon')).toBeUndefined();
  });

  it('reads a window, running to midnight when it crosses it', () => {
    expect(parseWindow('06:30-07:00')).toEqual({ start: 390, end: 420 });
    expect(parseWindow('06:30 - 07:00')).toEqual({ start: 390, end: 420 });
    expect(parseWindow('22:00-01:00')).toEqual({ start: 1320, end: 1440 });
    expect(parseWindow('23:00-24:00')).toEqual({ start: 1380, end: 1440 });
    expect(parseWindow('evening')).toBeUndefined();
    expect(parseWindow(undefined)).toBeUndefined();
  });

  it('formats minutes', () => {
    expect(formatMinute(0)).toBe('00:00');
    expect(formatMinute(1440)).toBe('24:00');
    expect(formatMinute(815)).toBe('13:35');
  });
});

describe('gameMinute', () => {
  it('counts past midnight until the rollover hour', () => {
    expect(gameMinute(new Date(2026, 9, 20, 1, 10), 4)).toBe(1510);
    expect(gameMinute(new Date(2026, 9, 20, 3, 59), 4)).toBe(24 * 60 + 239);
    expect(gameMinute(new Date(2026, 9, 20, 4, 0), 4)).toBe(240);
    expect(gameMinute(new Date(2026, 9, 20, 23, 59), 4)).toBe(1439);
  });
});

describe('buildTimeline', () => {
  it('keeps only the weekday asked for, sorted by start', () => {
    const tue = entry({ day: 2, start: '09:00', end: '09:55', title: 'Tuesday thing' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [os, tue, lunch, cd], routines: [] });
    expect(t.map((b) => b.title)).toEqual(['Lunch break', 'Compiler Design', 'Operating System']);
    expect(t[2]).toMatchObject({ kind: 'class', start: '15:10', end: '16:05', sub: 'F-504, Shilpa Pandey', room: 'F-504' });
  });

  it('shows nothing from a Monday to Friday timetable on the weekend', () => {
    expect(buildTimeline({ date: SAT, weekday: 6, entries: [os, cd, lunch], routines: [] })).toEqual([]);
    expect(buildTimeline({ date: SUN, weekday: 0, entries: [os, cd, lunch], routines: [] })).toEqual([]);
  });

  it('respects from and to, both ends inclusive', () => {
    const e = entry({ day: 1, start: '09:00', end: '09:55', title: 'Term', from: '2026-10-19', to: '2026-10-19' });
    const early = entry({ day: 1, start: '10:00', end: '10:55', title: 'Starts later', from: '2026-10-20' });
    const late = entry({ day: 1, start: '11:00', end: '11:55', title: 'Ended', to: '2026-10-18' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [e, early, late], routines: [] });
    expect(t.map((b) => b.title)).toEqual(['Term']);
    expect(buildTimeline({ date: '2026-10-26', weekday: 1, entries: [e, early, late], routines: [] }).map((b) => b.title)).toEqual(['Starts later']);
  });

  it('adds routines on their days with a window, skipping archived and windowless ones', () => {
    const run = routine({ name: 'Run', window: '06:30-07:00', days: [1, 3, 5] });
    const daily = routine({ name: 'Read', window: '21:00-21:30' });
    const tuesday = routine({ name: 'Swim', window: '07:00-08:00', days: [2] });
    const gone = routine({ name: 'Old', window: '08:00-09:00', archived: true });
    const none = routine({ name: 'Floss' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [], routines: [run, daily, tuesday, gone, none] });
    expect(t.map((b) => [b.title, b.kind, b.start, b.end])).toEqual([
      ['Run', 'routine', '06:30', '07:00'],
      ['Read', 'routine', '21:00', '21:30'],
    ]);
    expect(t[0]?.sub).toBe('Body');
  });

  it('merges plan blocks, drops malformed ones and carries done', () => {
    const plan: PlanBlock[] = [
      { id: 'a', start: '09:00', end: '10:00', text: 'Deep work', pillar: 'WORK', done: true },
      { id: 'b', start: '10:00', end: '09:00', text: 'Backwards' },
      { id: 'c', start: 'soon', end: '11:00', text: 'Bad time' },
    ];
    const t = buildTimeline({ date: MON, weekday: 1, entries: [], routines: [], plan });
    expect(t).toHaveLength(1);
    expect(t[0]).toMatchObject({ kind: 'plan', title: 'Deep work', sub: 'Work', done: true, planId: 'a' });
  });

  it('keeps overlapping blocks, both shown', () => {
    const run = routine({ name: 'Run', window: '14:00-15:00' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [cd], routines: [run] });
    expect(t.map((b) => b.title)).toEqual(['Run', 'Compiler Design']);
  });

  it('clamps an entry that crosses midnight to the end of the day', () => {
    const late = entry({ day: 1, start: '23:00', end: '00:30', title: 'Late lab', kind: 'lab' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [late], routines: [] });
    expect(t[0]).toMatchObject({ start: '23:00', end: '24:00', endMin: 1440 });
  });
});

describe('nowAndNext', () => {
  const run = routine({ name: 'Run', window: '06:30-07:00' });
  const timeline = buildTimeline({ date: MON, weekday: 1, entries: [lunch, cd, os], routines: [run] });

  it('finds the class on now and what is next', () => {
    const r = nowAndNext(timeline, 14 * 60 + 30);
    expect(r.now?.title).toBe('Compiler Design');
    expect(r.next?.title).toBe('Operating System');
    expect(r.freeUntil).toBeUndefined();
  });

  it('treats the end as exclusive and the start as inclusive', () => {
    expect(nowAndNext(timeline, 15 * 60 + 5).now).toBeUndefined();
    expect(nowAndNext(timeline, 14 * 60 + 10).now?.title).toBe('Compiler Design');
    expect(nowAndNext(timeline, 14 * 60 + 9).now).toBeUndefined();
  });

  it('is free until the next block in a gap', () => {
    const r = nowAndNext(timeline, 14 * 60 + 7);
    expect(r.now).toBeUndefined();
    expect(r.freeUntil).toBe('14:10');
    expect(r.next?.title).toBe('Compiler Design');
  });

  it('is free until the first block before the day starts', () => {
    const r = nowAndNext(timeline, 5 * 60);
    expect(r.freeUntil).toBe('06:30');
    expect(r.next?.title).toBe('Run');
  });

  it('has no next and no freeUntil after the last block, including after midnight', () => {
    expect(nowAndNext(timeline, 20 * 60)).toEqual({ now: undefined, next: undefined, freeUntil: undefined });
    expect(nowAndNext(timeline, 1500).now).toBeUndefined();
    expect(nowAndNext(timeline, 1500).freeUntil).toBeUndefined();
  });

  it('shows the break when only a break is on', () => {
    expect(nowAndNext(timeline, 13 * 60 + 30).now?.title).toBe('Lunch break');
  });

  it('prefers class and lab, then plan, then routine, then break', () => {
    const plan: PlanBlock[] = [{ id: 'p', start: '14:00', end: '15:30', text: 'Revise' }];
    const lab = entry({ day: 1, start: '14:00', end: '16:00', title: 'Net lab', kind: 'lab' });
    const rt = routine({ name: 'Stretch', window: '14:00-16:00' });
    const brk = entry({ day: 1, start: '14:00', end: '16:00', title: 'Break', kind: 'break' });

    const all = buildTimeline({ date: MON, weekday: 1, entries: [lab, brk], routines: [rt], plan });
    expect(nowAndNext(all, 14 * 60 + 30).now?.title).toBe('Net lab');

    const noClass = buildTimeline({ date: MON, weekday: 1, entries: [brk], routines: [rt], plan });
    expect(nowAndNext(noClass, 14 * 60 + 30).now?.title).toBe('Revise');
    expect(nowAndNext(noClass, 15 * 60 + 45).now?.title).toBe('Stretch');

    const onlyBreak = buildTimeline({ date: MON, weekday: 1, entries: [brk], routines: [], plan: [] });
    expect(nowAndNext(onlyBreak, 14 * 60 + 30).now?.title).toBe('Break');
  });

  it('shows a routine window during a class as both on the timeline, with the class on now', () => {
    const rt = routine({ name: 'Stretch', window: '14:30-14:45' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [cd], routines: [rt] });
    expect(t).toHaveLength(2);
    expect(nowAndNext(t, 14 * 60 + 35).now?.title).toBe('Compiler Design');
  });

  it('works on an empty day', () => {
    expect(nowAndNext([], 600)).toEqual({ now: undefined, next: undefined, freeUntil: undefined });
  });
});

describe('layoutLanes', () => {
  it('gives overlapping blocks their own columns and lets later blocks reuse them', () => {
    const run = routine({ name: 'Run', window: '14:00-15:00' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [cd, os], routines: [run] });
    const lanes = layoutLanes(t);
    expect(lanes.get('routine:Run')).toEqual({ lane: 0, lanes: 2 });
    expect(lanes.get(`timetable:${cd.id}`)).toEqual({ lane: 1, lanes: 2 });
    expect(lanes.get(`timetable:${os.id}`)).toEqual({ lane: 0, lanes: 1 });
  });

  it('counts a short block as its minimum drawn length', () => {
    const a = entry({ day: 1, start: '10:55', end: '11:00', title: 'A', kind: 'break' });
    const b = entry({ day: 1, start: '11:01', end: '12:00', title: 'B' });
    const t = buildTimeline({ date: MON, weekday: 1, entries: [a, b], routines: [] });
    expect(layoutLanes(t).get(`timetable:${b.id}`)?.lanes).toBe(1);
    expect(layoutLanes(t, 15).get(`timetable:${b.id}`)).toEqual({ lane: 1, lanes: 2 });
  });
});
