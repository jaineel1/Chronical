/**
 * Streaks and shields, derived from routine logs.
 *
 * The `streak`, `shields`, `shieldWeek` and `lastDoneDate` fields on a Routine are a cache for
 * other screens. The truth is always the logs: a streak is the run of consecutive scheduled days
 * that were done (shielded misses keep it alive, unscheduled days are skipped over), and a routine
 * has one shield per ISO week, used when a scheduled day closes without a done log.
 */
import { db } from '@/data/db';
import { stamp } from '@/data/repo';
import type { Routine, RoutineLog, StatDelta } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, addDays, nowIso, weekKey, weekdayOf } from '@/lib/dates';
import { computeRoutineStats, existedOn, isScheduled } from './daily';

/* ------------------------------------------------------------------ */
/* Streaks                                                             */
/* ------------------------------------------------------------------ */

export interface StreakOptions {
  /**
   * Treat `upToDate` as still open: if it is not done yet it neither counts nor breaks the streak.
   * The Campfire uses this before the night is closed.
   */
  todayPending?: boolean;
}

/** Consecutive scheduled days done, counting back from `upToDate`. `logs` may hold other routines' logs. */
export function streakFromLogs(
  routine: Pick<Routine, 'id' | 'days'>,
  logs: readonly RoutineLog[],
  upToDate: string,
  opts: StreakOptions = {},
): number {
  const byDate = new Map<string, RoutineLog>();
  let earliest: string | undefined;
  for (const l of logs) {
    if (l.routineId !== routine.id) continue;
    byDate.set(l.date, l);
    if (!earliest || l.date < earliest) earliest = l.date;
  }
  if (!earliest) return 0;

  let count = 0;
  let day = upToDate;
  // Ten years is a safety net; the walk normally ends at the first miss or the earliest log.
  for (let i = 0; i < 3660 && day >= earliest; i++, day = addDays(day, -1)) {
    if (!isScheduled(routine, weekdayOf(day))) continue;
    const log = byDate.get(day);
    if (log?.done) count++;
    else if (log?.shielded) continue;
    else if (day === upToDate && opts.todayPending) continue;
    else break;
  }
  return count;
}

/** "14 days", "1 day", "new". */
export function formatStreak(n: number): string {
  if (n <= 0) return 'new';
  return `${n} ${n === 1 ? 'day' : 'days'}`;
}

/* ------------------------------------------------------------------ */
/* Closing a night                                                     */
/* ------------------------------------------------------------------ */

export type CloseStatus = 'done' | 'shielded' | 'missed' | 'off';

export interface CloseOutcome {
  routine: Routine;
  scheduled: boolean;
  /** done; shielded (a scheduled miss the week's shield covered); missed; off (not scheduled, not done). */
  status: CloseStatus;
  /** Streak up to the day before. */
  streakBefore: number;
  /** Streak after closing this day. */
  streak: number;
  /** Shields left in this day's week after closing. */
  shieldsLeft: number;
}

export interface ClosePlan {
  date: string;
  week: string;
  outcomes: CloseOutcome[];
  /** Log rows to write for this date so the history says what happened. */
  writes: { routineId: string; done: boolean; shielded: boolean }[];
  warnings: string[];
  routineStats: StatDelta[];
}

/**
 * What closing `date` means, without touching the store. Running it again on a closed night gives
 * the same answer: a shield already used on that date is not used twice, and a routine ticked after
 * its shield was used gets the shield back.
 */
export function planClose(
  routines: readonly Routine[],
  logs: readonly RoutineLog[],
  date: string,
  rolloverHour: number = DEFAULT_ROLLOVER_HOUR,
): ClosePlan {
  const week = weekKey(date);
  const weekday = weekdayOf(date);
  const yesterday = addDays(date, -1);
  const byRoutine = new Map<string, RoutineLog[]>();
  for (const l of logs) {
    const list = byRoutine.get(l.routineId);
    if (list) list.push(l);
    else byRoutine.set(l.routineId, [l]);
  }

  const outcomes: CloseOutcome[] = [];
  const writes: ClosePlan['writes'] = [];
  const warnings: string[] = [];
  const dateLogs: RoutineLog[] = [];

  for (const routine of routines) {
    if (routine.archived) continue;
    const own = byRoutine.get(routine.id) ?? [];
    const earliest = own.reduce<string | undefined>((min, l) => (!min || l.date < min ? l.date : min), undefined);
    if (!existedOn(routine, date, rolloverHour, earliest)) continue;

    const scheduled = isScheduled(routine, weekday);
    const today = own.find((l) => l.date === date);
    const streakBefore = streakFromLogs(routine, own, yesterday);
    let status: CloseStatus;
    let write: { done: boolean; shielded: boolean } | undefined;

    if (today?.done) {
      status = 'done';
      if (today.shielded) write = { done: true, shielded: false };
    } else if (!scheduled) {
      status = 'off';
      if (today?.shielded) write = { done: false, shielded: false };
    } else {
      // One shield a week: none used on another day this week, and the routine's own counter agrees
      // (a counter from an earlier week resets to 1).
      const usedThisWeek = own.some((l) => l.shielded && l.date !== date && weekKey(l.date) === week);
      const counterAllows = routine.shieldWeek !== week || routine.shields > 0;
      if (today?.shielded || (!usedThisWeek && counterAllows)) {
        status = 'shielded';
        if (!today?.shielded) write = { done: false, shielded: true };
        warnings.push(`${routine.name}: shield used, none left this week`);
      } else {
        status = 'missed';
        if (!today) write = { done: false, shielded: false };
        if (streakBefore > 0) warnings.push(`${routine.name} streak broken at ${streakBefore} ${streakBefore === 1 ? 'day' : 'days'}`);
      }
    }

    let after = own;
    if (write) {
      writes.push({ routineId: routine.id, ...write });
      const synthetic: RoutineLog = today
        ? { ...today, ...write }
        : { id: `plan-${routine.id}`, routineId: routine.id, date, createdAt: '', updatedAt: '', ...write };
      after = [...own.filter((l) => l.date !== date), synthetic];
    }
    const current = after.find((l) => l.date === date);
    if (current) dateLogs.push(current);

    outcomes.push({
      routine,
      scheduled,
      status,
      streakBefore,
      streak: streakFromLogs(routine, after, date),
      shieldsLeft: after.some((l) => l.shielded && weekKey(l.date) === week) ? 0 : 1,
    });
  }

  return { date, week, outcomes, writes, warnings, routineStats: computeRoutineStats([...routines], dateLogs, date, rolloverHour) };
}

/**
 * Close the night of `date`: use shields on scheduled misses (one per routine per week), record the
 * misses in the logs, refresh each routine's cached streak and shield count, and return the
 * warnings plus the routine deltas for the night. Safe to call again for the same date.
 */
export async function closeNight(date: string): Promise<{ warnings: string[]; routineStats: StatDelta[] }> {
  return db.transaction('rw', [db.profile, db.routines, db.routineLogs], async () => {
    const profile = await db.profile.get('me');
    const rolloverHour = profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
    const routines = (await db.routines.toArray()).filter((r) => !r.archived);
    const ids = routines.map((r) => r.id);
    const logs = ids.length ? await db.routineLogs.where('routineId').anyOf(ids).toArray() : [];
    const plan = planClose(routines, logs, date, rolloverHour);
    const now = nowIso();

    for (const w of plan.writes) {
      const existing = logs.find((l) => l.routineId === w.routineId && l.date === date);
      if (existing) await db.routineLogs.put({ ...existing, done: w.done, shielded: w.shielded, updatedAt: now });
      else await db.routineLogs.put(stamp<RoutineLog>({ routineId: w.routineId, date, done: w.done, shielded: w.shielded }));
    }

    for (const o of plan.outcomes) {
      const r = o.routine;
      // A later night has already been closed for this routine; its cache is newer than this one.
      if (r.lastDoneDate && r.lastDoneDate > date) continue;
      const doneDates = logs.filter((l) => l.routineId === r.id && l.done && l.date <= date).map((l) => l.date);
      const lastDoneDate = doneDates.sort().at(-1) ?? r.lastDoneDate;
      await db.routines.put({ ...r, streak: o.streak, shields: o.shieldsLeft, shieldWeek: plan.week, lastDoneDate, updatedAt: now });
    }

    return { warnings: plan.warnings, routineStats: plan.routineStats };
  });
}

/* ------------------------------------------------------------------ */
/* Display                                                             */
/* ------------------------------------------------------------------ */

const SHIELD_SUFFIX = ': shield used, none left this week';

function listJoin(items: string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;
}

/** True for "X: shield used…" lines and their summary: a shield doing its job, not an alarm. */
export function isShieldNote(text: string): boolean {
  return text.endsWith(SHIELD_SUFFIX) || text.startsWith('Shields used on ');
}

/**
 * For display: two or more "X: shield used, none left this week" lines become one line, so a
 * night with several covered misses reads as one note. Other warnings pass through in order.
 */
export function summariseNightWarnings(warnings: readonly string[]): string[] {
  const shielded = warnings.filter((w) => w.endsWith(SHIELD_SUFFIX));
  if (shielded.length < 2) return [...warnings];
  const names = shielded.map((w) => (w.slice(0, -SHIELD_SUFFIX.length).split(',')[0] ?? '').trim());
  return [...warnings.filter((w) => !w.endsWith(SHIELD_SUFFIX)), `Shields used on ${listJoin(names)}. None left this week for them.`];
}
