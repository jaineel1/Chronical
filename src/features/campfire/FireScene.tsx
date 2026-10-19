import { PixelSprite } from '@/ui/PixelSprite';
import { FIRE_MAP, FIRE_PALETTE, HERO_MAP, HERO_PALETTE, MOON_MAP, MOON_PALETTE } from '@/ui/sprites';
import { ProgressLine } from './parts';

/** The fire grows with the log: scale 3 under a third, 4 under four fifths, then 5. */
export function fireScale(logged: number, total: number): 3 | 4 | 5 {
  const ratio = total > 0 ? logged / total : 0;
  return ratio < 1 / 3 ? 3 : ratio < 0.8 ? 4 : 5;
}

export function progressLine(logged: number, total: number): string {
  if (logged <= 0) return `0 of ${total} logged. Light the fire.`;
  if (logged >= total) return `${logged} of ${total} logged. The fire is high.`;
  return `${logged} of ${total} logged. The fire grows.`;
}

/**
 * The night scene: the hero by the fire on a hairline ground, the moon top right, and how much of
 * tonight is logged. Its own 96px block; nothing in it overlaps the sections below.
 */
export function FireScene({ logged, total }: { logged: number; total: number }) {
  const scale = fireScale(logged, total);
  const text = progressLine(logged, total);
  return (
    <div className="relative h-24 shrink-0" data-testid="fire-scene">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[14px] h-[2px] bg-faint" />
      <PixelSprite map={MOON_MAP} palette={MOON_PALETTE} scale={3} className="absolute top-0 right-2" />
      <div className="absolute right-10 bottom-4 left-3 flex items-end">
        <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={4} />
        <div className="ml-4 flex w-10 shrink-0 items-end">
          <PixelSprite map={FIRE_MAP} palette={FIRE_PALETTE} scale={scale} />
        </div>
        <div className="mb-[14px] ml-3.5 flex max-w-[170px] min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-mid">{text}</span>
          <ProgressLine value={total ? logged / total : 0} label={`${logged} of ${total} logged`} />
        </div>
      </div>
    </div>
  );
}
