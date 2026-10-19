import { Link, useNavigate } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { PILLARS, PILLAR_LABEL } from '@/data/types';
import { Bar, Button, Empty, SectionHeader } from '@/ui/primitives';
import { goalProgressLabel } from '../lib/progress';
import { TextLink } from '../lib/ui';
import { useGoalsWithMilestones, useVisionItems, type GoalWithMilestones } from '../queries';

export function GoalList() {
  const data = useGoalsWithMilestones();
  const vision = useVisionItems();
  const navigate = useNavigate();
  const active = data?.filter((g) => g.goal.status === 'active').length ?? 0;
  useShellBar('Goals', data ? `${active} active` : undefined);

  if (!data || !vision) return <Page>{null}</Page>;

  return (
    <Page>
      {data.length === 0 ? <Empty>Put the first goal on the map.</Empty> : null}
      {PILLARS.map((p) => {
        const list = data.filter((g) => g.goal.pillar === p);
        if (!list.length) return null;
        return (
          <section key={p} aria-label={`${PILLAR_LABEL[p]} goals`} className="flex flex-col gap-2 pb-2">
            <SectionHeader title={PILLAR_LABEL[p]} note={`${list.length} ${list.length === 1 ? 'goal' : 'goals'}`} />
            <ul className="m-0 flex list-none flex-col gap-2 p-0 px-2.5">
              {list.map((g) => (
                <GoalRow key={g.goal.id} item={g} />
              ))}
            </ul>
          </section>
        );
      })}
      <div className="px-2.5 pt-1">
        <Button onClick={() => navigate('/edit/goals/new')}>Add a goal</Button>
      </div>

      <section aria-label="Vision board" className="flex flex-col gap-2 pt-5">
        <SectionHeader title="Vision board" note={vision.length ? `${vision.length} on the board` : 'what the goals buy'} />
        <ul className="m-0 flex list-none flex-col p-0 px-2.5">
          {vision.map((v, i) => (
            <li key={v.id} className={i ? 'border-t border-faint' : ''}>
              <Link to={`/edit/goals/vision/${v.id}`} className="flex items-start gap-3 py-2 text-ink no-underline">
                {v.imageDataUrl ? <img src={v.imageDataUrl} alt="" className="h-10 w-10 shrink-0 object-cover" /> : null}
                <span className="flex min-w-0 flex-col">
                  <span>{v.title}</span>
                  <span className="text-mid">{v.goalId ? (data.find((g) => g.goal.id === v.goalId)?.goal.title ?? 'a goal') : 'no goal yet'}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <TextLink to="/edit/goals/vision/new" className="px-2.5">
          Add to the vision board
        </TextLink>
      </section>
    </Page>
  );
}

function GoalRow({ item }: { item: GoalWithMilestones }) {
  const { goal, milestones } = item;
  const p = goalProgressLabel(goal, milestones);
  const label = goal.status === 'paused' ? 'paused' : p.label;
  return (
    <li>
      <Link to={`/edit/goals/${goal.id}`} className={`flex items-center gap-[10px] no-underline ${goal.status === 'paused' ? 'text-mid' : 'text-ink'}`}>
        <span className="line-clamp-2 min-w-0 flex-1 break-words">{goal.title}</span>
        <span className="flex w-[90px] shrink-0">
          <Bar value={p.value * 100} max={100} label={`${goal.title}, ${label}`} />
        </span>
        <span className="w-16 shrink-0 text-right text-mid">{label}</span>
      </Link>
    </li>
  );
}
