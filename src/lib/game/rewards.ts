/**
 * Reward moments: what a night actually did to each pillar, worked backwards from the points
 * the player has now.
 *
 * `applyNightStats` moves points line by line: a pillar line ("Body +2") adds its delta to all four
 * sub-stats, so the pillar (the mean of its sub-stats) moves by the full delta; a sub-stat line
 * ("Body/Endurance +2") moves one sub-stat, so the pillar moves by delta / 4. Skill lines move no
 * pillar. Nothing is applied until `statsAppliedAt` is set.
 *
 * Sub-stats are floored at 0 when points are added, so a night that pushed a sub-stat below zero
 * moved it less than its line says; "before" is then slightly overstated, never below 0.
 */
import { PILLARS, SUBSTATS, type DayLog, type Pillar } from '@/data/types';
import { resolveTarget } from './daily';
import { displayLevel, levelFromPoints } from './level';

/** Pillar points each pillar gained (or lost) from this night's applied lines. Zero for all if nothing was applied. */
export function appliedPillarPoints(log: Pick<DayLog, 'routineStats' | 'stats' | 'statsAppliedAt'>): Record<Pillar, number> {
  const out = { BODY: 0, SKIN: 0, MIND: 0, WORK: 0, DOPAMINE: 0 } as Record<Pillar, number>;
  if (!log.statsAppliedAt) return out;
  for (const line of [...(log.routineStats ?? []), ...log.stats]) {
    if (typeof line.delta !== 'number' || !Number.isFinite(line.delta) || line.delta === 0) continue;
    const t = resolveTarget(line.target);
    if (t.kind === 'pillar') out[t.pillar] += line.delta;
    else if (t.kind === 'sub') out[t.pillar] += line.delta / SUBSTATS[t.pillar].length;
  }
  return out;
}

export interface PillarMove {
  beforePoints: number;
  afterPoints: number;
  /** Display levels (one decimal), as the pillar bars show them. */
  beforeLevel: number;
  afterLevel: number;
  /** The whole level reached when the night crossed one, else undefined. */
  levelUp: number | undefined;
}

/** Before and after for every pillar, given the pillar points now. */
export function nightMoves(
  log: Pick<DayLog, 'routineStats' | 'stats' | 'statsAppliedAt'>,
  pointsNow: Record<Pillar, number>,
): Record<Pillar, PillarMove> {
  const applied = appliedPillarPoints(log);
  const out = {} as Record<Pillar, PillarMove>;
  for (const p of PILLARS) {
    const afterPoints = pointsNow[p];
    const beforePoints = Math.max(0, afterPoints - applied[p]);
    const before = Math.floor(levelFromPoints(beforePoints));
    const after = Math.floor(levelFromPoints(afterPoints));
    out[p] = {
      beforePoints,
      afterPoints,
      beforeLevel: displayLevel(beforePoints),
      afterLevel: displayLevel(afterPoints),
      levelUp: after > before ? after : undefined,
    };
  }
  return out;
}

/** "+2", "+0.5", "-1". */
export function formatGain(n: number): string {
  const r = Math.round(n * 10) / 10;
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(1);
  return r > 0 ? `+${s}` : r < 0 ? `-${s}` : '0';
}
