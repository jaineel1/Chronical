/** Builders shared by the game-math tests. Not imported by app code. */
import type { Routine, RoutineLog } from '@/data/types';

export function makeRoutine(over: Partial<Routine> & { id: string }): Routine {
  return {
    name: over.id,
    pillar: 'BODY',
    subStat: 'Strength',
    weight: 3,
    days: [],
    upside: '',
    cost: '',
    streak: 0,
    shields: 1,
    archived: false,
    sortOrder: 0,
    createdAt: '2020-01-01T12:00:00.000Z',
    updatedAt: '2020-01-01T12:00:00.000Z',
    ...over,
  };
}

export function makeLog(routineId: string, date: string, done: boolean, shielded = false): RoutineLog {
  return { id: `${routineId}-${date}`, routineId, date, done, shielded, createdAt: '', updatedAt: '' };
}
