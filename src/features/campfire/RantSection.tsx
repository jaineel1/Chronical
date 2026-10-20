import { useState } from 'react';
import { noteRepo } from '@/data/repo';
import type { DayLog, Note } from '@/data/types';
import { clockTime } from '@/lib/game/calendar';
import { Button, Section, SectionHeader, TextArea } from '@/ui/primitives';
import { TextButton } from './parts';
import { useNotes } from './queries';

function RantRow({ note }: { note: Note }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.text);
  const [error, setError] = useState<string>();

  async function save() {
    setError(undefined);
    try {
      if (!text.trim()) throw new Error('A rant needs words. Delete it instead.');
      await noteRepo.update(note.id, text);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The rant could not be saved.');
    }
  }

  return (
    <li className="flex flex-col gap-1 border-t border-faint pt-2" data-testid="rant-note">
      <span className="text-mid">{clockTime(new Date(note.at))}</span>
      {editing ? (
        <>
          <TextArea aria-label="Edit the rant" rows={3} value={text} onChange={(e) => setText(e.target.value)} />
          <span className="flex gap-6">
            <TextButton onClick={() => void save()}>Save</TextButton>
            <TextButton
              onClick={() => {
                setText(note.text);
                setError(undefined);
                setEditing(false);
              }}
            >
              Cancel
            </TextButton>
          </span>
        </>
      ) : (
        <>
          <p className="m-0 whitespace-pre-wrap font-serif text-[16px] leading-[1.5]">{note.text}</p>
          <span className="flex gap-6">
            <TextButton onClick={() => setEditing(true)}>Edit</TextButton>
            <TextButton onClick={() => void noteRepo.remove(note.id)}>Delete</TextButton>
          </span>
        </>
      )}
      {error ? <span className="text-red">{error}</span> : null}
    </li>
  );
}

/** Free text for the game master: every save is one note, listed below with its time. */
export function RantSection({ date, log }: { date: string; log: DayLog | null }) {
  const notes = useNotes(date, 'rant');
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();

  async function save() {
    setError(undefined);
    try {
      await noteRepo.add(date, 'rant', text);
      setText('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'The rant could not be saved.');
    }
  }

  return (
    <>
      <SectionHeader title="Rant box" note="the game master reads it tonight" />
      <Section>
        <label htmlFor="rant-text" className="text-mid">
          Everything, unfiltered. The game master reads it tonight.
        </label>
        <TextArea id="rant-text" rows={4} value={text} placeholder="Say it all" onChange={(e) => setText(e.target.value)} />
        <span className="flex items-baseline gap-4">
          <Button variant="outline" onClick={() => void save()} disabled={!text.trim()}>
            Save the rant
          </Button>
          {error ? <span className="text-red">{error}</span> : null}
        </span>
        {notes && notes.length > 0 ? (
          <ul className="m-0 flex list-none flex-col gap-2 p-0">
            {notes.map((n) => (
              <RantRow key={n.id} note={n} />
            ))}
          </ul>
        ) : null}
        {log?.rantReplyMd ? (
          <div className="flex flex-col gap-1 border-t border-faint pt-2" data-testid="rant-reply">
            <span className="text-mid">The game master answers</span>
            <p className="m-0 whitespace-pre-wrap font-serif text-[16px] leading-[1.5]">{log.rantReplyMd}</p>
          </div>
        ) : null}
      </Section>
    </>
  );
}
