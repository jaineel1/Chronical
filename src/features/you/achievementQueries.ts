import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { computeBadges, type Badge } from '@/lib/game/achievements';

/** Every badge, computed live from the player's history. Nothing about badges is stored. */
export function useBadges(): Badge[] | undefined {
  return useLiveQuery(async () => {
    const [routines, routineLogs, dayLogs, meals, photos, pillars] = await Promise.all([
      db.routines.toArray(),
      db.routineLogs.toArray(),
      db.dayLogs.toArray(),
      db.meals.toArray(),
      db.photos.toArray(),
      db.pillarState.toArray(),
    ]);
    return computeBadges({ routines, routineLogs, dayLogs, meals, photos, pillarPoints: pillars.map((p) => p.points) });
  }, []);
}
