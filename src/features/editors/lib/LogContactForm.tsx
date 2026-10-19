import { useState, type FormEvent } from 'react';
import type { Contact } from '@/data/types';
import { Button, Field, TextInput } from '@/ui/primitives';
import { personRepo } from './repos';
import { ChipChoice, ChoiceGroup } from './ui';
import { useToday } from './useToday';

export const CONTACT_KINDS: readonly Contact['kind'][] = ['call', 'meet', 'text', 'other'];

const KIND_PHRASE: Record<Contact['kind'], string> = { call: 'a call', meet: 'a meeting', text: 'a text', other: 'contact' };

/** "Logged a call with Mentor." */
export function contactMessage(kind: Contact['kind'], name: string): string {
  return `Logged ${KIND_PHRASE[kind]} with ${name}.`;
}

/**
 * Inline form: how you reached out, an optional note, and (on the person page) the day.
 * Saving adds a Contact row and moves the person's last contact forward.
 */
export function LogContactForm({
  personId,
  personName,
  withDate = false,
  onDone,
  onCancel,
}: {
  personId: string;
  personName: string;
  withDate?: boolean;
  onDone: (message: string) => void;
  onCancel: () => void;
}) {
  const today = useToday();
  const [kind, setKind] = useState<Contact['kind'] | undefined>();
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!kind || busy) return;
    setBusy(true);
    try {
      const day = withDate && /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today ? date : today;
      await personRepo.logContact(personId, kind, day, note);
      onDone(contactMessage(kind, personName));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-3 border border-dashed border-faint p-3" aria-label={`Log contact with ${personName}`}>
      <ChoiceGroup label="How did you reach out?">
        <ChipChoice options={CONTACT_KINDS} value={kind} onChange={setKind} />
      </ChoiceGroup>
      {withDate ? (
        <Field label="Day">
          <TextInput type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} />
        </Field>
      ) : null}
      <Field label="Note, optional">
        <TextInput value={note} onChange={(e) => setNote(e.target.value)} placeholder="One line you want to remember" />
      </Field>
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="text" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!kind || busy}>
          Save
        </Button>
      </div>
    </form>
  );
}
