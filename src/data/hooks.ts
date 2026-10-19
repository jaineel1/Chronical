import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './db';
import { profileRepo, routineLogRepo, routineRepo } from './repo';
import type { DayLog, Pillar, PillarState, Profile, Routine, RoutineLog, SubStatState } from './types';
import { weekdayOf } from '@/lib/dates';

/**
 * Live hooks. Each returns `undefined` while loading, then re-renders on any change to the
 * tables it read. Screens should render a quiet placeholder for `undefined`, never a spinner.
 */

export function useProfile(): Profile | null | undefined {
  return useLiveQuery(async () => (await profileRepo.get()) ?? null, []);
}

export function usePillars(): Record<Pillar, PillarState> | undefined {
  return useLiveQuery(async () => {
    const rows = await db.pillarState.toArray();
    if (rows.length === 0) return undefined;
    return Object.fromEntries(rows.map((r) => [r.pillar, r])) as Record<Pillar, PillarState>;
  }, []);
}

export function useSubStats(pillar?: Pillar): SubStatState[] | undefined {
  return useLiveQuery(() => (pillar ? db.subStatState.where('pillar').equals(pillar).toArray() : db.subStatState.toArray()), [pillar]);
}

export function useDayLog(date: string): DayLog | null | undefined {
  return useLiveQuery(async () => (await db.dayLogs.where('date').equals(date).first()) ?? null, [date]);
}

export function useLatestBrief(): DayLog | null | undefined {
  return useLiveQuery(async () => (await db.dayLogs.orderBy('date').reverse().filter((d) => !!d.briefMd).first()) ?? null, []);
}

export interface RoutineWithLog {
  routine: Routine;
  log: RoutineLog | undefined;
  scheduledToday: boolean;
}

/** Active routines joined with their log for `date`. */
export function useRoutinesForDate(date: string): RoutineWithLog[] | undefined {
  return useLiveQuery(async () => {
    const [routines, logs] = await Promise.all([routineRepo.listActive(), routineLogRepo.forDate(date)]);
    const byRoutine = new Map(logs.map((l) => [l.routineId, l]));
    const weekday = weekdayOf(date);
    return routines.map((routine) => ({
      routine,
      log: byRoutine.get(routine.id),
      scheduledToday: routine.days.length === 0 || routine.days.includes(weekday),
    }));
  }, [date]);
}

export function useTable<T>(fn: () => Promise<T>, deps: unknown[] = []): T | undefined {
  return useLiveQuery(fn, deps);
}
