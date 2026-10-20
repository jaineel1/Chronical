import type { DayLog } from '@/data/types';
import { isPeriodQuest } from '@/lib/parse/weekly';

/** Today's quests on the latest brief (weekly and monthly quests excluded, as in "Today's quests"). */
export function todaysQuestProgress(source: DayLog | null | undefined): { done: number; total: number } {
  const quests = source ? source.quests.filter((q) => !isPeriodQuest(q)) : [];
  return { done: quests.filter((q) => q.done).length, total: quests.length };
}

/** Sun top in px inside the 112px morning scene: resting on the ground line, and high in the sky. */
export const SUN_HORIZON_TOP = 73;
export const SUN_HIGH_TOP = 2;

/**
 * The sun climbs with today's quests: 0 done sits on the horizon, all done is high. With no quests
 * there is nothing to climb for, so the sun keeps its high mockup place.
 */
export function sunTop(done: number, total: number): number {
  if (total <= 0) return SUN_HIGH_TOP;
  const ratio = Math.min(1, Math.max(0, done / total));
  return Math.round(SUN_HORIZON_TOP - (SUN_HORIZON_TOP - SUN_HIGH_TOP) * ratio);
}
