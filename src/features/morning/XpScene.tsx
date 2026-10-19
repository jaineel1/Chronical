import { formatToNext, type PlayerSummary } from '@/lib/game/xp';
import { PixelSprite } from '@/ui/PixelSprite';
import { HERO_MAP, HERO_PALETTE, SUN_MAP, SUN_PALETTE } from '@/ui/sprites';
import { ProgressLine } from '@/features/campfire/parts';

/**
 * The morning scene: the hero on a hairline ground, the sun top right, and progress to the next
 * level. Its own 112px block, so nothing below can slide under the sprite.
 */
export function XpScene({ summary }: { summary: PlayerSummary | undefined }) {
  const text = summary ? formatToNext(summary) : '';
  const value = summary && summary.toNext.span > 0 ? summary.toNext.current / summary.toNext.span : 0;
  return (
    <div className="relative h-28 shrink-0" data-testid="xp-scene">
      <PixelSprite map={SUN_MAP} palette={SUN_PALETTE} scale={3} className="absolute top-0.5 right-1.5" />
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
