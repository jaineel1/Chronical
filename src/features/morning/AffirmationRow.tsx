import { useState } from 'react';
import { affirmationRepo } from '@/data/repo';
import { isGenericAffirmation } from '@/lib/parse/reply';
import { Button } from '@/ui/primitives';

/**
 * One affirmation at a time, italic serif, with "Keep". Keeping saves it and shows the next one;
 * after the last it reads "Kept". Lines with no number and no name from the log are marked generic.
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
    <div className="flex items-center justify-between gap-3 border-t border-faint px-2.5 pt-2" data-testid="affirmation">
      <p className="m-0 font-serif text-[15px] leading-[1.45] italic">
        {text}
        {generic ? <span className="font-pixel text-mid not-italic"> (generic)</span> : null}
      </p>
      <Button variant="outline" className="shrink-0" onClick={() => void keep()} disabled={isKept} aria-label={isKept ? 'Kept' : 'Keep this affirmation'}>
        {isKept ? 'Kept' : 'Keep'}
      </Button>
    </div>
  );
}
