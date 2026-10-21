import { useState } from 'react';
import { Button, TextInput } from '@/ui/primitives';
import { EditActions } from './EditActions';

/** Controlled list of lines: one input per line, a delete per line, "Add a line". */
export function LineListFields({ label, lines, onChange }: { label: string; lines: string[]; onChange: (lines: string[]) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      {lines.map((line, i) => (
        <div key={i} className="flex items-center gap-3">
          <TextInput
            className="min-w-0 flex-1 font-serif text-[16px]"
            aria-label={`${label}, line ${i + 1}`}
            value={line}
            onChange={(e) => onChange(lines.map((l, j) => (j === i ? e.target.value : l)))}
          />
          <Button variant="text" className="shrink-0 text-mid" aria-label={`Delete ${label}, line ${i + 1}`} onClick={() => onChange(lines.filter((_, j) => j !== i))}>
            Delete
          </Button>
        </div>
      ))}
      <Button variant="text" className="self-start" onClick={() => onChange([...lines, ''])}>
        Add a line
      </Button>
    </div>
  );
}

/** Lines of text with Save and Cancel. Blank lines are dropped on save. */
export function LineListEditor({
  label,
  initial,
  onSave,
  onCancel,
}: {
  label: string;
  initial: string[];
  onSave: (lines: string[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [lines, setLines] = useState(initial);
  return (
    <EditActions onSave={() => onSave(lines.map((l) => l.trim()).filter(Boolean))} onCancel={onCancel}>
      <LineListFields label={label} lines={lines} onChange={setLines} />
    </EditActions>
  );
}
