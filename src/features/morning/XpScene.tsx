import { useLatestBrief } from '@/data/hooks';
import { formatToNext, type PlayerSummary } from '@/lib/game/xp';
import { PixelSprite } from '@/ui/PixelSprite';
import { HERO_MAP, HERO_PALETTE, SUN_MAP, SUN_PALETTE } from '@/ui/sprites';
import { ProgressLine } from '@/features/campfire/parts';
import '@/theme/anim-fire.css';
import { SUN_HORIZON_TOP, sunTop, todaysQuestProgress } from './sun';

/**
 * The morning scene: the hero on a hairline ground, the sun on the right, and progress to the next
 * level. Its own 112px block, so nothing below can slide under the sprite. The sun climbs from the
 * horizon as today's quests on the latest brief are done, moving in steps.
 */
export function XpScene({ summary }: { summary: PlayerSummary | undefined }) {
  const text = summary ? formatToNext(summary) : '';
  const value = summary && summary.toNext.span > 0 ? summary.toNext.current / summary.toNext.span : 0;
  const source = useLatestBrief();
  const quests = todaysQuestProgress(source);
  // Until the brief is read, the sun waits on the horizon; it then climbs to where the day stands.
  const top = source === undefined ? SUN_HORIZON_TOP : sunTop(quests.done, quests.total);
  return (
    <div className="relative h-28 shrink-0" data-testid="xp-scene">
      <PixelSprite
        map={SUN_MAP}
        palette={SUN_PALETTE}
        scale={3}
        className="sun-move absolute right-1.5"
        style={{ top }}
      />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-4 h-[2px] bg-faint" />
      <div className="absolute right-10 bottom-[18px] left-5 flex items-end gap-8 lg:left-3 lg:gap-[30px]">
        <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={4} />
        <div className="mb-[14px] flex max-w-[170px] min-w-0 flex-1 flex-col gap-1.5 lg:max-w-[240px]">
          <span className="text-mid" data-testid="xp-line">
            {text}
          </span>
          <ProgressLine value={value} label={`Level progress ${Math.round(value * 100)} percent`} />
        </div>
      </div>
    </div>
  );
}
