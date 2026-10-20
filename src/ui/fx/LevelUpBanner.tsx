import type { CSSProperties } from 'react';
import '@/theme/anim-rewards.css';

/** Where each 4px spark flies from the banner's right end. A fixed pattern, in whole pixels. */
const SPARKS: { dx: number; dy: number; red: boolean }[] = [
  { dx: 12, dy: -12, red: true },
  { dx: 20, dy: -4, red: false },
  { dx: 16, dy: 8, red: true },
  { dx: 4, dy: 16, red: false },
  { dx: -8, dy: -16, red: false },
  { dx: 24, dy: 12, red: true },
];

/** "Body reached level 8" on an ink strip that wipes in, with a few pixel sparks off its end. */
export function LevelUpBanner({ text }: { text: string }) {
  return (
    <div className="relative" role="status" data-testid="level-up">
      <div className="rw-banner bg-ink px-2.5 py-1 text-paper">{text}</div>
      <span aria-hidden="true" className="absolute top-1/2 right-6 h-0 w-0">
        {SPARKS.map((s, i) => {
          const style: CSSProperties & Record<'--rw-dx' | '--rw-dy', string> = { '--rw-dx': `${s.dx}px`, '--rw-dy': `${s.dy}px` };
          return <span key={i} className={`rw-spark absolute top-0 left-0 h-1 w-1 ${s.red ? 'bg-red' : 'bg-paper'}`} style={style} />;
        })}
      </span>
    </div>
  );
}
