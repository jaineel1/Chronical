/**
 * Player-level summaries for the Morning screen: overall level and progress (mean of the five
 * pillars on the shared level curve) and the "This week" grid.
 */
import { PILLARS, type Pillar, type Routine, type RoutineLog } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, weekdayOf } from '@/lib/dates';
import { existedOn, isScheduled } from './daily';
import { weekDates } from './calendar';
import { levelFromPoints, playerPoints, progressToNextLevel } from './level';

export interface PlayerSummary {
  /** Mean of the five pillars' points. */
  points: number;
  /** Unrounded level on the shared curve; show Math.floor for "level 7". */
  level: number;
  toNext: { current: number; span: number; nextLevel: number };
}

export function playerSummary(pillars: Partial<Record<Pillar, { points: number }>>): PlayerSummary {
  const points = playerPoints(PILLARS.map((p) => pillars[p]?.points ?? 0));
  return { points, level: levelFromPoints(points), toNext: progressToNextLevel(points) };
}

/** "1,240 of 1,600 to level 8". Points never round up past what was earned. */
export function formatToNext(summary: PlayerSummary): string {
  const fmt = (n: number) => n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
  const { current, span, nextLevel } = summary.toNext;
  return `${fmt(Math.floor(current))} of ${fmt(Math.round(span))} to level ${nextLevel}`;
}

export interface WeekGrid {
  /** Seven day keys, Monday first. */
  days: string[];
  /** done[pillar][i]: every routine of that pillar scheduled on days[i] was done. */
  done: Record<Pillar, boolean[]>;
  /** scheduled[pillar][i]: at least one routine of that pillar was scheduled on days[i]. */
  scheduled: Record<Pillar, boolean[]>;
}

/** Seven days × five pillars for the desktop "This week" grid. */
export function weekGrid(
  routines: readonly Routine[],
  logs: readonly RoutineLog[],
  weekStartKey: string,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): WeekGrid {
  const days = weekDates(weekStartKey);
  const doneKeys = new Set(logs.filter((l) => l.done).map((l) => `${l.routineId}|${l.date}`));
  const earliest = new Map<string, string>();
  for (const l of logs) {
    const e = earliest.get(l.routineId);
    if (!e || l.date < e) earliest.set(l.routineId, l.date);
  }
  const done = {} as Record<Pillar, boolean[]>;
  const scheduled = {} as Record<Pillar, boolean[]>;
  for (const pillar of PILLARS) {
    done[pillar] = [];
    scheduled[pillar] = [];
    for (const day of days) {
      const due = routines.filter(
        (r) => !r.archived && r.pillar === pillar && isScheduled(r, weekdayOf(day)) && existedOn(r, day, rolloverHour, earliest.get(r.id)),
      );
      scheduled[pillar].push(due.length > 0);
      done[pillar].push(due.length > 0 && due.every((r) => doneKeys.has(`${r.id}|${day}`)));
    }
  }
  return { days, done, scheduled };
}
