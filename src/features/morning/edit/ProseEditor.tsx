import { useState } from 'react';
import { TextArea } from '@/ui/primitives';
import { EditActions } from './EditActions';

/** Prose in the serif face: the letter, the day in numbers, the lesson, the rant answer. */
export function ProseEditor({
  label,
  initial,
  rows = 6,
  onSave,
  onCancel,
}: {
  label: string;
  initial: string;
  rows?: number;
  onSave: (text: string) => Promise<void>;
  onCancel: () => void;
}) {
  const [text, setText] = useState(initial);
  return (
    <EditActions onSave={() => onSave(text.trim())} onCancel={onCancel}>
      <TextArea aria-label={label} rows={rows} value={text} onChange={(e) => setText(e.target.value)} autoFocus />
    </EditActions>
  );
}
