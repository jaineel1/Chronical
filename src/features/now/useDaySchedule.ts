import { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { dayLogRepo, routineRepo, timetableRepo } from '@/data/repo';
import type { PlanBlock, TimetableEntry } from '@/data/types';
import { weekdayOf } from '@/lib/dates';
import { buildTimeline, type TimelineBlock } from '@/lib/schedule/schedule';

export interface DaySchedule {
  entries: TimetableEntry[];
  routineCount: number;
  plan: PlanBlock[];
  timeline: TimelineBlock[];
}

/** The merged timeline for one day key, live. `undefined` while it loads. */
export function useDaySchedule(date: string): DaySchedule | undefined {
  const data = useLiveQuery(async () => {
    const [entries, routines, log] = await Promise.all([timetableRepo.list(), routineRepo.listActive(), dayLogRepo.get(date)]);
    return { entries, routines, plan: log?.plan ?? [] };
  }, [date]);

  return useMemo(() => {
    if (!data) return undefined;
    const timeline = buildTimeline({ date, weekday: weekdayOf(date), entries: data.entries, routines: data.routines, plan: data.plan });
    return { entries: data.entries, routineCount: data.routines.length, plan: data.plan, timeline };
  }, [data, date]);
}
