import { useState } from 'react';
import { newId } from '@/data/ids';
import { PILLARS, PILLAR_LABEL, pillarFromLabel, type Pillar, type Quest } from '@/data/types';
import { Button, TextInput } from '@/ui/primitives';
import { EditActions } from './EditActions';

/** Pillar choice shared by the quest and plan editors. Empty means no pillar. */
export function PillarSelect({ value, label, onChange }: { value: Pillar | undefined; label: string; onChange: (p: Pillar | undefined) => void }) {
  return (
    <select
      aria-label={label}
      className="border-0 border-b border-faint bg-transparent py-1 text-ink outline-none focus:border-ink"
      value={value ?? ''}
      onChange={(e) => onChange(pillarFromLabel(e.target.value))}
    >
      <option value="">No pillar</option>
      {PILLARS.map((p) => (
        <option key={p} value={p}>
          {PILLAR_LABEL[p]}
        </option>
      ))}
    </select>
  );
}

/** Quests keep their pillar, reward and done state. Rows with no text are dropped on save. */
export function QuestEditor({
  initial,
  idPrefix = '',
  onSave,
  onCancel,
}: {
  initial: Quest[];
  /** Prefix of the ids of this kind of quest (weekly and monthly quests are told apart by it). */
  idPrefix?: string;
  onSave: (quests: Quest[]) => Promise<void>;
  onCancel: () => void;
}) {
  const [quests, setQuests] = useState(initial);
  const set = (i: number, patch: Partial<Quest>) => setQuests(quests.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  return (
    <EditActions onSave={() => onSave(quests.map((q) => ({ ...q, text: q.text.trim(), reward: q.reward?.trim() || undefined })).filter((q) => q.text))} onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        {quests.map((q, i) => (
          <div key={q.id} className="flex flex-col gap-1.5">
            <TextInput className="font-serif text-[16px]" aria-label={`Quest ${i + 1}`} value={q.text} onChange={(e) => set(i, { text: e.target.value })} />
            <TextInput className="font-serif text-[16px] text-mid" aria-label={`Reward for quest ${i + 1}`} placeholder="Reward" value={q.reward ?? ''} onChange={(e) => set(i, { reward: e.target.value })} />
            <div className="flex items-center gap-4">
              <PillarSelect value={q.pillar} label={`Pillar for quest ${i + 1}`} onChange={(pillar) => set(i, { pillar })} />
              <Button variant="text" className="text-mid" aria-label={`Delete quest ${i + 1}`} onClick={() => setQuests(quests.filter((_, j) => j !== i))}>
                Delete
              </Button>
            </div>
          </div>
        ))}
        <Button variant="text" className="self-start" onClick={() => setQuests([...quests, { id: `${idPrefix}${newId()}`, text: '', done: false }])}>
          Add a line
        </Button>
      </div>
    </EditActions>
  );
}
