/** Read-only queries for the weekly boss: the Morning card and the weekly prompt's boss data. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { routineRepo } from '@/data/repo';
import { activeBoss, bossState, bossWeek, scheduledDays, type BossState, type WeeklyBoss } from '@/lib/game/boss';
import { levelFromPoints } from '@/lib/game/level';
import type { WeeklyBossInput } from '@/lib/prompt/weekly';

export interface ActiveBoss {
  boss: WeeklyBoss;
  state: BossState;
}

/**
 * This week's boss and its HP, live: ticking a weak-to routine re-runs the query (it reads
 * routineLogs), so the bar drops at once. null when there is no boss for `today`.
 */
export function useActiveBoss(today: string): ActiveBoss | null | undefined {
  return useLiveQuery(async () => {
    const boss = activeBoss(await db.digests.where('kind').equals('weekly').toArray(), today);
    if (!boss) return null;
    const [routines, logs] = await Promise.all([
      db.routines.toArray(),
      db.routineLogs.where('date').between(boss.start, boss.end, true, true).toArray(),
    ]);
    return { boss, state: bossState(boss, routines, logs) };
  }, [today]);
}

/** What the weekly prompt needs to set a boss for the seven days after `periodEnd`. */
export async function loadWeeklyBossInput(periodEnd: string): Promise<WeeklyBossInput> {
  const { start, end } = bossWeek(periodEnd);
  const [routines, pillars] = await Promise.all([routineRepo.listActive(), db.pillarState.toArray()]);
  return {
    start,
    end,
    routines: routines.map((r) => ({ name: r.name, pillar: r.pillar, weight: r.weight, scheduledDays: scheduledDays(r, start, end) })),
    pillarLevels: pillars.map((p) => ({ pillar: p.pillar, level: levelFromPoints(p.points) })),
  };
}
