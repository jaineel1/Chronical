import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { usePillars } from '@/data/hooks';
import { PILLARS, PILLAR_LABEL, type Goal, type Milestone, type Pillar, type Routine, type VisionItem } from '@/data/types';
import { daysBetween, formatShortDate } from '@/lib/dates';
import { levelFromPoints } from '@/lib/game/level';
import { dueHint, goalProgressLabel, isMetric, nextDueMilestone } from '@/features/editors/lib/progress';
import { TextLink } from '@/features/editors/lib/ui';
import { useToday } from '@/features/editors/lib/useToday';
import { PixelSprite } from '@/ui/PixelSprite';
import { Bar, Empty, SectionHeader } from '@/ui/primitives';
import { MID_PALETTE, PILLAR_ICON } from '@/ui/sprites';
import { useMapData, useMapRoutines } from './queries';
import { FLAG_MAP, SHIELD_MAP, shieldPalette } from './mapSprites';
import { shieldState, type ShieldState } from './shields';

const FOG: CSSProperties = { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 6px, var(--color-faint) 6px 7px)' };

export function MapScreen() {
  useShellBar('Map', '5 regions, 20 districts');
  const pillars = usePillars();
  const data = useMapData();
  const today = useToday();
  const routines = useMapRoutines(today);

  if (!pillars || !data || !routines) return <Page wide>{null}</Page>;

  // Highest region first; the lowest one sits in fog until it levels.
  const regions = PILLARS.map((pillar, i) => ({ pillar, i, level: levelFromPoints(pillars[pillar]?.points ?? 0) })).sort(
    (a, b) => b.level - a.level || a.i - b.i,
  );
  const fogged = regions[regions.length - 1]?.pillar;
  const empty = data.goalCount === 0;

  return (
    <Page wide>
      {empty ? (
        <Empty action={<TextLink to="/edit/goals/new">Add a goal</TextLink>}>Put the first goal on the map.</Empty>
      ) : null}
      <div className="grid grid-cols-1 gap-[10px] pt-0.5 lg:grid-cols-2 lg:gap-4">
        {regions.map(({ pillar, level }) => (
          <Region
            key={pillar}
            pillar={pillar}
            level={level}
            fog={pillar === fogged}
            goals={data.goals.filter((g) => g.pillar === pillar)}
            milestonesByGoal={data.milestonesByGoal}
            today={today}
            invite={!empty}
            routines={routines.routines}
            doneToday={routines.doneToday}
          />
        ))}
      </div>
      {routines.routines.length > 0 ? (
        <span className="px-2.5 text-mid">Shields: one per routine per week. Faint is spent. Red outline: today is not done.</span>
      ) : null}
      {!empty ? (
        <TextLink to="/edit/goals/new" className="px-2.5 pt-1">
          Add a goal
        </TextLink>
      ) : null}
      <Vision items={data.vision} />
    </Page>
  );
}

function Region({
  pillar,
  level,
  fog,
  goals,
  milestonesByGoal,
  today,
  invite,
  routines,
  doneToday,
}: {
  pillar: Pillar;
  level: number;
  fog: boolean;
  goals: Goal[];
  milestonesByGoal: Map<string, Milestone[]>;
  today: string;
  /** Show "Add a Skin goal" in an empty region (not when the whole map is empty). */
  invite: boolean;
  routines: Routine[];
  doneToday: Set<string>;
}) {
  const dim = fog ? 'opacity-[0.55]' : '';
  const active = goals.filter((g) => g.status === 'active');
  const due = nextDueMilestone(
    active.flatMap((g) => milestonesByGoal.get(g.id) ?? []),
    today,
    daysBetween,
  );
  const label = PILLAR_LABEL[pillar];
  const own = routines.filter((r) => r.pillar === pillar);

  return (
    <section aria-labelledby={`region-${pillar}`} data-fog={fog ? 'true' : undefined} className="flex flex-col border border-faint" style={fog ? FOG : undefined}>
      <div className={`px-2.5 py-1.5 ${fog ? 'bg-paper-2/60' : 'bg-paper-2'}`}>
        <div className={`flex items-center gap-[10px] ${dim}`}>
          <PixelSprite map={PILLAR_ICON[pillar]} palette={MID_PALETTE} scale={2} />
          <h2 id={`region-${pillar}`} className="m-0 flex-1 text-[16px] font-normal">
            {label}
          </h2>
          <span aria-label={`level ${level.toFixed(1)}`}>{level.toFixed(1)}</span>
        </div>
      </div>
      <div className="flex flex-col gap-2 px-2.5 py-2">
        <div className={`flex flex-col gap-2 ${dim}`}>
          {goals.map((g) => (
            <GoalRow key={g.id} goal={g} milestones={milestonesByGoal.get(g.id) ?? []} />
          ))}
          {goals.length === 0 && invite ? <span className="text-mid">No {label} goal on the map yet.</span> : null}
          {due ? <span className="text-mid">{dueHint(due.milestone.title, due.days)}</span> : null}
          {pillar === 'MIND' ? (
            <Link to="/people" className="self-start no-underline">
              Open the people tree
            </Link>
          ) : null}
          {own.length > 0 ? (
            <div className="flex flex-col gap-1 border-t border-faint pt-2">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1" data-testid={`shields-${pillar}`}>
                {own.map((r) => (
                  <ShieldMark key={r.id} routine={r} state={shieldState(r, today, doneToday.has(r.id))} />
                ))}
              </div>
            </div>
          ) : null}
          <div className="flex items-center justify-between">
            <TextLink to={`/edit/goals/new?pillar=${pillar}`}>+ goal</TextLink>
            <TextLink to="/edit/routines">Options</TextLink>
          </div>
        </div>
        {fog ? <span className="text-mid">Still in fog. The lowest region clears as it levels.</span> : null}
      </div>
    </section>
  );
}

function ShieldMark({ routine, state }: { routine: Routine; state: ShieldState }) {
  const status = `${state.used ? 'shield spent' : 'shield ready'}${state.atRisk ? ', streak at risk' : ''}`;
  return (
    <PixelSprite
      map={SHIELD_MAP}
      palette={shieldPalette(state)}
      scale={2}
      label={`${routine.name}: ${status}`}
    />
  );
}

/** "3 of 5" for milestones, "7 of 12 km" style for one metric milestone, "done" for a finished goal. */
function progressLabel(goal: Goal, milestones: Milestone[]): { value: number; label: string } {
  const p = goalProgressLabel(goal, milestones);
  if (p.done || milestones.length === 0) return { value: p.value, label: p.label };
  const only = milestones.length === 1 ? milestones[0] : undefined;
  if (only && isMetric(only) && only.unit?.trim()) return { value: p.value, label: p.label };
  return { value: p.value, label: `${milestones.filter((m) => m.doneAt).length} of ${milestones.length}` };
}

function GoalRow({ goal, milestones }: { goal: Goal; milestones: Milestone[] }) {
  const p = progressLabel(goal, milestones);
  return (
    <Link to={`/edit/goals/${goal.id}`} className="flex flex-col gap-1 text-ink no-underline">
      <span className="flex items-start gap-2">
        <PixelSprite map={FLAG_MAP} palette={MID_PALETTE} scale={2} className="mt-[3px]" />
        <span className="line-clamp-2 min-w-0 flex-1 break-words">{goal.title}</span>
        {goal.targetDate ? <span className="shrink-0 text-mid">by {formatShortDate(goal.targetDate)}</span> : null}
      </span>
      <span className="flex items-center gap-[10px] pl-[18px]">
        <span className="flex min-w-0 flex-1">
          <Bar value={p.value * 100} max={100} />
        </span>
        <span className="w-16 shrink-0 text-right text-mid">{p.label}</span>
      </span>
    </Link>
  );
}

function Vision({ items }: { items: VisionItem[] }) {
  return (
    <section aria-label="Vision" className="flex flex-col gap-2 pt-3">
      <SectionHeader title="Vision" note={items.length ? `${items.length} on the board` : 'what the goals buy'} />
      <div className="flex flex-col px-2.5">
        {items.map((v, i) => (
          <Link
            key={v.id}
            to={`/edit/goals/vision/${v.id}`}
            className={`flex items-start gap-3 py-2 text-ink no-underline ${i > 0 ? 'border-t border-faint' : ''}`}
          >
            {v.imageDataUrl ? <img src={v.imageDataUrl} alt="" className="h-10 w-10 shrink-0 object-cover" /> : null}
            <span className="flex min-w-0 flex-col">
              <span>{v.title}</span>
              {v.gives ? <span className="text-mid">Gives: {v.gives}</span> : null}
              {v.habitCost ? <span>Costs: {v.habitCost}</span> : null}
            </span>
          </Link>
        ))}
        <TextLink to="/edit/goals/vision/new" className="pt-1">
          Add to the vision board
        </TextLink>
      </div>
    </section>
  );
}
