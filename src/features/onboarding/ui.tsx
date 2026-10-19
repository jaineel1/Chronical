/**
 * Small controls the wizard and the Vault share. They follow the Paper primitives (underline
 * inputs, hairlines, no boxes) and live here so the shared primitives file stays untouched.
 */
import { useEffect, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { PixelSprite } from '@/ui/PixelSprite';
import { BOOK_MAP, COINS_MAP, DROP_MAP, MID_PALETTE, MOON_SMALL_MAP, MOUNTAIN_MAP, PAPER, TREE_MAP } from '@/ui/sprites';
import { Check } from '@/ui/primitives';
import type { PartId } from './questions';

export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`cursor-pointer border-0 border-b border-faint bg-transparent py-1 pr-1 outline-none focus:border-ink ${className}`} {...rest}>
      {children}
    </select>
  );
}

/**
 * Checkbox with a label and an optional muted note under it. Optimistic: the box follows the tap
 * at once and re-syncs when the stored value arrives, so it never flickers back mid-write.
 */
export function CheckRow({
  checked,
  onChange,
  label,
  note,
  testId,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void | Promise<unknown>;
  label: ReactNode;
  note?: ReactNode;
  testId?: string;
}) {
  const [local, setLocal] = useState(checked);
  useEffect(() => setLocal(checked), [checked]);
  return (
    <label className="flex cursor-pointer items-start gap-3">
      {/* Check owns its className, so the alignment nudge sits on a wrapper. */}
      <span className="flex pt-[3px]">
        <Check
          checked={local}
          onChange={(e) => {
            setLocal(e.target.checked);
            void onChange(e.target.checked);
          }}
          data-testid={testId}
        />
      </span>
      <span className="flex flex-col gap-0.5">
        <span>{label}</span>
        {note ? <span className="text-mid">{note}</span> : null}
      </span>
    </label>
  );
}

/** The 2 px ink-on-faint line the mockups use for progress. */
export function ProgressLine({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="h-[2px] w-full bg-faint">
      <div className="h-[2px] bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

/* Small 7×5 marks for the parts that are not pillars. */
const PERSON_MAP = ['..xxx..', '..xxx..', '.xxxxx.', 'xxxxxxx', 'x.....x'] as const;
const CHEST_MAP = ['.xxxxx.', 'xxxxxxx', 'xxx.xxx', 'xxxxxxx', 'xxxxxxx'] as const;
const FLAG_MAP = ['xxxxx..', 'xxxxxx.', 'xxxx...', 'x......', 'x......'] as const;
const SUN_SMALL_MAP = ['.x.x.x.', '..xxx..', 'xxxxxxx', '..xxx..', '.x.x.x.'] as const;
const RED_PALETTE = { x: PAPER.red } as const;

const PART_ICON: Record<PartId, readonly string[]> = {
  identity: PERSON_MAP,
  body: MOUNTAIN_MAP,
  skin: DROP_MAP,
  mind: BOOK_MAP,
  dopamine: MOON_SMALL_MAP,
  work: COINS_MAP,
  money: CHEST_MAP,
  people: TREE_MAP,
  goals: FLAG_MAP,
  today: SUN_SMALL_MAP,
};

export function PartIcon({ part }: { part: PartId }) {
  return <PixelSprite map={PART_ICON[part]} palette={part === 'today' ? RED_PALETTE : MID_PALETTE} scale={2} />;
}

/** Row link used by the Vault index and lists: title, muted line, chevron. */
export function RowTitle({ title, sub, right }: { title: ReactNode; sub?: ReactNode; right?: ReactNode }) {
  return (
    <span className="flex min-w-0 flex-1 flex-col gap-0.5">
      <span className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate">{title}</span>
        {right}
      </span>
      {sub ? <span className="text-mid">{sub}</span> : null}
    </span>
  );
}
