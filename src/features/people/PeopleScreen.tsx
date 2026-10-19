import { useState } from 'react';
import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import type { Person } from '@/data/types';
import { LogContactForm } from '@/features/editors/lib/LogContactForm';
import { daysQuiet, mostOverdue, personMeta, personTone, quietNote, sortForTree, treeMeta, type PersonTone } from '@/features/editors/lib/people';
import { TextLink } from '@/features/editors/lib/ui';
import { useToday } from '@/features/editors/lib/useToday';
import { PixelSprite } from '@/ui/PixelSprite';
import { Button, Empty, SectionHeader } from '@/ui/primitives';
import { MID_PALETTE, TREE_MAP } from '@/ui/sprites';
import { usePeople } from './queries';

const TONE: Record<PersonTone, { name: string; meta: string; branch: string }> = {
  ink: { name: 'text-ink', meta: 'text-mid', branch: 'h-[2px] bg-mid' },
  mid: { name: 'text-mid', meta: 'text-mid', branch: 'h-[2px] bg-faint' },
  red: { name: 'text-red', meta: 'text-mid', branch: 'h-0 border-0 border-t-2 border-dashed border-red' },
  faint: { name: 'text-faint', meta: 'text-mid', branch: 'h-[2px] bg-faint' },
};

export function PeopleScreen() {
  const people = usePeople();
  const today = useToday();
  const [logged, setLogged] = useState<string | null>(null);
  useShellBar('People', people ? treeMeta(people, today) : undefined);

  if (!people) return <Page wide>{null}</Page>;
  if (people.length === 0) {
    return (
      <Page wide>
        <Empty action={<TextLink to="/edit/people/new">Add a person</TextLink>}>Plant the first branch.</Empty>
      </Page>
    );
  }

  const next = mostOverdue(people, today);
  return (
    <Page wide>
      <div className="grid grid-cols-1 gap-x-10 gap-y-3 lg:grid-cols-2 lg:items-start">
        <div className="flex min-w-0 flex-col gap-3 pt-1">
          <Tree people={sortForTree(people, today)} today={today} />
          <p className="m-0 text-mid">Dark names are people you spoke to this week, faded ones within two, red ones longer ago.</p>
        </div>
        <div className="flex min-w-0 flex-col gap-3 lg:pt-1">
          {next ? <ReachOut key={next.id} person={next} today={today} logged={logged} onLogged={setLogged} /> : null}
          <TextLink to="/edit/people/new" className="px-2.5">
            Add a person
          </TextLink>
        </div>
      </div>
    </Page>
  );
}

/** A 3px ink trunk under the tree sprite; branches alternate left and right, newest contact first. */
function Tree({ people, today }: { people: Person[]; today: string }) {
  return (
    <div className="flex flex-col items-center">
      <PixelSprite map={TREE_MAP} palette={MID_PALETTE} scale={3} />
      <div className="relative w-full">
        <div aria-hidden="true" className="absolute top-0 bottom-0 left-[calc(50%-1.5px)] w-[3px] bg-ink" />
        <ol aria-label="People, most recent contact first" className="m-0 grid list-none grid-cols-2 gap-y-5 p-0 pt-[22px] pb-6">
          {people.map((p, i) => (
            <Branch key={p.id} person={p} side={i % 2 === 0 ? 'left' : 'right'} today={today} />
          ))}
        </ol>
      </div>
      <div aria-hidden="true" className="h-[2px] w-full bg-faint" />
    </div>
  );
}

function Branch({ person, side, today }: { person: Person; side: 'left' | 'right'; today: string }) {
  const tone = TONE[personTone(daysQuiet(person, today))];
  const meta = personMeta(person, today);
  const branch = <span aria-hidden="true" className={`mt-[9px] w-6 shrink-0 ${tone.branch}`} />;
  const label = (
    <Link
      to={`/edit/people/${person.id}`}
      aria-label={`${person.name}, ${meta}`}
      className={`flex min-w-0 flex-col no-underline ${side === 'left' ? 'items-end text-right' : 'items-start text-left'}`}
    >
      <span className={`${tone.name} break-words`}>{person.name}</span>
      <span className={`${tone.meta} break-words`}>{meta}</span>
    </Link>
  );
  return side === 'left' ? (
    <li className="flex min-w-0 items-start justify-end gap-1.5 pr-[1.5px]">
      {label}
      {branch}
    </li>
  ) : (
    <li className="flex min-w-0 items-start gap-1.5 pt-[30px] pl-[1.5px]">
      {branch}
      {label}
    </li>
  );
}

function ReachOut({ person, today, logged, onLogged }: { person: Person; today: string; logged: string | null; onLogged: (m: string | null) => void }) {
  const [logging, setLogging] = useState(false);
  return (
    <section aria-label="Reach out today" data-testid="reach-out" className="flex flex-col gap-2">
      <SectionHeader title="Reach out today" note={quietNote(person, today)} />
      <div className="flex items-center justify-between gap-3 px-2.5">
        <div className="flex min-w-0 flex-col gap-0.5">
          <Link to={`/edit/people/${person.id}`} className="self-start text-ink no-underline" data-testid="reach-name">
            {person.name}
          </Link>
          <span className="text-mid">{person.notes?.trim() || `${person.circle}, closeness ${person.closeness} of 5${person.wantCloser ? ', you want closer' : ''}`}</span>
        </div>
        {!logging ? (
          <Button
            className="shrink-0"
            onClick={() => {
              onLogged(null);
              setLogging(true);
            }}
          >
            Log contact
          </Button>
        ) : null}
      </div>
      {logging ? (
        <div className="px-2.5">
          <LogContactForm personId={person.id} personName={person.name} onDone={onLogged} onCancel={() => setLogging(false)} />
        </div>
      ) : null}
      {logged ? <p className="m-0 px-2.5 text-mid">{logged}</p> : null}
    </section>
  );
}
