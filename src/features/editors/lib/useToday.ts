import { useProfile } from '@/data/hooks';
import { DEFAULT_ROLLOVER_HOUR, todayKey } from '@/lib/dates';

/** Today's game day, honouring the player's rollover hour (a 1 AM log belongs to the night before). */
export function useToday(): string {
  const profile = useProfile();
  return todayKey(profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR);
}
