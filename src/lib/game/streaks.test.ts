import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { profileRepo, resetAll, routineLogRepo } from '@/data/repo';
import type { RoutineLog } from '@/data/types';
import { closeNight, formatStreak, planClose, streakFromLogs } from './streaks';
import { makeLog, makeRoutine } from './testkit';

// 2026-10-05 and 2026-10-12 are Mondays; 2026-10-18 is a Sunday.
const days = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => `2026-10-${String(from + i).padStart(2, '0')}`);

describe('streakFromLogs', () => {
  const gym = makeRoutine({ id: 'gym', days: [1, 2, 3, 4, 5, 6] }); // Mon-Sat

  it('counts consecutive scheduled days done and skips unscheduled days', () => {
    // Mon 5 .. Sat 10 done, Sun 11 not scheduled, Mon 12 .. Wed 14 done.
    const logs = [...days(5, 10), ...days(12, 14)].map((d) => makeLog('gym', d, true));
    expect(streakFromLogs(gym, logs, '2026-10-14')).toBe(9);
    // Sunday is unscheduled, so asking from Sunday counts back through Saturday.
    expect(streakFromLogs(gym, logs, '2026-10-11')).toBe(6);
  });

  it('a miss breaks it, a shielded miss does not', () => {
    const logs: RoutineLog[] = [
      makeLog('gym', '2026-10-05', true),
      makeLog('gym', '2026-10-06', true),
      makeLog('gym', '2026-10-07', false),
      makeLog('gym', '2026-10-08', true),
      makeLog('gym', '2026-10-09', false, true),
      makeLog('gym', '2026-10-10', true),
    ];
    expect(streakFromLogs(gym, logs, '2026-10-10')).toBe(2);
    // A scheduled day with no log at all is a miss too.
    expect(streakFromLogs(gym, logs, '2026-10-13')).toBe(0);
  });

  it('can leave tonight open until it is closed', () => {
    const logs = days(5, 10).map((d) => makeLog('gym', d, true));
    expect(streakFromLogs(gym, logs, '2026-10-12')).toBe(0);
    expect(streakFromLogs(gym, logs, '2026-10-12', { todayPending: true })).toBe(6);
    expect(streakFromLogs(gym, [...logs, makeLog('gym', '2026-10-12', true)], '2026-10-12', { todayPending: true })).toBe(7);
  });

  it('ignores other routines and returns 0 without history', () => {
    expect(streakFromLogs(gym, [makeLog('run', '2026-10-12', true)], '2026-10-12')).toBe(0);
  });

  it('formats', () => {
    expect(formatStreak(0)).toBe('new');
    expect(formatStreak(1)).toBe('1 day');
    expect(formatStreak(14)).toBe('14 days');
  });
});

describe('planClose', () => {
  const gym = makeRoutine({ id: 'gym', name: 'Gym', days: [1, 2, 3, 4, 5, 6], weight: 3 });
  const read = makeRoutine({ id: 'read', name: 'Read', pillar: 'MIND', subStat: 'Learning', weight: 1 });
  const history = days(5, 10).map((d) => makeLog('gym', d, true));

  it('uses the week shield on the first miss and keeps the streak', () => {
    const plan = planClose([gym], history, '2026-10-12');
    expect(plan.writes).toEqual([{ routineId: 'gym', done: false, shielded: true }]);
    expect(plan.warnings).toEqual(['Gym: shield used, none left this week']);
    expect(plan.routineStats).toEqual([]);
    expect(plan.outcomes[0]).toMatchObject({ status: 'shielded', streakBefore: 6, streak: 6, shieldsLeft: 0 });
  });

  it('breaks the streak on a second miss in the same week, with a warning and the half-weight cost', () => {
    const logs = [...history, makeLog('gym', '2026-10-12', false, true), makeLog('gym', '2026-10-13', true)];
    const plan = planClose([gym], logs, '2026-10-14');
    expect(plan.writes).toEqual([{ routineId: 'gym', done: false, shielded: false }]);
    expect(plan.warnings).toEqual(['Gym streak broken at 7 days']);
    expect(plan.routineStats).toEqual([{ target: 'Body/Strength', delta: -1.5 }]);
    expect(plan.outcomes[0]).toMatchObject({ status: 'missed', streak: 0 });
  });

  it('gives the shield back in a new week', () => {
    const logs = [...history.filter((l) => l.date !== '2026-10-07'), makeLog('gym', '2026-10-07', false, true)];
    expect(planClose([gym], logs, '2026-10-12').outcomes[0]?.status).toBe('shielded');
  });

  it('is stable on a night that is already closed', () => {
    const logs = [...history, makeLog('gym', '2026-10-12', false, true)];
    const plan = planClose([gym], logs, '2026-10-12');
    expect(plan.writes).toEqual([]);
    expect(plan.warnings).toEqual(['Gym: shield used, none left this week']);
  });

  it('returns the shield when a routine is ticked after its shield was used', () => {
    const logs = [...history, makeLog('gym', '2026-10-12', true, true)];
    const plan = planClose([gym], logs, '2026-10-12');
    expect(plan.writes).toEqual([{ routineId: 'gym', done: true, shielded: false }]);
    expect(plan.outcomes[0]).toMatchObject({ status: 'done', streak: 7, shieldsLeft: 1 });
    expect(plan.routineStats).toEqual([{ target: 'Body/Strength', delta: 3 }]);
  });

  it('does not warn about a streak that was already zero, and leaves unscheduled routines alone', () => {
    const logs = [makeLog('read', '2026-10-10', false, true)];
    const plan = planClose([gym, read], [...logs], '2026-10-11'); // Sunday: gym is off
    const byId = Object.fromEntries(plan.outcomes.map((o) => [o.routine.id, o]));
    expect(byId.gym?.status).toBe('off');
    expect(byId.read?.status).toBe('missed');
    expect(plan.warnings).toEqual([]);
  });
});

describe('closeNight (store)', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
  });

  it('records shields and misses, refreshes the routine cache, and is idempotent', async () => {
    const gym = makeRoutine({ id: 'gym', name: 'Gym', days: [1, 2, 3, 4, 5, 6], weight: 3, streak: 99 });
    const skin = makeRoutine({ id: 'skin', name: 'Evening skincare', pillar: 'SKIN', subStat: 'Routine', weight: 2 });
    await db.routines.bulkPut([gym, skin]);
    for (const d of days(5, 10)) await routineLogRepo.set('gym', d, true);
    await routineLogRepo.set('skin', '2026-10-12', true);

    const first = await closeNight('2026-10-12');
    expect(first.warnings).toEqual(['Gym: shield used, none left this week']);
    expect(first.routineStats).toEqual([{ target: 'Skin/Routine', delta: 2 }]);
    const gymLog = await routineLogRepo.get('gym', '2026-10-12');
    expect(gymLog).toMatchObject({ done: false, shielded: true });
    const stored = await db.routines.get('gym');
    expect(stored).toMatchObject({ streak: 6, shields: 0, shieldWeek: '2026-W42', lastDoneDate: '2026-10-10' });

    const again = await closeNight('2026-10-12');
    expect(again).toEqual(first);
    expect(await db.routineLogs.where('date').equals('2026-10-12').count()).toBe(2);

    // Tuesday: the shield is gone, so this miss breaks the streak.
    const tuesday = await closeNight('2026-10-13');
    expect(tuesday.warnings).toEqual(['Gym streak broken at 6 days', 'Evening skincare: shield used, none left this week']);
    expect(tuesday.routineStats).toEqual([{ target: 'Body/Strength', delta: -1.5 }]);
    expect(await db.routines.get('gym')).toMatchObject({ streak: 0, shields: 0 });
  });

  it('refunds a shield when the routine is ticked and the night closed again', async () => {
    const gym = makeRoutine({ id: 'gym', name: 'Gym', days: [1, 2, 3, 4, 5, 6] });
    await db.routines.put(gym);
    for (const d of days(5, 10)) await routineLogRepo.set('gym', d, true);
    await closeNight('2026-10-12');
    await routineLogRepo.set('gym', '2026-10-12', true);
    const res = await closeNight('2026-10-12');
    expect(res.warnings).toEqual([]);
    expect(res.routineStats).toEqual([{ target: 'Body/Strength', delta: 3 }]);
    expect(await routineLogRepo.get('gym', '2026-10-12')).toMatchObject({ done: true, shielded: false });
    expect(await db.routines.get('gym')).toMatchObject({ streak: 7, shields: 1, lastDoneDate: '2026-10-12' });
  });
});

describe('summariseNightWarnings', () => {
  it('folds several shield lines into one and keeps the rest', async () => {
    const { summariseNightWarnings } = await import('./streaks');
    expect(summariseNightWarnings(['Gym: shield used, none left this week'])).toEqual(['Gym: shield used, none left this week']);
    expect(
      summariseNightWarnings([
        'Run, 8 km at 5:52: shield used, none left this week',
        'Gym streak broken at 14 days',
        'Evening skincare: shield used, none left this week',
        'Read: shield used, none left this week',
      ]),
    ).toEqual(['Gym streak broken at 14 days', 'Shields used on Run, Evening skincare and Read. None left this week for them.']);
  });
});
