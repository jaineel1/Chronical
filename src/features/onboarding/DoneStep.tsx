import { Link } from 'react-router';
import { dayNumber } from '@/lib/dates';
import { Section } from '@/ui/primitives';
import { PixelSprite } from '@/ui/PixelSprite';
import { HERO_MAP, HERO_PALETTE, SUN_MAP, SUN_PALETTE } from '@/ui/sprites';
import { WizardFrame } from './WizardFrame';
import { useWizard } from './wizard';

/** A closing page for anyone who lands on /onboarding/done: where the game stands and the way in. */
export function DoneStep() {
  const { profile } = useWizard();
  const onboarded = !!profile?.onboardedAt;
  const day = profile?.startedAt && onboarded ? dayNumber(profile.startedAt, profile.settings.rolloverHour) : 0;

  return (
    <WizardFrame title="Chronicle" meta={onboarded ? `Day ${day}` : 'Day 0'}>
      <div className="relative h-[120px]" aria-hidden="true">
        <PixelSprite map={SUN_MAP} palette={SUN_PALETTE} scale={4} className="absolute top-0 right-2" />
        <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={5} className="absolute top-1 left-2" />
        <div className="absolute inset-x-0 bottom-3 h-[2px] bg-faint" />
      </div>
      <Section className="gap-4">
        {onboarded ? (
          <>
            <p className="letter">
              <span className="drop">T</span>he game is running. Your routines are on the Campfire, your goals are on the Map, and the game master
              writes again after tonight&apos;s log.
            </p>
            <Link to="/" className="self-start no-underline">
              Open the morning letter
            </Link>
          </>
        ) : (
          <>
            <p className="letter">
              <span className="drop">T</span>he Origin Sheet is not finished yet. It saves as you go, so you can pick it up where you left it.
            </p>
            <Link to="/onboarding" className="self-start no-underline">
              Back to the Origin Sheet
            </Link>
          </>
        )}
      </Section>
    </WizardFrame>
  );
}
