import type { Routine } from '@/data/types';
import { weekKey, weekdayOf } from '@/lib/dates';
import { isScheduled } from '@/lib/game/daily';

export interface ShieldState {
  /** This week's shield is spent. A routine whose shieldWeek is an older week has its shield back. */
  used: boolean;
  /** Today is scheduled, not done yet, and there is a streak that a miss would end. */
  atRisk: boolean;
}

/** Shield state of one routine on `today`. `doneToday` is whether a done log exists for today. */
export function shieldState(
  routine: Pick<Routine, 'days' | 'shields' | 'shieldWeek' | 'streak'>,
  today: string,
  doneToday: boolean,
): ShieldState {
  const used = routine.shieldWeek === weekKey(today) && routine.shields <= 0;
  const atRisk = isScheduled(routine, weekdayOf(today)) && !doneToday && routine.streak > 0;
  return { used, atRisk };
}
