import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { PILLAR_LABEL, type Routine } from '@/data/types';
import { Button, Empty, SectionHeader } from '@/ui/primitives';
import { routineOrderRepo } from '../lib/repos';
import { daysText, shieldsText } from '../lib/routines';
import { useRoutinesAll } from '../queries';

export function RoutineList() {
  const routines = useRoutinesAll();
  const navigate = useNavigate();
  const [showArchived, setShowArchived] = useState(false);
  const active = routines?.filter((r) => !r.archived) ?? [];
  const archived = routines?.filter((r) => r.archived) ?? [];
  useShellBar('Routines', routines ? `${active.length} active` : undefined);

  if (!routines) return <Page>{null}</Page>;

  return (
    <Page>
      <SectionHeader title="Routines" note="in the order you do them" />
      {active.length === 0 ? (
        <div className="px-2.5">
          <Empty>Add your first routine: one thing you do, what it buys you, what a miss costs.</Empty>
        </div>
      ) : (
        <ol className="m-0 flex list-none flex-col p-0 px-2.5" aria-label="Active routines">
          {active.map((r, i) => (
            <RoutineRow key={r.id} routine={r} first={i === 0} last={i === active.length - 1} />
          ))}
        </ol>
      )}
      <div className="px-2.5 pt-2">
        <Button onClick={() => navigate('/edit/routines/new')}>Add a routine</Button>
      </div>

      {archived.length ? (
        <section aria-label="Archived routines" className="flex flex-col gap-2 pt-4">
          <button
            type="button"
            aria-expanded={showArchived}
            onClick={() => setShowArchived((v) => !v)}
            className="flex cursor-pointer items-baseline justify-between gap-3 border-0 bg-paper-2 px-2.5 py-[3px] text-left"
          >
            <span>Archived, {archived.length}</span>
            <span className="text-mid">{showArchived ? 'hide' : 'show'}</span>
          </button>
          {showArchived ? (
            <ul className="m-0 flex list-none flex-col p-0 px-2.5">
              {archived.map((r, i) => (
                <li key={r.id} className={`flex items-center justify-between gap-3 py-2 ${i ? 'border-t border-faint' : ''}`}>
                  <Link to={`/edit/routines/${r.id}`} className="min-w-0 text-mid no-underline">
                    {r.name}
                  </Link>
                  <Button variant="text" onClick={() => routineOrderRepo.restore(r.id)}>
                    Restore
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </Page>
  );
}

function RoutineRow({ routine: r, first, last }: { routine: Routine; first: boolean; last: boolean }) {
  // The name link stretches over the whole row (after:inset-0); Up and Down sit above it.
  return (
    <li className={`relative grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5 ${first ? '' : 'border-t border-faint'}`}>
      <Link to={`/edit/routines/${r.id}`} className="text-ink no-underline after:absolute after:inset-0 after:content-['']">
        {r.name}
      </Link>
      <Button variant="text" disabled={first} onClick={() => routineOrderRepo.move(r.id, -1)} aria-label={`Move ${r.name} up`} className="relative z-10 justify-self-end">
        Up
      </Button>
      <span className="text-mid">
        {PILLAR_LABEL[r.pillar]}, {r.subStat} · weight {r.weight}
      </span>
      <Button variant="text" disabled={last} onClick={() => routineOrderRepo.move(r.id, 1)} aria-label={`Move ${r.name} down`} className="relative z-10 justify-self-end">
        Down
      </Button>
      <span className="col-span-2 text-mid">
        {daysText(r.days)} · streak {r.streak} · {shieldsText(r.shields)}
      </span>
    </li>
  );
}
