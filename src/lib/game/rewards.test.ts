import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, gameRepo, profileRepo, resetAll } from '@/data/repo';
import { PILLARS, type Pillar, type StatDelta } from '@/data/types';
import { applyNightStats } from './apply';
import { pointsForLevel } from './level';
import { appliedPillarPoints, formatGain, nightMoves } from './rewards';

const APPLIED = '2026-10-12T21:00:00.000Z';

function log(routineStats: StatDelta[], stats: StatDelta[], statsAppliedAt: string | null = APPLIED) {
  return { routineStats, stats, statsAppliedAt: statsAppliedAt ?? undefined };
}

function points(p: Partial<Record<Pillar, number>>): Record<Pillar, number> {
  return { BODY: 0, SKIN: 0, MIND: 0, WORK: 0, DOPAMINE: 0, ...p };
}

describe('appliedPillarPoints', () => {
  it('counts pillar lines in full, sub-stat lines as a quarter, and skips skills', () => {
    const out = appliedPillarPoints(
      log(
        [
          { target: 'Body/Strength', delta: 3 },
          { target: 'Work/Focus', delta: -1.5 },
        ],
        [
          { target: 'Body', delta: 2 },
          { target: 'Mind/Calm', delta: 1 },
          { target: 'Running', from: 62, to: 64 },
          { target: 'Skin', delta: 0 },
          { target: 'Nonsense', delta: 4 },
        ],
      ),
    );
    expect(out).toEqual({ BODY: 2.75, SKIN: 0, MIND: 0.25, WORK: -0.375, DOPAMINE: 0 });
  });

  it('is zero everywhere until the night is applied', () => {
    expect(appliedPillarPoints(log([], [{ target: 'Body', delta: 2 }], null))).toEqual(points({}));
  });
});

describe('nightMoves', () => {
  it('reports a level-up when the night crossed a whole level', () => {
    const at8 = pointsForLevel(8);
    const moves = nightMoves(log([], [{ target: 'Body', delta: 2 }]), points({ BODY: at8 + 1, MIND: 30 }));
    expect(moves.BODY.levelUp).toBe(8);
    expect(moves.BODY.beforePoints).toBeCloseTo(at8 - 1, 9);
    expect(moves.BODY.beforeLevel).toBeLessThan(8);
    expect(moves.BODY.afterLevel).toBeGreaterThanOrEqual(8);
    expect(moves.MIND).toMatchObject({ beforePoints: 30, afterPoints: 30, levelUp: undefined });
  });

  it('does not call a move inside one level a level-up, nor a drop', () => {
    const at8 = pointsForLevel(8);
    expect(nightMoves(log([], [{ target: 'Body', delta: 0.5 }]), points({ BODY: at8 + 1 })).BODY.levelUp).toBeUndefined();
    expect(nightMoves(log([], [{ target: 'Body', delta: -2 }]), points({ BODY: at8 - 1 })).BODY.levelUp).toBeUndefined();
  });

  it('never puts "before" below zero', () => {
    expect(nightMoves(log([], [{ target: 'Skin', delta: 5 }]), points({ SKIN: 2 })).SKIN.beforePoints).toBe(0);
  });
});

describe('nightMoves against applyNightStats', () => {
  const DATE = '2026-10-12';
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
    for (const s of await db.subStatState.toArray()) await gameRepo.setSubStatPoints(s.pillar, s.name, 20);
    await dayLogRepo.update(DATE, {
      routineStats: [
        { target: 'Body/Strength', delta: 3 },
        { target: 'Work/Focus', delta: -1.5 },
      ],
      stats: [
        { target: 'Body', delta: 2 },
        { target: 'Mind/Calm', delta: 1 },
      ],
    });
  });

  it('recovers the points each pillar had before the night', async () => {
    const before = await gameRepo.pillars();
    await applyNightStats(DATE);
    const after = await gameRepo.pillars();
    const applied = await dayLogRepo.get(DATE);
    if (!applied) throw new Error('log missing');
    const moves = nightMoves(applied, points(Object.fromEntries(PILLARS.map((p) => [p, after[p].points]))));
    for (const p of PILLARS) expect(moves[p].beforePoints).toBeCloseTo(before[p].points, 9);
  });
});

describe('formatGain', () => {
  it('signs and trims', () => {
    expect(formatGain(2)).toBe('+2');
    expect(formatGain(0.25)).toBe('+0.3');
    expect(formatGain(-1)).toBe('-1');
    expect(formatGain(0)).toBe('0');
  });
});
