import { useState, type FormEvent } from 'react';
import { noteRepo } from '@/data/repo';
import { clockTime } from '@/lib/game/calendar';
import { Button, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { TextButton } from './parts';
import { useNotes } from './queries';

/** One line in, saved as a 'life' note for `date` on Add or Enter. */
export function LifeLineForm({ date, id = 'life-line' }: { date: string; id?: string }) {
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  async function add(e: FormEvent) {
    e.preventDefault();
    setError(undefined);
    try {
      await noteRepo.add(date, 'life', text);
      setText('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The line could not be saved.');
    }
  }

  return (
    <form onSubmit={(e) => void add(e)} className="flex flex-col gap-1">
      <span className="flex items-baseline gap-3">
        <TextInput id={id} aria-label="Life line" className="font-serif text-[16px]" value={text} placeholder="What just happened" autoComplete="off" onChange={(e) => setText(e.target.value)} />
        <Button type="submit" variant="outline" disabled={!text.trim()}>
          Add
        </Button>
      </span>
      {error ? <span className="text-red">{error}</span> : null}
    </form>
  );
}

/** Timestamped lines about what happens during the day. All of it goes into tonight's prompt. */
export function LifeFeed({ date }: { date: string }) {
  const notes = useNotes(date, 'life');
  return (
    <>
      <SectionHeader title="Life feed" note="drop a line any time" />
      <Section>
        <span className="text-mid">Drop a line whenever something happens. It all goes into tonight's prompt.</span>
        <LifeLineForm date={date} />
        {notes && notes.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
            {notes.map((n) => (
              <li key={n.id} className="flex items-baseline gap-3" data-testid="life-note">
                <span className="shrink-0 text-mid">{clockTime(new Date(n.at))}</span>
                <span className="min-w-0 flex-1 font-serif text-[16px]">{n.text}</span>
                <TextButton aria-label={`Delete ${n.text}`} onClick={() => void noteRepo.remove(n.id)}>
                  Delete
                </TextButton>
              </li>
            ))}
          </ul>
        ) : null}
      </Section>
    </>
  );
}
