import { useState } from 'react';
import { affirmationRepo, dayLogRepo } from '@/data/repo';
import { isGenericAffirmation } from '@/lib/parse/reply';
import { Button } from '@/ui/primitives';
import { EditableSection } from './edit/EditableSection';
import { LineListEditor } from './edit/LineListEditor';

/**
 * One affirmation at a time, italic serif, with "Keep". Keeping saves it and shows the next one;
 * after the last it reads "Kept". A line with no number and no name from the log carries a quiet
 * "no number or name" title, shown on hover only. "Edit" opens every line for editing.
 */
export function AffirmationRow({ date, affirmations, kept, knownNouns }: { date: string; affirmations: string[]; kept: Set<string>; knownNouns: string[] }) {
  const [index, setIndex] = useState<number | null>(null);
  const firstOpen = affirmations.findIndex((a) => !kept.has(a));
  const i = Math.min(index ?? (firstOpen === -1 ? affirmations.length - 1 : firstOpen), affirmations.length - 1);
  const text = affirmations[i];
  if (!text) return null;
  const isKept = kept.has(text);
  const generic = isGenericAffirmation(text, knownNouns);

  async function keep() {
    if (!text) return;
    await affirmationRepo.keep(text, date);
    const next = affirmations.findIndex((a, j) => j > i && !kept.has(a));
    setIndex(next === -1 ? i : next);
  }

  return (
    <EditableSection
      title="Affirmation"
      note={affirmations.length > 1 ? `${i + 1} of ${affirmations.length}` : undefined}
      label="the affirmations"
      testId="affirmation"
      edit={(close) => (
        <LineListEditor
          label="Affirmation"
          initial={affirmations}
          onSave={async (lines) => {
            await dayLogRepo.update(date, { affirmations: lines });
            setIndex(null);
            close();
          }}
          onCancel={close}
        />
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <p className="m-0 font-serif text-[15px] leading-[1.45] italic" title={generic ? 'No number or name from your log' : undefined}>
          {text}
        </p>
        <Button variant="outline" className="shrink-0" onClick={() => void keep()} disabled={isKept} aria-label={isKept ? 'Kept' : 'Keep this affirmation'}>
          {isKept ? 'Kept' : 'Keep'}
        </Button>
      </div>
    </EditableSection>
  );
}
