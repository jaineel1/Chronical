import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { CIRCLES, type Circle, type Person } from '@/data/types';
import { formatShortDate } from '@/lib/dates';
import { Button, Check, Field, SectionHeader, TextInput } from '@/ui/primitives';
import { LogContactForm } from '../lib/LogContactForm';
import { LoreSection } from '../lib/LoreSection';
import { Missing } from '../lib/Missing';
import { daysLabel, daysQuiet } from '../lib/people';
import { personRepo } from '../lib/repos';
import { ChipChoice, ChoiceGroup, ConfirmAction, ErrorText, SaveBar, numberOrUndefined, useGoBack } from '../lib/ui';
import { useDraft } from '../lib/useDraft';
import { useToday } from '../lib/useToday';
import { useContacts, usePerson } from '../queries';

interface PersonForm {
  name: string;
  circle: Circle | '';
  closeness: number;
  wantCloser: boolean;
  contactEveryDays: string;
  notes: string;
}

type Errors = Partial<Record<keyof PersonForm, string>>;

function toForm(p: Person | null): PersonForm {
  return {
    name: p?.name ?? '',
    circle: p?.circle ?? '',
    closeness: p?.closeness ?? 3,
    wantCloser: p?.wantCloser ?? false,
    contactEveryDays: String(p?.contactEveryDays ?? 7),
    notes: p?.notes ?? '',
  };
}

function validate(f: PersonForm): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Give them a name.';
  if (!f.circle) e.circle = 'Pick a circle.';
  const every = numberOrUndefined(f.contactEveryDays);
  if (every === undefined || every < 1 || every > 365 || !Number.isInteger(every)) e.contactEveryDays = 'A whole number of days, 1 to 365.';
  return e;
}

export function PersonEditor() {
  const { id } = useParams();
  const row = usePerson(id);
  useShellBar(id ? 'Edit person' : 'New person');
  if (row === undefined) return <Page>{null}</Page>;
  if (id && row === null) return <Missing what="person" back="/edit/people" />;
  return <PersonFormView key={id ?? 'new'} row={row} />;
}

function PersonFormView({ row }: { row: Person | null }) {
  const live = useMemo(() => toForm(row), [row]);
  const [draft, set] = useDraft(live);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const goBack = useGoBack('/people');
  const navigate = useNavigate();
  const today = useToday();
  const errors = tried ? validate(draft) : {};

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(validate(draft)).length || !draft.circle) return;
    setSaving(true);
    try {
      const fields = {
        name: draft.name.trim(),
        circle: draft.circle,
        closeness: draft.closeness,
        wantCloser: draft.wantCloser,
        contactEveryDays: numberOrUndefined(draft.contactEveryDays) ?? 7,
        notes: draft.notes.trim() || undefined,
      };
      if (row) await personRepo.update(row.id, fields);
      else await personRepo.create(fields);
      goBack();
    } finally {
      setSaving(false);
    }
  }

  const quiet = row ? daysQuiet(row, today) : null;
  const missing = Object.keys(errors).length;
  return (
    <Page>
      <form onSubmit={save} noValidate className="flex flex-col gap-2" aria-label={row ? `Edit ${row.name}` : 'New person'}>
        <SectionHeader title={row ? row.name : 'New branch'} note={row ? (quiet === null ? 'never contacted' : `${daysLabel(quiet)} quiet`) : 'on the people tree'} />
        <div className="flex flex-col gap-4 px-2.5 pt-1 pb-3">
          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Mentor" aria-invalid={!!errors.name} />
            {errors.name ? <ErrorText>{errors.name}</ErrorText> : null}
          </Field>
          <ChoiceGroup label="Circle" error={errors.circle}>
            <ChipChoice options={CIRCLES} value={draft.circle || undefined} onChange={(c) => set({ circle: c })} />
          </ChoiceGroup>
          <ChoiceGroup label="Closeness" hint="1 is an acquaintance, 5 is family-close.">
            <ChipChoice options={[1, 2, 3, 4, 5] as const} value={draft.closeness} onChange={(n) => set({ closeness: n })} />
          </ChoiceGroup>
          <label className="flex cursor-pointer items-center gap-2">
            <Check checked={draft.wantCloser} onChange={(e) => set({ wantCloser: e.target.checked })} />
            <span>I want to be closer</span>
          </label>
          <Field label="Reach out every" hint="Days between contacts before the branch starts to fade from your list.">
            <span className="flex items-baseline gap-2">
              <TextInput
                value={draft.contactEveryDays}
                inputMode="numeric"
                onChange={(e) => set({ contactEveryDays: e.target.value })}
                className="max-w-20"
                aria-invalid={!!errors.contactEveryDays}
              />
              <span className="text-mid">days</span>
            </span>
            {errors.contactEveryDays ? <ErrorText>{errors.contactEveryDays}</ErrorText> : null}
          </Field>
          <Field label="Notes" hint="What you will want to remember before the next call.">
            <TextInput value={draft.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="Last time: coffee, asked about work" />
          </Field>
        </div>
        <SaveBar onBack={goBack} saving={saving} note={missing ? <ErrorText>{missing === 1 ? 'One thing to fix above.' : `${missing} things to fix above.`}</ErrorText> : null} />
      </form>

      {row ? (
        <>
          <Contacts person={row} />
          <div className="pt-4">
            <LoreSection type="person" itemId={row.id} />
          </div>
          <div className="px-2.5 pt-6">
            <ConfirmAction
              label="Remove from the tree"
              question={`Remove ${row.name} and every contact you logged with them?`}
              confirmLabel="Remove"
              onConfirm={async () => {
                await personRepo.remove(row.id);
                navigate('/people', { replace: true });
              }}
            />
          </div>
        </>
      ) : null}
    </Page>
  );
}

const KIND_LABEL = { call: 'Call', meet: 'Met', text: 'Text', other: 'Other' } as const;

function Contacts({ person }: { person: Person }) {
  const contacts = useContacts(person.id);
  const [logging, setLogging] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section aria-label="Contacts" className="flex flex-col gap-2 pt-4">
      <SectionHeader title="Contacts" note={contacts?.length ? `${contacts.length} logged` : 'none yet'} />
      <div className="flex flex-col gap-3 px-2.5">
        {logging ? (
          <LogContactForm
            personId={person.id}
            personName={person.name}
            withDate
            onDone={(m) => {
              setMessage(m);
              setLogging(false);
            }}
            onCancel={() => setLogging(false)}
          />
        ) : (
          <Button
            variant="outline"
            className="self-start"
            onClick={() => {
              setMessage(null);
              setLogging(true);
            }}
          >
            Log contact
          </Button>
        )}
        {message ? <span className="text-mid">{message}</span> : null}
        {contacts?.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {contacts.map((c, i) => (
              <li key={c.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-2 py-2 ${i ? 'border-t border-faint' : ''}`}>
                <span className="w-14 shrink-0 text-mid">{formatShortDate(c.date)}</span>
                <span className="min-w-0 flex-1">
                  {KIND_LABEL[c.kind]}
                  {c.note ? <span className="text-mid">. {c.note}</span> : null}
                </span>
                <ConfirmAction
                  quiet
                  label="Remove"
                  question="Remove this contact? The last-contact day moves back to the one before."
                  confirmLabel="Remove"
                  askingClassName="basis-full"
                  onConfirm={() => personRepo.removeContact(c.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}
