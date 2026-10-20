import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Goal, Milestone, Routine, VisionItem } from '@/data/types';

export interface MapData {
  /** Active and done goals; paused goals stay off the map. */
  goals: Goal[];
  milestonesByGoal: Map<string, Milestone[]>;
  vision: VisionItem[];
  /** Total goals including paused, to tell an empty map from a paused one. */
  goalCount: number;
}

export interface MapRoutines {
  routines: Routine[];
  /** Ids of routines with a done log for today. */
  doneToday: Set<string>;
}

/** Active routines (for the shield rows) and which of them are done on `today`. */
export function useMapRoutines(today: string): MapRoutines | undefined {
  return useLiveQuery(async () => {
    const [routines, logs] = await Promise.all([
      db.routines.filter((r) => !r.archived).sortBy('sortOrder'),
      db.routineLogs.where('date').equals(today).toArray(),
    ]);
    return { routines, doneToday: new Set(logs.filter((l) => l.done).map((l) => l.routineId)) };
  }, [today]);
}

export function useMapData(): MapData | undefined {
  return useLiveQuery(async () => {
    const [goals, milestones, vision] = await Promise.all([db.goals.toArray(), db.milestones.toArray(), db.visionItems.toArray()]);
    const milestonesByGoal = new Map<string, Milestone[]>();
    for (const m of milestones.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id))) {
      const list = milestonesByGoal.get(m.goalId) ?? [];
      list.push(m);
      milestonesByGoal.set(m.goalId, list);
    }
    const shown = goals
      .filter((g) => g.status !== 'paused')
      // Active first, then done; oldest first within each, so the map does not reshuffle.
      .sort((a, b) => Number(a.status === 'done') - Number(b.status === 'done') || a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    return {
      goals: shown,
      milestonesByGoal,
      vision: vision.sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
      goalCount: goals.length,
    };
  }, []);
}
