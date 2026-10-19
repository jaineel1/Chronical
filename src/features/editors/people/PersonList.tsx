import { Link, useNavigate } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { CIRCLES } from '@/data/types';
import { Button, Empty, SectionHeader } from '@/ui/primitives';
import { daysQuiet, personMeta, personTone, treeMeta } from '../lib/people';
import { useToday } from '../lib/useToday';
import { usePeopleAll } from '../queries';

export function PersonList() {
  const people = usePeopleAll();
  const today = useToday();
  const navigate = useNavigate();
  useShellBar('People', people ? treeMeta(people, today) : undefined);
  if (!people) return <Page>{null}</Page>;

  return (
    <Page>
      {people.length === 0 ? <Empty>Plant the first branch.</Empty> : null}
      {CIRCLES.map((c) => {
        const list = people.filter((p) => p.circle === c);
        if (!list.length) return null;
        return (
          <section key={c} aria-label={`Circle: ${c}`} className="flex flex-col gap-2 pb-2">
            <SectionHeader title={c[0]!.toUpperCase() + c.slice(1)} note={`${list.length} ${list.length === 1 ? 'person' : 'people'}`} />
            <ul className="m-0 flex list-none flex-col p-0 px-2.5">
              {list.map((p, i) => {
                const red = personTone(daysQuiet(p, today)) === 'red';
                return (
                  <li key={p.id} className={i ? 'border-t border-faint' : ''}>
                    <Link to={`/edit/people/${p.id}`} className="flex items-baseline justify-between gap-3 py-2 text-ink no-underline">
                      <span className="min-w-0">{p.name}</span>
                      <span className={`shrink-0 text-right ${red ? 'text-red' : 'text-mid'}`}>
                        {personMeta(p, today).split(', ')[0]}, every {p.contactEveryDays}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
      <div className="px-2.5 pt-1">
        <Button onClick={() => navigate('/edit/people/new')}>Add a person</Button>
      </div>
    </Page>
  );
}
