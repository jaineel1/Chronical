import { useState } from 'react';
import { newId } from '@/data/ids';
import type { PlanBlock } from '@/data/types';
import { Button, TextInput } from '@/ui/primitives';
import { EditActions } from './EditActions';
import { PillarSelect } from './QuestEditor';

const TIME = 'border-0 border-b border-faint bg-transparent py-1 outline-none focus:border-ink';

/** Plan blocks keep start, end, text, pillar and done. Blocks with no text are dropped on save. */
export function PlanEditor({ initial, onSave, onCancel }: { initial: PlanBlock[]; onSave: (plan: PlanBlock[]) => Promise<void>; onCancel: () => void }) {
  const [blocks, setBlocks] = useState(initial);
  const set = (i: number, patch: Partial<PlanBlock>) => setBlocks(blocks.map((b, j) => (j === i ? { ...b, ...patch } : b)));
  return (
    <EditActions onSave={() => onSave(blocks.map((b) => ({ ...b, text: b.text.trim() })).filter((b) => b.text))} onCancel={onCancel}>
      <div className="flex flex-col gap-3">
        {blocks.map((b, i) => (
          <div key={b.id} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-3">
              <input type="time" aria-label={`Start of block ${i + 1}`} className={TIME} value={b.start} onChange={(e) => set(i, { start: e.target.value })} />
              <span className="text-mid">to</span>
              <input type="time" aria-label={`End of block ${i + 1}`} className={TIME} value={b.end} onChange={(e) => set(i, { end: e.target.value })} />
            </div>
            <TextInput className="font-serif text-[16px]" aria-label={`Block ${i + 1}`} value={b.text} onChange={(e) => set(i, { text: e.target.value })} />
            <div className="flex items-center gap-4">
              <PillarSelect value={b.pillar} label={`Pillar for block ${i + 1}`} onChange={(pillar) => set(i, { pillar })} />
              <Button variant="text" className="text-mid" aria-label={`Delete block ${i + 1}`} onClick={() => setBlocks(blocks.filter((_, j) => j !== i))}>
                Delete
              </Button>
            </div>
          </div>
        ))}
        <Button variant="text" className="self-start" onClick={() => setBlocks([...blocks, { id: newId(), start: '09:00', end: '10:00', text: '' }])}>
          Add a line
        </Button>
      </div>
    </EditActions>
  );
}
