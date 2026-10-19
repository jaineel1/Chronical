/**
 * Daily routine scoring.
 *
 *   pillar delta = Σ weights of routines done − 0.5 × Σ weights of scheduled routines skipped,
 *                  floored at −5 per pillar.
 *
 * Deltas are produced at sub-stat granularity ("Body/Endurance") so a run moves Endurance and a
 * gym session moves Strength. A shielded miss costs nothing. A routine done on a day it was not
 * scheduled still earns its weight; skipping it on such a day costs nothing.
 */
import { DEFAULT_ROLLOVER_HOUR, weekdayOf } from '@/lib/dates';
import { PILLARS, PILLAR_LABEL, SUBSTATS, pillarFromLabel, type Pillar, type Routine, type RoutineLog, type StatDelta } from '@/data/types';
import { gameDayOf } from './calendar';

/** The most a pillar can lose to skipped routines in one night. */
export const PILLAR_FLOOR = -5;

/* ------------------------------------------------------------------ */
/* Targets                                                             */
/* ------------------------------------------------------------------ */

export type ResolvedTarget =
  | { kind: 'pillar'; pillar: Pillar }
  | { kind: 'sub'; pillar: Pillar; sub: string }
  | { kind: 'other'; name: string };

/** "Body" → pillar, "body/endurance" → sub-stat (canonical casing), anything else → a skill or unknown name. */
export function resolveTarget(target: string): ResolvedTarget {
  const raw = target.trim();
  const slash = raw.indexOf('/');
  if (slash >= 0) {
    const pillar = pillarFromLabel(raw.slice(0, slash));
    const wanted = raw.slice(slash + 1).trim().toLowerCase();
    const sub = pillar ? SUBSTATS[pillar].find((s) => s.toLowerCase() === wanted) : undefined;
    return pillar && sub ? { kind: 'sub', pillar, sub } : { kind: 'other', name: raw };
  }
  const pillar = pillarFromLabel(raw);
  return pillar ? { kind: 'pillar', pillar } : { kind: 'other', name: raw };
}

/** The routine's sub-stat in canonical casing; falls back to the pillar's first sub-stat if it is not one of the four. */
export function canonicalSubStat(pillar: Pillar, name: string): string {
  const wanted = name.trim().toLowerCase();
  return SUBSTATS[pillar].find((s) => s.toLowerCase() === wanted) ?? SUBSTATS[pillar][0];
}

/** "Body/Strength" for a gym routine. */
export function routineTarget(routine: Pick<Routine, 'pillar' | 'subStat'>): string {
  return `${PILLAR_LABEL[routine.pillar]}/${canonicalSubStat(routine.pillar, routine.subStat)}`;
}

/* ------------------------------------------------------------------ */
/* Scheduling                                                          */
/* ------------------------------------------------------------------ */

/** Empty `days` means every day. */
export function isScheduled(routine: Pick<Routine, 'days'>, weekday: number): boolean {
  return routine.days.length === 0 || routine.days.includes(weekday);
}

/**
 * A routine only counts on days it existed: it was created on or before that game day, or it
 * already has a log on or before it (imported or seeded history).
 */
export function existedOn(routine: Pick<Routine, 'createdAt'>, date: string, rolloverHour = DEFAULT_ROLLOVER_HOUR, earliestLog?: string): boolean {
  if (earliestLog && earliestLog <= date) return true;
  return gameDayOf(routine.createdAt, rolloverHour) <= date;
}

/* ------------------------------------------------------------------ */
/* Scoring                                                             */
/* ------------------------------------------------------------------ */

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Routine deltas for one day, one line per sub-stat that moved, in pillar and sub-stat order.
 * `logsForDate` may contain other days' logs; only `date` is read.
 */
export function computeRoutineStats(
  routines: Routine[],
  logsForDate: RoutineLog[],
  date: string,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): StatDelta[] {
  const weekday = weekdayOf(date);
  const logs = new Map(logsForDate.filter((l) => l.date === date).map((l) => [l.routineId, l]));
  const sums = new Map<string, number>();

  for (const routine of routines) {
    if (routine.archived) continue;
    const log = logs.get(routine.id);
    if (!log && !existedOn(routine, date, rolloverHour)) continue;
    const weight = Math.max(0, routine.weight);
    let delta = 0;
    if (log?.done) delta = weight;
    else if (isScheduled(routine, weekday) && !log?.shielded) delta = -0.5 * weight;
    if (delta === 0) continue;
    const target = routineTarget(routine);
    sums.set(target, (sums.get(target) ?? 0) + delta);
  }

  const out: StatDelta[] = [];
  for (const pillar of PILLARS) {
    const lines = SUBSTATS[pillar]
      .map((sub) => ({ target: `${PILLAR_LABEL[pillar]}/${sub}`, delta: sums.get(`${PILLAR_LABEL[pillar]}/${sub}`) ?? 0 }))
      .filter((l) => l.delta !== 0);
    out.push(...floorPillar(lines));
  }
  return out;
}

/** Scale a pillar's negative lines so the pillar never loses more than PILLAR_FLOOR in a night. */
function floorPillar(lines: { target: string; delta: number }[]): StatDelta[] {
  const total = lines.reduce((a, l) => a + l.delta, 0);
  if (total >= PILLAR_FLOOR) return lines.map((l) => ({ target: l.target, delta: round2(l.delta) }));
  const positive = lines.filter((l) => l.delta > 0).reduce((a, l) => a + l.delta, 0);
  const negative = lines.filter((l) => l.delta < 0).reduce((a, l) => a + l.delta, 0);
  const factor = (PILLAR_FLOOR - positive) / negative;
  const scaled = lines.map((l) => ({ target: l.target, delta: l.delta < 0 ? round2(l.delta * factor) : round2(l.delta) }));
  // Rounding can leave a cent of drift; settle it on the largest loss so the pillar sums to the floor exactly.
  const drift = round2(PILLAR_FLOOR - scaled.reduce((a, l) => a + l.delta, 0));
  if (drift !== 0) {
    const worst = scaled.reduce((w, l) => (l.delta < w.delta ? l : w));
    worst.delta = round2(worst.delta + drift);
  }
  return scaled;
}

/**
 * Per-pillar totals for display ("since last night"). Every line counts once: pillar lines and
 * sub-stat lines add their delta to their pillar; skill lines ("Running 62 -> 64") are ignored.
 */
export function pillarTotals(stats: readonly StatDelta[]): Record<Pillar, number> {
  const out = { BODY: 0, SKIN: 0, MIND: 0, WORK: 0, DOPAMINE: 0 } as Record<Pillar, number>;
  for (const s of stats) {
    if (typeof s.delta !== 'number' || !Number.isFinite(s.delta)) continue;
    const t = resolveTarget(s.target);
    if (t.kind === 'pillar' || t.kind === 'sub') out[t.pillar] += s.delta;
  }
  for (const p of PILLARS) out[p] = round2(out[p]);
  return out;
}
