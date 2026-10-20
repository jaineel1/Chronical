/**
 * Badges earned from the player's real history. Nothing here is stored: every badge is computed
 * from the rows on each read, so it works with synced devices, imported backups and old data.
 *
 * (Named "badges" in code because `Achievement` is already the skill-achievement row type.)
 */
import type { DayLog, Meal, Photo, Routine, RoutineLog } from '@/data/types';
import { addDays, weekdayOf } from '@/lib/dates';
import { isScheduled } from './daily';
import { levelFromPoints } from './level';

export type BadgeSprite = 'flame' | 'moon' | 'letter' | 'shoe' | 'drop' | 'dumbbell' | 'bowl' | 'camera' | 'star' | 'flag';

export interface BadgeInput {
  routines: readonly Pick<Routine, 'id' | 'days' | 'streak'>[];
  routineLogs: readonly Pick<RoutineLog, 'routineId' | 'date' | 'done' | 'shielded'>[];
  dayLogs: readonly Pick<DayLog, 'date' | 'closedAt' | 'briefMd' | 'steps' | 'waterL' | 'workoutType' | 'workoutMin' | 'quests'>[];
  meals: readonly Pick<Meal, 'date' | 'nutrition'>[];
  photos: readonly Pick<Photo, 'date'>[];
  /** Points of each pillar (pillarState.points). */
  pillarPoints: readonly number[];
}

export interface Badge {
  id: string;
  name: string;
  /** The rule in one line, e.g. "Close 7 nights". */
  rule: string;
  sprite: BadgeSprite;
  earned: boolean;
  /** Day key the badge was earned, when the history shows it. */
  earnedOn?: string;
  current: number;
  target: number;
  /** Progress readout while locked, e.g. "5 of 7 nights". */
  progress: string;
}

export const STEPS_GOAL = 10_000;
export const PILLAR_LEVEL_GOAL = 10;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

/** Day keys, sorted and unique, of the rows that pass `test`. */
function daysWhere<T extends { date: string }>(rows: readonly T[], test: (row: T) => boolean): string[] {
  const set = new Set<string>();
  for (const r of rows) if (test(r)) set.add(r.date);
  return [...set].sort();
}

/** A count badge: earned on the `target`-th day of `days` (sorted day keys). */
function countBadge(base: Omit<Badge, 'earned' | 'earnedOn' | 'current' | 'progress'>, days: readonly string[], unit: string): Badge {
  const current = Math.min(days.length, base.target);
  const earned = days.length >= base.target;
  return {
    ...base,
    earned,
    earnedOn: earned ? days[base.target - 1] : undefined,
    current,
    progress: `${current} of ${base.target} ${unit}`,
  };
}

export interface StreakRecord {
  /** Longest run of done scheduled days. */
  longest: number;
  /** Day key on which a run first reached each length, for the lengths asked for. */
  reachedOn: Map<number, string>;
}

/**
 * Longest streak of one routine, walked from its logs with the same rules as `streakFromLogs`:
 * scheduled days count when done, shielded misses keep the run, unscheduled days are skipped,
 * and a scheduled day without a done or shielded log ends it.
 */
export function longestStreak(
  routine: Pick<Routine, 'id' | 'days'>,
  logs: readonly Pick<RoutineLog, 'routineId' | 'date' | 'done' | 'shielded'>[],
  lengths: readonly number[] = [],
): StreakRecord {
  const byDate = new Map<string, { done: boolean; shielded: boolean }>();
  let first: string | undefined;
  let last: string | undefined;
  for (const l of logs) {
    if (l.routineId !== routine.id) continue;
    byDate.set(l.date, l);
    if (!first || l.date < first) first = l.date;
    if (!last || l.date > last) last = l.date;
  }
  const reachedOn = new Map<number, string>();
  if (!first || !last) return { longest: 0, reachedOn };

  let run = 0;
  let longest = 0;
  // The walk ends at the last log; ten years is a safety net.
  for (let day = first, i = 0; day <= last && i < 3660; day = addDays(day, 1), i++) {
    if (!isScheduled(routine, weekdayOf(day))) continue;
    const log = byDate.get(day);
    if (log?.done) {
      run++;
      if (run > longest) longest = run;
      for (const n of lengths) if (run === n && !reachedOn.has(n)) reachedOn.set(n, day);
    } else if (!log?.shielded) {
      run = 0;
    }
  }
  return { longest, reachedOn };
}

function streakBadge(id: string, name: string, target: number, input: BadgeInput): Badge {
  let best = 0;
  let earnedOn: string | undefined;
  for (const r of input.routines) {
    const rec = longestStreak(r, input.routineLogs, [target]);
    // The cached streak on the routine counts too (seeded or imported history without logs).
    best = Math.max(best, rec.longest, r.streak);
    const on = rec.reachedOn.get(target);
    if (on && (!earnedOn || on < earnedOn)) earnedOn = on;
  }
  const earned = best >= target;
  const current = Math.min(best, target);
  return {
    id,
    name,
    rule: `Keep any routine going ${target} scheduled days in a row`,
    sprite: 'flame',
    earned,
    earnedOn: earned ? earnedOn : undefined,
    current,
    target,
    progress: `${current} of ${target} days`,
  };
}

/** True when the meal has a calorie number. */
function counted(m: Pick<Meal, 'nutrition'>): boolean {
  return typeof m.nutrition?.kcal === 'number' && Number.isFinite(m.nutrition.kcal);
}

function mealsBadge(meals: BadgeInput['meals']): Badge {
  const byDay = new Map<string, { total: number; counted: number }>();
  for (const m of meals) {
    const cur = byDay.get(m.date) ?? { total: 0, counted: 0 };
    cur.total++;
    if (counted(m)) cur.counted++;
    byDay.set(m.date, cur);
  }
  const days = [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b));
  const full = days.find(([, d]) => d.counted === d.total);
  const base = { id: 'meals-counted', name: 'Every meal counted', rule: 'Log calories for every meal of one day', sprite: 'bowl' as const };
  if (full) return { ...base, earned: true, earnedOn: full[0], current: full[1].total, target: full[1].total, progress: `${full[1].total} of ${full[1].total} meals` };
  // Locked: the closest day so far, latest first on a tie.
  let best: { total: number; counted: number } | undefined;
  for (const [, d] of days) if (!best || d.counted / d.total >= best.counted / best.total) best = d;
  if (!best) return { ...base, earned: false, current: 0, target: 1, progress: '0 of 1 days' };
  return { ...base, earned: false, current: best.counted, target: best.total, progress: `${best.counted} of ${best.total} meals` };
}

function pillarBadge(points: readonly number[]): Badge {
  const top = points.reduce((m, p) => Math.max(m, levelFromPoints(p)), 0);
  const earned = top >= PILLAR_LEVEL_GOAL;
  // Round down so a locked badge never reads "10.0 of 10".
  const shown = earned ? PILLAR_LEVEL_GOAL : Math.floor(top * 10) / 10;
  return {
    id: 'pillar-10',
    name: 'Level 10',
    rule: `Raise any pillar to level ${PILLAR_LEVEL_GOAL}`,
    sprite: 'star',
    earned,
    // Points build up over many days; the day a level was crossed is not kept.
    earnedOn: undefined,
    current: shown,
    target: PILLAR_LEVEL_GOAL,
    progress: `level ${shown.toFixed(1)} of ${PILLAR_LEVEL_GOAL}`,
  };
}

function questsBadge(dayLogs: BadgeInput['dayLogs'], target: number): Badge {
  const sorted = [...dayLogs].sort((a, b) => a.date.localeCompare(b.date));
  let done = 0;
  let earnedOn: string | undefined;
  for (const d of sorted) {
    for (const q of d.quests ?? []) {
      if (!q.done) continue;
      done++;
      if (done === target) earnedOn = d.date;
    }
  }
  const current = Math.min(done, target);
  return {
    id: `quests-${target}`,
    name: 'Twenty-one quests',
    rule: `Complete ${target} quests`,
    sprite: 'flag',
    earned: done >= target,
    earnedOn,
    current,
    target,
    progress: `${current} of ${target} quests`,
  };
}

/* ------------------------------------------------------------------ */
/* All badges                                                          */
/* ------------------------------------------------------------------ */

/** Every badge in display order, earned or not. */
export function computeBadges(input: BadgeInput): Badge[] {
  const { dayLogs, photos } = input;
  const nights = daysWhere(dayLogs, (d) => Boolean(d.closedAt));
  const letters = daysWhere(dayLogs, (d) => Boolean(d.briefMd?.trim()));
  const stepDays = daysWhere(dayLogs, (d) => typeof d.steps === 'number' && d.steps >= STEPS_GOAL);
  const waterDays = daysWhere(dayLogs, (d) => typeof d.waterL === 'number' && d.waterL > 0);
  const workoutDays = daysWhere(dayLogs, (d) => Boolean(d.workoutType?.trim()) || (typeof d.workoutMin === 'number' && d.workoutMin > 0));
  const photoDays = daysWhere(photos, () => true);

  return [
    streakBadge('streak-7', 'Week straight', 7, input),
    streakBadge('streak-30', 'Month straight', 30, input),
    countBadge({ id: 'nights-7', name: 'Seven nights', rule: 'Close 7 nights at the campfire', sprite: 'moon', target: 7 }, nights, 'nights'),
    countBadge({ id: 'nights-30', name: 'Thirty nights', rule: 'Close 30 nights at the campfire', sprite: 'moon', target: 30 }, nights, 'nights'),
    countBadge({ id: 'nights-100', name: 'Hundred nights', rule: 'Close 100 nights at the campfire', sprite: 'moon', target: 100 }, nights, 'nights'),
    countBadge({ id: 'letter-1', name: 'First letter', rule: 'Receive your first morning letter', sprite: 'letter', target: 1 }, letters, 'letters'),
    countBadge({ id: 'steps-5', name: '10,000 steps',rule: `Walk ${STEPS_GOAL.toLocaleString('en-US')} steps on 5 days`, sprite: 'shoe', target: 5 }, stepDays, 'days'),
    countBadge({ id: 'water-7', name: 'Water week', rule: 'Log water on 7 days', sprite: 'drop', target: 7 }, waterDays, 'days'),
    countBadge({ id: 'workout-10', name: 'Ten workouts', rule: 'Log a workout on 10 days', sprite: 'dumbbell', target: 10 }, workoutDays, 'workouts'),
    mealsBadge(input.meals),
    countBadge({ id: 'photo-1', name: 'First photo', rule: 'Take your first progress photo', sprite: 'camera', target: 1 }, photoDays, 'photos'),
    countBadge({ id: 'photo-days-4', name: 'Four photo days', rule: 'Take progress photos on 4 different days', sprite: 'camera', target: 4 }, photoDays, 'days'),
    pillarBadge(input.pillarPoints),
    questsBadge(dayLogs, 21),
  ];
}
