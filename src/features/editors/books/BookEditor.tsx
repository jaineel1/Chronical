import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import type { Book, BookStatus } from '@/data/types';
import { formatShortDate } from '@/lib/dates';
import { Button, Field, SectionHeader, TextInput } from '@/ui/primitives';
import { LoreSection } from '../lib/LoreSection';
import { Missing } from '../lib/Missing';
import { bookRepo, lessonRepo } from '../lib/repos';
import { ChipChoice, ChoiceGroup, ConfirmAction, ErrorText, SaveBar, useGoBack } from '../lib/ui';
import { useDraft } from '../lib/useDraft';
import { useBook, useLessons } from '../queries';
import { BOOK_STATUSES, BOOK_STATUS_LABEL } from './BookList';

interface BookForm {
  title: string;
  author: string;
  status: BookStatus;
}

function toForm(b: Book | null): BookForm {
  return { title: b?.title ?? '', author: b?.author ?? '', status: b?.status ?? 'reading' };
}

export function BookEditor() {
  const { id } = useParams();
  const row = useBook(id);
  useShellBar(id ? 'Edit book' : 'New book');
  if (row === undefined) return <Page>{null}</Page>;
  if (id && row === null) return <Missing what="book" back="/edit/books" />;
  return <BookFormView key={id ?? 'new'} row={row} />;
}

function BookFormView({ row }: { row: Book | null }) {
  const live = useMemo(() => toForm(row), [row]);
  const [draft, set] = useDraft(live);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const goBack = useGoBack('/edit/books');
  const navigate = useNavigate();
  const titleError = tried && !draft.title.trim() ? 'Give the book a title.' : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const fields = { title: draft.title.trim(), author: draft.author.trim() || undefined, status: draft.status };
      if (row) await bookRepo.update(row.id, fields);
      else await bookRepo.create(fields);
      goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <form onSubmit={save} noValidate className="flex flex-col gap-2" aria-label={row ? `Edit ${row.title}` : 'New book'}>
        <SectionHeader title={row ? row.title : 'New book'} note={row ? BOOK_STATUS_LABEL[row.status].toLowerCase() : 'lessons you apply'} />
        <div className="flex flex-col gap-4 px-2.5 pt-1 pb-3">
          <Field label="Title">
            <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Deep Work" aria-invalid={!!titleError} />
            {titleError ? <ErrorText>{titleError}</ErrorText> : null}
          </Field>
          <Field label="Author, optional">
            <TextInput value={draft.author} onChange={(e) => set({ author: e.target.value })} placeholder="Cal Newport" />
          </Field>
          <ChoiceGroup label="Status">
            <ChipChoice options={BOOK_STATUSES} value={draft.status} render={(s) => BOOK_STATUS_LABEL[s].toLowerCase()} onChange={(s) => set({ status: s })} />
          </ChoiceGroup>
        </div>
        <SaveBar onBack={goBack} saving={saving} note={titleError ? <ErrorText>Still missing: a title.</ErrorText> : null} />
      </form>

      {row ? (
        <>
          <Lessons bookId={row.id} />
          <div className="pt-4">
            <LoreSection type="book" itemId={row.id} />
          </div>
          <div className="px-2.5 pt-6">
            <ConfirmAction
              label="Delete this book"
              question={`Delete ${row.title} and its lessons?`}
              confirmLabel="Delete"
              onConfirm={async () => {
                await bookRepo.remove(row.id);
                navigate('/edit/books', { replace: true });
              }}
            />
          </div>
        </>
      ) : null}
    </Page>
  );
}

function Lessons({ bookId }: { bookId: string }) {
  const lessons = useLessons(bookId);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Write the lesson as something to do.');
      return;
    }
    setError(null);
    await lessonRepo.create(bookId, text);
    setText('');
  }

  return (
    <section aria-label="Lessons" className="flex flex-col gap-2 pt-4">
      <SectionHeader title="Lessons" note={lessons?.length ? `${lessons.length} kept` : 'none yet'} />
      <div className="flex flex-col gap-3 px-2.5">
        {lessons?.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {lessons.map((l, i) => (
              <li key={l.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-2 ${i ? 'border-t border-faint' : ''}`}>
                <span className="min-w-0 flex-1">{l.text}</span>
                <ConfirmAction
                  quiet
                  label="Remove"
                  question="Remove this lesson?"
                  confirmLabel="Remove"
                  askingClassName="basis-full order-last"
                  onConfirm={() => lessonRepo.remove(l.id)}
                />
                <span className="basis-full text-mid">
                  {l.appliedCount === 0
                    ? 'Not applied yet'
                    : `Applied ${l.appliedCount === 1 ? 'once' : `${l.appliedCount} times`}${l.lastApplied ? `, last on ${formatShortDate(l.lastApplied)}` : ''}`}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={add} className="flex flex-col gap-3 border border-dashed border-faint p-3" aria-label="Add a lesson">
          <Field label="A lesson, as something to do">
            <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Schedule the block the night before." />
          </Field>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button type="submit" variant="outline" className="self-start">
            Add the lesson
          </Button>
        </form>
      </div>
    </section>
  );
}
