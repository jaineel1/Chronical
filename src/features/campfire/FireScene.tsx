import { useState } from 'react';
import { PixelSprite } from '@/ui/PixelSprite';
import { FIRE_PALETTE, HERO_MAP, HERO_PALETTE, MOON_MAP, MOON_PALETTE } from '@/ui/sprites';
import '@/theme/anim-fire.css';
import { SPARK_PATHS, isEmbers, sparkCount } from './fireMotion';
import { EMBER_FRAMES, FIRE_FRAMES } from './fireSprites';
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

/** Seconds each flame frame stays up; embers glow slower. */
const FLAME_SLOT = 0.24;
const EMBER_SLOT = 0.8;

/**
 * The night scene: the hero by the fire on a hairline ground, the moon top right, and how much of
 * tonight is logged. Its own 96px block; nothing in it overlaps the sections below.
 * The fire flickers (stacked frames swapped by CSS), sits as low embers until something is logged,
 * and throws sparks each time the logged count goes up while the screen is open.
 */
export function FireScene({ logged, total }: { logged: number; total: number }) {
  const scale = fireScale(logged, total);
  const text = progressLine(logged, total);
  const embers = isEmbers(logged);
  const frames = embers ? EMBER_FRAMES : FIRE_FRAMES;

  // Derive a burst from the previous render's count (no effect, no timer). The key restarts the CSS.
  const [prev, setPrev] = useState(logged);
  const [burst, setBurst] = useState({ id: 0, sparks: 0 });
  if (logged !== prev) {
    setPrev(logged);
    const sparks = sparkCount(prev, logged);
    if (sparks > 0) setBurst((b) => ({ id: b.id + 1, sparks }));
  }

  const rows = frames[0]!.length;
  const cols = frames[0]![0]!.length;
  const slot = embers ? EMBER_SLOT : FLAME_SLOT;
  const n = frames.length;
  return (
    <div className="relative h-24 shrink-0" data-testid="fire-scene">
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[14px] h-[2px] bg-faint" />
      <PixelSprite map={MOON_MAP} palette={MOON_PALETTE} scale={3} className="absolute top-0 right-2" />
      <div className="absolute right-10 bottom-4 left-3 flex items-end">
        <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={4} />
        <div className="ml-4 flex w-10 shrink-0 items-end">
          <div className="relative" style={{ width: cols * scale, height: rows * scale }} data-testid={embers ? 'fire-embers' : 'fire-flames'}>
            {frames.map((map, i) => (
              <PixelSprite
                key={`${embers ? 'e' : 'f'}${i}`}
                map={map}
                palette={FIRE_PALETTE}
                scale={scale}
                className={`fire-frame${i === 0 ? ' fire-frame-first' : ''} ${n === 3 ? 'fire-flicker-3' : 'fire-flicker-2'}`}
                style={{ animationDelay: `${-(((n - i) % n) * slot).toFixed(2)}s` }}
              />
            ))}
            {burst.sparks > 0 ? (
              <div key={burst.id} aria-hidden="true" data-testid="fire-sparks">
                {SPARK_PATHS.slice(0, burst.sparks).map((p, i) => (
                  <span
                    key={i}
                    className={`fire-spark ${i % 2 ? 'bg-mid' : 'bg-red'}`}
                    style={
                      {
                        width: scale,
                        height: scale,
                        left: 3 * scale,
                        bottom: (rows - 2) * scale,
                        animationDelay: `${i * 0.06}s`,
                        '--spark-dx': `${p.dx * scale}px`,
                        '--spark-dy': `${p.dy * scale}px`,
                      } as React.CSSProperties
                    }
                  />
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="mb-[14px] ml-3.5 flex max-w-[170px] min-w-0 flex-1 flex-col gap-1.5">
          <span className="text-mid">{text}</span>
          <ProgressLine value={total ? logged / total : 0} label={`${logged} of ${total} logged`} />
        </div>
      </div>
    </div>
  );
}
