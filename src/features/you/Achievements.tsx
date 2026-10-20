import { useEffect, useState, type CSSProperties } from 'react';
import { formatShortDate } from '@/lib/dates';
import type { Badge } from '@/lib/game/achievements';
import { PixelSprite } from '@/ui/PixelSprite';
import { Section, SectionHeader } from '@/ui/primitives';
import '@/theme/anim-achievements.css';
import { useBadges } from './achievementQueries';
import { BADGE_LOCKED_PALETTE, BADGE_MAPS, BADGE_PALETTE } from './badgeSprites';

/** Badge ids this device has already revealed. A per-device nicety: badges never depend on it. */
const SHOWN_KEY = 'chronicle.badges.shown';
const STAGGER_MS = 160;

/** The ids already shown, or null when this browser has no usable storage (then nothing animates). */
function readShown(): Set<string> | null {
  try {
    const raw = window.localStorage.getItem(SHOWN_KEY);
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : []);
  } catch {
    return null;
  }
}

function writeShown(ids: ReadonlySet<string>): boolean {
  try {
    window.localStorage.setItem(SHOWN_KEY, JSON.stringify([...ids]));
    return true;
  } catch {
    return false;
  }
}

export function Achievements() {
  const badges = useBadges();
  // Earned badges this device had not shown before; they play the reveal while this screen is open.
  const [fresh, setFresh] = useState<readonly string[]>([]);

  useEffect(() => {
    if (!badges) return;
    const shown = readShown();
    if (!shown) return;
    const newly = badges.filter((b) => b.earned && !shown.has(b.id)).map((b) => b.id);
    if (newly.length === 0) return;
    for (const id of newly) shown.add(id);
    // Only animate what we could remember, so a broken storage never replays the reveal on every visit.
    if (!writeShown(shown)) return;
    setFresh((cur) => [...cur, ...newly.filter((id) => !cur.includes(id))]);
  }, [badges]);

  if (!badges) return null;
  const earned = badges.filter((b) => b.earned).length;

  return (
    <section aria-label="Achievements" className="flex flex-col gap-2">
      <SectionHeader title="Achievements" note={`${earned} of ${badges.length}`} />
      <Section>
        <ul className="m-0 grid list-none grid-cols-3 gap-x-2 gap-y-3 p-0 sm:grid-cols-5 lg:grid-cols-3" data-testid="achievements">
          {badges.map((b) => {
            const order = fresh.indexOf(b.id);
            return <BadgeCell key={b.id} badge={b} revealDelay={order >= 0 ? order * STAGGER_MS : undefined} />;
          })}
        </ul>
      </Section>
    </section>
  );
}

function BadgeCell({ badge, revealDelay }: { badge: Badge; revealDelay?: number }) {
  const revealing = revealDelay !== undefined;
  const style = revealing ? ({ '--badge-delay': `${revealDelay}ms` } as CSSProperties) : undefined;
  const note = badge.earned ? (badge.earnedOn ? formatShortDate(badge.earnedOn) : 'earned') : badge.progress;
  const label = badge.earned
    ? `${badge.name}, earned${badge.earnedOn ? ` ${formatShortDate(badge.earnedOn)}` : ''}. ${badge.rule}`
    : `${badge.name}, locked, ${badge.progress}. ${badge.rule}`;

  return (
    <li aria-label={label} title={badge.rule} data-earned={badge.earned ? '' : undefined} className="flex min-w-0 flex-col items-center gap-1 text-center">
      <PixelSprite
        map={BADGE_MAPS[badge.sprite]}
        palette={badge.earned ? BADGE_PALETTE : BADGE_LOCKED_PALETTE}
        scale={3}
        className={revealing ? 'badge-reveal' : undefined}
        style={style}
      />
      <span aria-hidden="true" className={`break-words ${badge.earned ? 'text-ink' : 'text-mid'}`}>
        {badge.name}
      </span>
      <span aria-hidden="true" className={`text-mid ${revealing ? 'badge-reveal-note' : ''}`} style={style}>
        {note}
      </span>
    </li>
  );
}
