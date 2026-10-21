import { useState, type ReactNode } from 'react';
import { Section, SectionHeader } from '@/ui/primitives';
import { EditButton } from './EditActions';

/**
 * A SectionHeader with a small "Edit" in its action slot. Pressing it swaps the content for the editor
 * in place; `edit` receives `close`, which the editor's save handler calls once the write is done.
 */
export function EditableSection({
  title,
  note,
  label,
  testId,
  edit,
  children,
}: {
  title: ReactNode;
  note?: ReactNode;
  /** What "Edit" edits, for its accessible name: "Edit the letter". */
  label: string;
  testId?: string;
  edit: (close: () => void) => ReactNode;
  children: ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  return (
    <div className="flex flex-col gap-1.5" data-testid={testId}>
      <SectionHeader title={title} note={editing ? undefined : note} action={editing ? undefined : <EditButton label={label} onClick={() => setEditing(true)} />} />
      <Section>{editing ? edit(() => setEditing(false)) : children}</Section>
    </div>
  );
}
