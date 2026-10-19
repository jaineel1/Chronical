import type { CSSProperties } from 'react';
import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { usePillars } from '@/data/hooks';
import { PILLARS, PILLAR_LABEL, type Goal, type Milestone, type Pillar, type VisionItem } from '@/data/types';
import { daysBetween } from '@/lib/dates';
import { levelFromPoints } from '@/lib/game/level';
import { dueHint, goalProgressLabel, nextDueMilestone } from '@/features/editors/lib/progress';
import { TextLink } from '@/features/editors/lib/ui';
import { useToday } from '@/features/editors/lib/useToday';
import { PixelSprite } from '@/ui/PixelSprite';
import { Bar, Empty, SectionHeader } from '@/ui/primitives';
import { MID_PALETTE, PILLAR_ICON } from '@/ui/sprites';
import { useMapData } from './queries';

const FOG: CSSProperties = { backgroundImage: 'repeating-linear-gradient(45deg, transparent 0 6px, var(--color-faint) 6px 7px)' };

export function MapScreen() {
  useShellBar('Map', '5 regions, 20 districts');
  const pillars = usePillars();
  const data = useMapData();
  const today = useToday();

  if (!pillars || !data) return <Page wide>{null}</Page>;

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
          />
        ))}
      </div>
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
}: {
  pillar: Pillar;
  level: number;
  fog: boolean;
  goals: Goal[];
  milestonesByGoal: Map<string, Milestone[]>;
  today: string;
  /** Show "Add a Skin goal" in an empty region (not when the whole map is empty). */
  invite: boolean;
}) {
  const dim = fog ? 'opacity-[0.55]' : '';
  const active = goals.filter((g) => g.status === 'active');
  const due = nextDueMilestone(
    active.flatMap((g) => milestonesByGoal.get(g.id) ?? []),
    today,
    daysBetween,
  );
  const label = PILLAR_LABEL[pillar];
  const hasBody = goals.length > 0 || !!due || pillar === 'MIND' || fog || invite;

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
      {hasBody ? (
        <div className="flex flex-col gap-2 px-2.5 py-2">
          <div className={`flex flex-col gap-2 ${dim}`}>
            {goals.map((g) => (
              <GoalRow key={g.id} goal={g} milestones={milestonesByGoal.get(g.id) ?? []} />
            ))}
            {goals.length === 0 && invite ? (
              <TextLink to={`/edit/goals/new?pillar=${pillar}`}>Add a {label} goal</TextLink>
            ) : null}
            {due ? <span className="text-mid">{dueHint(due.milestone.title, due.days)}</span> : null}
            {pillar === 'MIND' ? (
              <Link to="/people" className="self-start no-underline">
                Open the people tree
              </Link>
            ) : null}
          </div>
          {fog ? <span className="text-red">Still in fog. The lowest region clears as it levels.</span> : null}
        </div>
      ) : null}
    </section>
  );
}

function GoalRow({ goal, milestones }: { goal: Goal; milestones: Milestone[] }) {
  const p = goalProgressLabel(goal, milestones);
  return (
    <Link to={`/edit/goals/${goal.id}`} className="flex items-center gap-[10px] text-ink no-underline">
      <span className="line-clamp-2 min-w-0 flex-1 break-words">{goal.title}</span>
      <div className="flex w-[90px] shrink-0">
        <Bar value={p.value * 100} max={100} label={`${goal.title}, ${p.label}`} />
      </div>
      <span className="w-16 shrink-0 text-right text-mid">{p.label}</span>
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
