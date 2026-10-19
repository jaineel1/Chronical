import { Fragment, useState, type KeyboardEvent } from 'react';
import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { usePillars, useProfile, useSubStats } from '@/data/hooks';
import { PILLARS, PILLAR_LABEL, SUBSTATS, type Pillar, type PillarState, type Skill, type SubStatState } from '@/data/types';
import { dayNumber } from '@/lib/dates';
import { levelFromPoints, playerPoints } from '@/lib/game/level';
import { nextMilestoneLine, skillBand } from '@/features/editors/lib/skills';
import { TextLink } from '@/features/editors/lib/ui';
import { PixelSprite } from '@/ui/PixelSprite';
import { Button, Empty, SectionHeader, StatRow } from '@/ui/primitives';
import { HERO_MAP, HERO_PALETTE, SUN_MAP, SUN_PALETTE } from '@/ui/sprites';
import { RankPanel } from './RankPanel';
import { useSkills } from './queries';

/** DotGothic16 draws Latin at half an em: 8px a character at 16px. */
const CHAR_PX = 8;

export function YouScreen() {
  const profile = useProfile();
  const pillars = usePillars();
  const subs = useSubStats();
  const skills = useSkills();
  const [ranking, setRanking] = useState(false);

  const level = pillars ? Math.floor(levelFromPoints(playerPoints(PILLARS.map((p) => pillars[p]?.points ?? 0)))) : undefined;
  const day = profile?.startedAt ? dayNumber(profile.startedAt, profile.settings.rolloverHour) : undefined;
  useShellBar('You', level !== undefined && day !== undefined ? `Level ${level}, day ${day}` : undefined);

  if (!pillars || !subs || !skills) return <Page wide>{null}</Page>;

  return (
    <Page wide>
      <div className="grid grid-cols-1 gap-x-10 gap-y-2 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-2">
          <Scene />
          <Pillars pillars={pillars} subs={subs} />
        </div>
        <div className="flex min-w-0 flex-col gap-2 lg:pt-1">
          <Skills skills={skills} ranking={ranking} onRank={() => setRanking((v) => !v)} />
          {ranking ? <RankPanel onClose={() => setRanking(false)} /> : null}
        </div>
      </div>
      <p className="mt-3 border-t border-faint px-2.5 pt-2 text-mid">Wardrobe opens in chapter 3, with your real clothes.</p>
      <TextLink to="/edit" className="px-2.5">
        Edit your world
      </TextLink>
    </Page>
  );
}

/** The hero on a hairline of ground, the sun in the corner. Its own block: nothing overlaps it. */
function Scene() {
  return (
    <div className="relative flex items-end justify-center pt-1 pb-3">
      {/* On phones the mockup's sun sits 12px into the right gutter; on desktop it stays in its column. */}
      <PixelSprite map={SUN_MAP} palette={SUN_PALETTE} scale={3} className="absolute top-1 -right-3 lg:right-1.5" />
      <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={6} label="Your character" />
      <div aria-hidden="true" className="absolute inset-x-0 bottom-[10px] h-[2px] bg-faint" />
    </div>
  );
}

function Pillars({ pillars, subs }: { pillars: Record<Pillar, PillarState>; subs: SubStatState[] }) {
  // The first pillar starts open, as on the character sheet.
  const [open, setOpen] = useState<ReadonlySet<Pillar>>(() => new Set<Pillar>([PILLARS[0]!]));
  const toggle = (p: Pillar) =>
    setOpen((cur) => {
      const next = new Set(cur);
      if (next.has(p)) next.delete(p);
      else next.add(p);
      return next;
    });

  return (
    <section aria-label="Pillars" className="flex flex-col gap-2">
      <SectionHeader title="Pillars" note="no level cap" />
      <div className="flex flex-col gap-[5px] px-2.5">
        {PILLARS.map((p) => {
          const expanded = open.has(p);
          const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggle(p);
            }
          };
          return (
            <Fragment key={p}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={expanded}
                aria-controls={`substats-${p}`}
                aria-label={`${PILLAR_LABEL[p]}, level ${levelFromPoints(pillars[p]?.points ?? 0).toFixed(1)}`}
                onClick={() => toggle(p)}
                onKeyDown={onKey}
                className="cursor-pointer"
              >
                <StatRow name={PILLAR_LABEL[p]} value={levelFromPoints(pillars[p]?.points ?? 0)} />
              </div>
              {expanded ? (
                <div id={`substats-${p}`} className="flex flex-col gap-[5px]">
                  {SUBSTATS[p].map((name) => {
                    const s = subs.find((x) => x.pillar === p && x.name === name);
                    return <StatRow key={name} sub name={name} value={levelFromPoints(s?.points ?? 0)} />;
                  })}
                </div>
              ) : null}
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function Skills({ skills, ranking, onRank }: { skills: Skill[]; ranking: boolean; onRank: () => void }) {
  const longest = skills.reduce((m, s) => Math.max(m, s.name.length), 0);
  const nameWidth = Math.min(136, Math.max(84, longest * CHAR_PX + 4));
  const milestone = nextMilestoneLine(skills);

  return (
    <section aria-label="Skills" className="flex flex-col gap-2">
      <SectionHeader title="Skills, ranked by Claude" note="out of 100" />
      {skills.length === 0 ? (
        <div className="px-2.5">
          <Empty action={<TextLink to="/edit/skills/new">Add a skill</TextLink>}>Add a skill the game master can rank.</Empty>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5 px-2.5">
          {skills.map((s) => (
            <Link key={s.id} to={`/edit/skills/${s.id}`} className="text-ink no-underline" aria-label={`${s.name}, ${Math.round(s.level)} of 100, ${skillBand(s.level)}`}>
              <StatRow
                name={s.name}
                value={s.level}
                max={100}
                nameWidth={nameWidth}
                format={(v) => String(Math.round(v))}
                trailing={<span className="w-16 shrink-0 text-right text-mid">{skillBand(s.level).toLowerCase()}</span>}
              />
            </Link>
          ))}
          <div className="flex items-center justify-between gap-3 pt-1">
            <span className="min-w-0 text-mid">{milestone ?? 'Claude writes the next milestone for each skill when it ranks them.'}</span>
            <Button variant="outline" onClick={onRank} aria-expanded={ranking} className="shrink-0">
              Rank again
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
