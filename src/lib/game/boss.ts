/**
 * The weekly boss: set by the weekly review (## BOSS), stored on that week's Digest, and fought
 * over the seven days after the reviewed period.
 *
 *   damage = Σ routine.weight for every weak-to routine logged done during the boss's week
 *   HP     ≈ 70% of what doing every weak-to routine on each of its scheduled days would deal
 *            (Claude sets it from the numbers the prompt gives; see BOSS_HP_SHARE)
 *
 * Pure functions only; the Morning card reads rows through features/morning/bossQueries.ts.
 */
import type { Digest, Routine, RoutineLog } from '@/data/types';
import { addDays, weekdayOf } from '@/lib/dates';

export type WeeklyBoss = NonNullable<Digest['boss']>;

/** Share of a full-clear week the boss's HP should be, so a good week beats it and a lazy one does not. */
export const BOSS_HP_SHARE = 0.7;

/** The boss fights the seven days after the reviewed period. */
export function bossWeek(periodEnd: string): { start: string; end: string } {
  return { start: addDays(periodEnd, 1), end: addDays(periodEnd, 7) };
}

/** Days in [start, end] the routine is scheduled. An empty `days` list means every day. */
export function scheduledDays(routine: Pick<Routine, 'days'>, start: string, end: string): number {
  let n = 0;
  for (let d = start; d <= end; d = addDays(d, 1)) {
    if (routine.days.length === 0 || routine.days.includes(weekdayOf(d))) n++;
  }
  return n;
}

/** Damage if the routine is done on every scheduled day of [start, end]. */
export function fullWeekDamage(routine: Pick<Routine, 'days' | 'weight'>, start: string, end: string): number {
  return routine.weight * scheduledDays(routine, start, end);
}

function key(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Match Claude's weak-to names to the player's routines (case and punctuation ignored). */
export function matchWeakTo(names: string[], routines: Pick<Routine, 'id' | 'name'>[]): WeeklyBoss['weakTo'] {
  return names.map((name) => {
    const r = routines.find((x) => key(x.name) === key(name));
    return r ? { name, routineId: r.id } : { name };
  });
}

function findRoutine<R extends Pick<Routine, 'id' | 'name'>>(w: WeeklyBoss['weakTo'][number], routines: R[]): R | undefined {
  return (w.routineId ? routines.find((r) => r.id === w.routineId) : undefined) ?? routines.find((r) => key(r.name) === key(w.name));
}

export interface BossHit {
  name: string;
  routineId?: string;
  /** The routine's weight now; 0 when the name matches none of the player's routines. */
  weight: number;
  /** Times logged done during the boss's week. */
  times: number;
  damage: number;
}

export interface BossState {
  hp: number;
  dealt: number;
  /** HP left, never below 0. */
  remaining: number;
  defeated: boolean;
  hits: BossHit[];
}

/** HP and damage so far, from the routine logs that fall inside the boss's week. */
export function bossState(
  boss: Pick<WeeklyBoss, 'hp' | 'weakTo' | 'start' | 'end'>,
  routines: Pick<Routine, 'id' | 'name' | 'weight'>[],
  logs: Pick<RoutineLog, 'routineId' | 'date' | 'done'>[],
): BossState {
  const doneDays = new Map<string, Set<string>>();
  for (const l of logs) {
    if (!l.done || l.date < boss.start || l.date > boss.end) continue;
    const set = doneDays.get(l.routineId) ?? new Set<string>();
    set.add(l.date);
    doneDays.set(l.routineId, set);
  }
  const seen = new Set<string>();
  const hits: BossHit[] = boss.weakTo.map((w) => {
    const r = findRoutine(w, routines);
    // The same routine named twice deals its damage once.
    if (!r || seen.has(r.id)) return { name: w.name, routineId: r?.id, weight: r?.weight ?? 0, times: 0, damage: 0 };
    seen.add(r.id);
    const times = doneDays.get(r.id)?.size ?? 0;
    return { name: r.name, routineId: r.id, weight: r.weight, times, damage: times * r.weight };
  });
  const dealt = hits.reduce((s, h) => s + h.damage, 0);
  const remaining = Math.max(0, boss.hp - dealt);
  return { hp: boss.hp, dealt, remaining, defeated: remaining === 0, hits };
}

/**
 * The boss to show on `today`: from the newest weekly digest whose boss week has not ended. It
 * shows from the review day (the day before its week starts) so the player sees it right away.
 */
export function activeBoss(digests: Pick<Digest, 'kind' | 'periodEnd' | 'boss'>[], today: string): WeeklyBoss | undefined {
  const live = digests
    .filter((d): d is typeof d & { boss: WeeklyBoss } => d.kind === 'weekly' && !!d.boss && d.periodEnd <= today && today <= d.boss.end)
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd));
  return live[0]?.boss;
}

/** Days left in the fight including today, or 0 before it starts / after it ends. */
export function daysLeft(boss: Pick<WeeklyBoss, 'start' | 'end'>, today: string): number {
  if (today < boss.start || today > boss.end) return 0;
  let n = 0;
  for (let d = today; d <= boss.end; d = addDays(d, 1)) n++;
  return n;
}
