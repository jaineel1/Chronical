import { useState, type ReactNode } from 'react';
import { Button } from '@/ui/primitives';

export const REPASTE_HINT = 'Pasting a new reply at the Campfire replaces these edits.';

/** The small "Edit" text button that sits in a SectionHeader's action slot. */
export function EditButton({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <Button variant="text" onClick={onClick} aria-label={`Edit ${label}`}>
      Edit
    </Button>
  );
}

/**
 * Save and Cancel with the one-line hint. A failed save shows its message in red and keeps the editor
 * open, so nothing typed is lost.
 */
export function EditActions({ onSave, onCancel, children }: { onSave: () => Promise<void>; onCancel: () => void; children?: ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  async function save() {
    setBusy(true);
    setError(undefined);
    try {
      await onSave();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
      setBusy(false);
    }
  }
  return (
    <div className="flex flex-col gap-2">
      {children}
      <div className="flex items-center gap-4">
        <Button variant="primary" onClick={() => void save()} disabled={busy}>
          Save
        </Button>
        <Button variant="text" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
      {error ? <span className="text-red">{error}</span> : null}
      <span className="text-mid">{REPASTE_HINT}</span>
    </div>
  );
}
