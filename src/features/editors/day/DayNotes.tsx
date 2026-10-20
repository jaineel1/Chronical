import { noteRepo } from '@/data/repo';
import type { Note } from '@/data/types';
import { Section, SectionHeader } from '@/ui/primitives';
import { ConfirmAction } from '../lib/ui';
import { TextField, useRunSave } from './fields';

const KIND_LABEL: Record<Note['kind'], string> = { rant: 'Rant', life: 'Life' };

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit', hour12: false });
}

export function DayNotes({ notes }: { notes: Note[] }) {
  const run = useRunSave();
  if (!notes.length) return null;
  return (
    <>
      <SectionHeader title="Notes" note={`${notes.length} written`} />
      <Section className="gap-5">
        {notes.map((n, i) => (
          <div key={n.id} className="flex flex-col gap-2">
            <TextField
              multiline
              label={`${KIND_LABEL[n.kind]} note ${i + 1}${timeOf(n.at) ? `, ${timeOf(n.at)}` : ''}`}
              value={n.text}
              onSave={async (v) => {
                if (!v) throw new Error('A note cannot be empty. Delete it instead.');
                await noteRepo.update(n.id, v);
              }}
            />
            <ConfirmAction label={`Delete note ${i + 1}`} question="Delete this note?" confirmLabel="Delete" onConfirm={() => run(() => noteRepo.remove(n.id))} />
          </div>
        ))}
      </Section>
    </>
  );
}
