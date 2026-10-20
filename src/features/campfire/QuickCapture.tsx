import { useNow } from './parts';
import { TextLink } from './parts';
import { useProfile } from '@/data/hooks';
import { DEFAULT_ROLLOVER_HOUR, todayKey } from '@/lib/dates';
import { Section, SectionHeader } from '@/ui/primitives';
import { LifeLineForm } from './LifeFeed';

/** A small panel for anywhere in the app: a life line for today, and a way to the rant box. */
export function QuickCapture() {
  const profile = useProfile();
  const now = useNow();
  if (!profile) return null;
  const date = todayKey(profile.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR, now);
  return (
    <>
      <SectionHeader title="Quick capture" note="for tonight" />
      <Section>
        <LifeLineForm date={date} id="quick-life-line" />
        <TextLink to="/campfire">Open the rant box</TextLink>
      </Section>
    </>
  );
}
