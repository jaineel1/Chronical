import { describe, expect, it } from 'vitest';
import { canonicalSubStat, computeRoutineStats, isScheduled, pillarTotals, resolveTarget, routineTarget } from './daily';
import { makeLog, makeRoutine } from './testkit';

// 2026-10-12 is a Monday, 2026-10-18 a Sunday.
const MON = '2026-10-12';
const SUN = '2026-10-18';

describe('resolveTarget', () => {
  it('maps pillars and sub-stats to canonical names', () => {
    expect(resolveTarget('Body')).toEqual({ kind: 'pillar', pillar: 'BODY' });
    expect(resolveTarget(' dopamine ')).toEqual({ kind: 'pillar', pillar: 'DOPAMINE' });
    expect(resolveTarget('body/endurance')).toEqual({ kind: 'sub', pillar: 'BODY', sub: 'Endurance' });
    expect(resolveTarget('Work / Focus')).toEqual({ kind: 'sub', pillar: 'WORK', sub: 'Focus' });
  });
  it('treats anything else as a skill or unknown name', () => {
    expect(resolveTarget('Running')).toEqual({ kind: 'other', name: 'Running' });
    expect(resolveTarget('Body/Flexibility')).toEqual({ kind: 'other', name: 'Body/Flexibility' });
  });
  it('canonicalises routine sub-stats and falls back to the first one', () => {
    expect(canonicalSubStat('MIND', 'learning')).toBe('Learning');
    expect(canonicalSubStat('SKIN', 'nonsense')).toBe('Routine');
    expect(routineTarget({ pillar: 'BODY', subStat: 'endurance' })).toBe('Body/Endurance');
  });
  it('empty days means every day', () => {
    expect(isScheduled({ days: [] }, 3)).toBe(true);
    expect(isScheduled({ days: [1, 2] }, 0)).toBe(false);
  });
});

describe('computeRoutineStats', () => {
  it('adds the weight for done, takes half for a scheduled skip, nothing for a shielded skip', () => {
    const routines = [
      makeRoutine({ id: 'gym', pillar: 'BODY', subStat: 'Strength', weight: 3 }),
      makeRoutine({ id: 'run', pillar: 'BODY', subStat: 'Endurance', weight: 3 }),
      makeRoutine({ id: 'skin', pillar: 'SKIN', subStat: 'Routine', weight: 2 }),
      makeRoutine({ id: 'deep', pillar: 'WORK', subStat: 'Focus', weight: 3 }),
    ];
    const logs = [makeLog('gym', MON, true), makeLog('run', MON, false), makeLog('skin', MON, false, true)];
    expect(computeRoutineStats(routines, logs, MON)).toEqual([
      { target: 'Body/Strength', delta: 3 },
      { target: 'Body/Endurance', delta: -1.5 },
      { target: 'Work/Focus', delta: -1.5 },
    ]);
  });

  it('ignores unscheduled skips but still pays for unscheduled work', () => {
    const routines = [
      makeRoutine({ id: 'run', subStat: 'Endurance', days: [1, 3, 5] }),
      makeRoutine({ id: 'gym', subStat: 'Strength', days: [1, 3, 5], weight: 2 }),
    ];
    const logs = [makeLog('gym', SUN, true)];
    expect(computeRoutineStats(routines, logs, SUN)).toEqual([{ target: 'Body/Strength', delta: 2 }]);
  });

  it('sums routines that share a sub-stat and reads only the given date', () => {
    const routines = [
      makeRoutine({ id: 'a', pillar: 'MIND', subStat: 'Learning', weight: 1 }),
      makeRoutine({ id: 'b', pillar: 'MIND', subStat: 'learning', weight: 2 }),
    ];
    const logs = [makeLog('a', MON, true), makeLog('b', MON, true), makeLog('a', SUN, false)];
    expect(computeRoutineStats(routines, logs, MON)).toEqual([{ target: 'Mind/Learning', delta: 3 }]);
  });

  it('floors a pillar at -5 by scaling its losses', () => {
    const routines = [
      makeRoutine({ id: 'a', subStat: 'Strength', weight: 5 }),
      makeRoutine({ id: 'b', subStat: 'Endurance', weight: 5 }),
      makeRoutine({ id: 'c', subStat: 'Recovery', weight: 4 }),
      makeRoutine({ id: 'd', subStat: 'Nutrition', weight: 1 }),
      makeRoutine({ id: 'e', pillar: 'MIND', subStat: 'Calm', weight: 5 }),
    ];
    const logs = [makeLog('d', MON, true)];
    const stats = computeRoutineStats(routines, logs, MON);
    const body = stats.filter((s) => s.target.startsWith('Body/'));
    // Losses were -2.5, -2.5, -2 against +1: scaled by 6/7 so Body totals exactly -5.
    expect(body.reduce((a, s) => a + (s.delta ?? 0), 0)).toBeCloseTo(-5, 10);
    expect(body.find((s) => s.target === 'Body/Nutrition')?.delta).toBe(1);
    expect(body.find((s) => s.target === 'Body/Strength')?.delta).toBeCloseTo(-2.14, 1);
    expect(body.find((s) => s.target === 'Body/Recovery')?.delta).toBeCloseTo(-1.71, 1);
    // Mind has one -2.5 loss: above the floor, untouched.
    expect(stats.find((s) => s.target === 'Mind/Calm')?.delta).toBe(-2.5);
    expect(pillarTotals(stats).BODY).toBe(-5);
  });

  it('leaves a pillar alone when the floor does not bite', () => {
    const routines = [makeRoutine({ id: 'a', weight: 5, subStat: 'Strength' }), makeRoutine({ id: 'b', weight: 5, subStat: 'Endurance' })];
    const stats = computeRoutineStats(routines, [], MON);
    expect(stats).toEqual([
      { target: 'Body/Strength', delta: -2.5 },
      { target: 'Body/Endurance', delta: -2.5 },
    ]);
  });

  it('skips archived routines and routines that did not exist yet', () => {
    const routines = [
      makeRoutine({ id: 'old', archived: true }),
      makeRoutine({ id: 'future', createdAt: '2026-10-15T09:00:00.000Z' }),
      makeRoutine({ id: 'seeded', subStat: 'Recovery', createdAt: '2026-10-15T09:00:00.000Z' }),
    ];
    // A log on the day proves the routine existed even if its row is newer (imports, demo history).
    const logs = [makeLog('seeded', MON, true)];
    expect(computeRoutineStats(routines, logs, MON, 4)).toEqual([{ target: 'Body/Recovery', delta: 3 }]);
  });

  it('keeps pillar and sub-stat order stable', () => {
    const routines = [
      makeRoutine({ id: 'dop', pillar: 'DOPAMINE', subStat: 'Joy', weight: 1 }),
      makeRoutine({ id: 'body', pillar: 'BODY', subStat: 'Nutrition', weight: 1 }),
      makeRoutine({ id: 'body2', pillar: 'BODY', subStat: 'Strength', weight: 1 }),
    ];
    const logs = routines.map((r) => makeLog(r.id, MON, true));
    expect(computeRoutineStats(routines, logs, MON).map((s) => s.target)).toEqual(['Body/Strength', 'Body/Nutrition', 'Dopamine/Joy']);
  });
});

describe('pillarTotals', () => {
  it('counts every pillar and sub-stat line once and ignores skills', () => {
    const totals = pillarTotals([
      { target: 'Body/Strength', delta: 3 },
      { target: 'Body/Endurance', delta: -1.5 },
      { target: 'Body', delta: 2 },
      { target: 'Mind', delta: -1 },
      { target: 'Running', from: 62, to: 64 },
      { target: 'Swimming', delta: 4 },
      { target: 'Work', delta: 0 },
    ]);
    expect(totals).toEqual({ BODY: 3.5, SKIN: 0, MIND: -1, WORK: 0, DOPAMINE: 0 });
  });
  it('rounds away float noise', () => {
    expect(pillarTotals([{ target: 'Skin', delta: 0.1 }, { target: 'Skin', delta: 0.2 }]).SKIN).toBe(0.3);
  });
});
