import { useEffect, useRef, useState } from 'react';
import { useProfile } from '@/data/hooks';
import { PILLAR_LABEL } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, todayKey } from '@/lib/dates';
import { daysLeft } from '@/lib/game/boss';
import { useNow } from '@/features/campfire/parts';
import { PixelSprite } from '@/ui/PixelSprite';
import { Bar, Section, SectionHeader } from '@/ui/primitives';
import '@/theme/anim-boss.css';
import { useActiveBoss } from './bossQueries';
import { BOSS_DEFEATED_MAP, BOSS_DEFEATED_PALETTE, BOSS_MAP, BOSS_PALETTE } from './bossSprites';

interface Hit {
  key: number;
  amount: number;
  defeat: boolean;
}

/**
 * This week's boss from the weekly review: sprite, HP bar, the routines that hurt it and the
 * reward. Ticking a weak-to routine drops the HP live. Renders nothing when there is no boss.
 */
export function BossCard() {
  const profile = useProfile();
  const now = useNow(60_000);
  const today = todayKey(profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR, now);
  const active = useActiveBoss(today);
  const remaining = active?.state.remaining;

  // A hit is a drop in HP seen while the card is open; the first value only sets the baseline.
  const prev = useRef<number | undefined>(undefined);
  const [hit, setHit] = useState<Hit | null>(null);
  useEffect(() => {
    const before = prev.current;
    prev.current = remaining;
    if (before === undefined || remaining === undefined || remaining >= before) return;
    setHit((h) => ({ key: (h?.key ?? 0) + 1, amount: before - remaining, defeat: remaining === 0 }));
  }, [remaining]);
  useEffect(() => {
    if (!hit) return;
    const t = setTimeout(() => setHit(null), 800);
    return () => clearTimeout(t);
  }, [hit]);

  if (!active) return null;
  const { boss, state } = active;
  const left = daysLeft(boss, today);
  const note = state.defeated ? 'Defeated' : today < boss.start ? 'Starts tomorrow' : left === 1 ? 'Last day' : `${left} days left`;
  const animClass = hit ? (hit.defeat ? 'boss-defeat' : 'boss-hit') : '';

  return (
    <section data-testid="boss-card" aria-label="Boss of the week">
      <SectionHeader title="Boss of the week" note={note} />
      <Section className="py-2.5">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <PixelSprite
              key={`sprite-${hit?.key ?? 0}`}
              map={state.defeated ? BOSS_DEFEATED_MAP : BOSS_MAP}
              palette={state.defeated ? BOSS_DEFEATED_PALETTE : BOSS_PALETTE}
              scale={4}
              label={state.defeated ? `${boss.name}, defeated` : boss.name}
              className={animClass}
            />
            {hit ? (
              <span key={`dmg-${hit.key}`} aria-hidden="true" className="boss-dmg absolute -top-1 right-0 text-red">
                −{hit.amount}
              </span>
            ) : null}
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-3">
              <span className="min-w-0 truncate">{boss.name}</span>
              <span className="shrink-0 text-mid">{PILLAR_LABEL[boss.pillar]}</span>
            </span>
            {boss.taunt ? <span className="text-mid">{boss.taunt}</span> : null}
            <div className="flex items-center gap-3">
              <span className="shrink-0">HP</span>
              <Bar value={state.remaining} max={state.hp} label={`Boss HP ${state.remaining} of ${state.hp}`} />
              <span className="shrink-0 text-right" data-testid="boss-hp">
                {state.remaining} of {state.hp}
              </span>
            </div>
            {state.defeated ? <span data-testid="boss-defeated">Defeated. {boss.reward ? `Claim it: ${boss.reward.replace(/\.+$/, '')}.` : ''}</span> : null}
          </div>
        </div>
        <div className="flex flex-col">
          <span className="text-mid">Weak to</span>
          {state.hits.map((h, i) => (
            <div key={`${h.name}-${i}`} className="flex items-baseline justify-between gap-3 border-b border-faint py-1 last:border-b-0">
              <span className="min-w-0 truncate">{h.name}</span>
              <span className="shrink-0 text-mid">{h.weight ? `${h.weight} a hit, ${h.damage} dealt` : 'not one of your routines'}</span>
            </div>
          ))}
        </div>
        {boss.reward && !state.defeated ? <span className="text-mid">Reward: {boss.reward}</span> : null}
      </Section>
    </section>
  );
}
