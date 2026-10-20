import { useEffect, useRef, useState, type ReactNode } from 'react';
import { dayLogRepo } from '@/data/repo';
import type { DayLog } from '@/data/types';
import { formatScreen } from '@/lib/prompt/dayLog';
import { Chip, NumberTile, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { LiveCheck, StepButton, TextButton } from './parts';

export type NumberField = 'weight' | 'sleep' | 'mood' | 'screen';

type Yesterday = Pick<DayLog, 'weightKg' | 'sleepHours' | 'screenMin'> | null | undefined;

interface FieldSpec {
  label: string;
  /** Lower-case noun for button labels. */
  noun: string;
  unit: string;
  step: number;
  min: number;
  max: number;
  inputMode: 'decimal' | 'numeric' | 'text';
  hint: string;
  read: (log: DayLog | null | undefined) => number | undefined;
  write: (v: number | undefined) => Partial<DayLog>;
  format: (v: number) => string;
  /** undefined for an empty box (clears the value), null when it cannot be read. */
  parse: (text: string) => number | undefined | null;
  base: (yesterday: Yesterday) => number;
  round: (v: number) => number;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const trim1 = (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1));

function decimal(text: string): number | undefined | null {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  return /^\d+(?:\.\d*)?$/.test(t) ? Number(t) : null;
}

function integer(text: string): number | undefined | null {
  const t = text.trim();
  if (!t) return undefined;
  return /^\d+$/.test(t) ? Number(t) : null;
}

/** "2:10", "2h10", "2h", "130", "130m" → minutes. */
export function parseScreenTime(text: string): number | undefined | null {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  let m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,2})\s*h(?:\s*(\d{1,2})\s*m?)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d{1,4})\s*m?$/.exec(t);
  return m ? Number(m[1]) : null;
}

export const NUMBER_FIELDS: Record<NumberField, FieldSpec> = {
  weight: {
    label: 'Weight',
    noun: 'weight',
    unit: 'kg',
    step: 0.1,
    min: 20,
    max: 300,
    inputMode: 'decimal',
    hint: 'A weight in kg, like 72.4.',
    read: (l) => l?.weightKg,
    write: (v) => ({ weightKg: v }),
    format: (v) => v.toFixed(1),
    parse: decimal,
    base: (y) => y?.weightKg ?? 70,
    round: round1,
  },
  sleep: {
    label: 'Sleep',
    noun: 'sleep',
    unit: 'hours',
    step: 0.5,
    min: 0,
    max: 24,
    inputMode: 'decimal',
    hint: 'Hours of sleep, like 6.5.',
    read: (l) => l?.sleepHours,
    write: (v) => ({ sleepHours: v }),
    format: trim1,
    parse: decimal,
    base: (y) => y?.sleepHours ?? 7,
    round: round1,
  },
  mood: {
    label: 'Mood',
    noun: 'mood',
    unit: 'of 5',
    step: 1,
    min: 1,
    max: 5,
    inputMode: 'numeric',
    hint: 'A mood from 1 to 5.',
    read: (l) => l?.mood,
    write: (v) => ({ mood: v }),
    format: (v) => String(v),
    parse: integer,
    base: () => 3,
    round: Math.round,
  },
  screen: {
    label: 'Screen',
    noun: 'screen time',
    unit: 'h:mm',
    step: 10,
    min: 0,
    max: 1440,
    inputMode: 'text',
    hint: 'Screen time as h:mm, like 2:10.',
    read: (l) => l?.screenMin,
    write: (v) => ({ screenMin: v }),
    format: formatScreen,
    parse: parseScreenTime,
    base: (y) => y?.screenMin ?? 120,
    round: Math.round,
  },
};

const ORDER: NumberField[] = ['weight', 'sleep', 'mood', 'screen'];

function clamp(spec: FieldSpec, v: number): number {
  return spec.round(Math.min(spec.max, Math.max(spec.min, v)));
}

function screenNote(today: number | undefined, yesterday: number | undefined): { text: string; tone: 'mid' | 'red' } {
  if (today === undefined || yesterday === undefined) return { text: 'h:mm', tone: 'mid' };
  const diff = today - yesterday;
  if (diff === 0) return { text: 'same', tone: 'mid' };
  return diff > 0 ? { text: `+${diff} min`, tone: 'red' } : { text: `-${-diff} min`, tone: 'mid' };
}

interface Props {
  date: string;
  log: DayLog | null;
  yesterday: Yesterday;
}

export function NumbersSection({ date, log, yesterday }: Props) {
  const [active, setActive] = useState<NumberField | null>(null);
  const save = (changes: Partial<DayLog>) => dayLogRepo.update(date, changes);

  const tile = (field: NumberField) => {
    const spec = NUMBER_FIELDS[field];
    const value = spec.read(log);
    const shown: ReactNode = value === undefined ? <span className="text-faint">--</span> : spec.format(value);
    let unit = spec.unit;
    let tone: 'mid' | 'red' = 'mid';
    if (field === 'screen') ({ text: unit, tone } = screenNote(value, yesterday?.screenMin));
    const isActive = active === field;
    return (
      <button
        key={field}
        type="button"
        aria-expanded={isActive}
        aria-label={`${spec.label}: ${value === undefined ? 'not logged' : `${spec.format(value)} ${spec.unit}`}. Tap to change.`}
        onClick={() => setActive(isActive ? null : field)}
        className={`min-w-0 cursor-pointer border-0 border-b-2 bg-transparent p-0 pb-1 text-left ${isActive ? 'border-ink' : 'border-transparent'}`}
      >
        <NumberTile label={spec.label} value={shown} unit={unit} tone={tone} />
      </button>
    );
  };

  const energy = log?.energy;
  return (
    <>
      <SectionHeader title="Tonight's numbers" note="tap to change" />
      <Section>
        <div className="grid grid-cols-4 gap-3">{ORDER.map(tile)}</div>
        {active ? (
          <NumberEditor
            key={active}
            spec={NUMBER_FIELDS[active]}
            value={NUMBER_FIELDS[active].read(log)}
            yesterday={yesterday}
            onChange={(v) => save(NUMBER_FIELDS[active].write(v))}
            onClose={() => setActive(null)}
          />
        ) : null}
        <div className="flex flex-col gap-2 pt-1">
          <div className="flex items-center justify-between gap-3">
            <span>Energy</span>
            <span role="group" aria-label="Energy, 1 to 5" className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} active={energy === n} onClick={() => void save({ energy: energy === n ? undefined : n })}>
                  {n}
                </Chip>
              ))}
            </span>
          </div>
          <Counter label="Urges resisted" value={log?.urgesResisted ?? 0} onChange={(v) => save({ urgesResisted: v })} />
          <Counter label="Scroll sessions" value={log?.scrollSessions ?? 0} onChange={(v) => save({ scrollSessions: v })} />
          <label className="flex cursor-pointer items-center gap-3">
            <LiveCheck checked={!!log?.phoneFreeEvening} onCheckedChange={(next) => save({ phoneFreeEvening: next })} />
            <span>Phone-free evening</span>
          </label>
        </div>
      </Section>
    </>
  );
}

export function Counter({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => unknown }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-center gap-2">
        <StepButton aria-label={`${label}, one less`} disabled={value <= 0} onClick={() => void onChange(Math.max(0, value - 1))}>
          -
        </StepButton>
        <span className="w-7 text-center" aria-live="polite">
          {value}
        </span>
        <StepButton aria-label={`${label}, one more`} onClick={() => void onChange(value + 1)}>
          +
        </StepButton>
      </span>
    </div>
  );
}

function NumberEditor({
  spec,
  value,
  yesterday,
  onChange,
  onClose,
}: {
  spec: FieldSpec;
  value: number | undefined;
  yesterday: Yesterday;
  onChange: (v: number | undefined) => unknown;
  onClose: () => void;
}) {
  const [text, setText] = useState(value === undefined ? '' : spec.format(value));
  const [invalid, setInvalid] = useState(false);
  const base = spec.base(yesterday);
  // The saved value arrives a tick after each write; steps count from what was last set here.
  const current = useRef(value);
  useEffect(() => {
    current.current = value;
  }, [value]);

  function step(dir: 1 | -1) {
    const next = clamp(spec, (current.current ?? base) + dir * spec.step);
    current.current = next;
    setText(spec.format(next));
    setInvalid(false);
    void onChange(next);
  }

  function type(next: string) {
    setText(next);
    const parsed = spec.parse(next);
    if (parsed === undefined) {
      setInvalid(false);
      current.current = undefined;
      void onChange(undefined);
    } else if (parsed === null || parsed < spec.min || parsed > spec.max) {
      setInvalid(true);
    } else {
      setInvalid(false);
      current.current = spec.round(parsed);
      void onChange(current.current);
    }
  }

  return (
    <div className="flex flex-col gap-1" data-testid="number-editor">
      <div className="flex items-center gap-2">
        <StepButton aria-label={`Less ${spec.noun}`} onClick={() => step(-1)}>
          -
        </StepButton>
        <div className="w-20">
          <TextInput
            className="text-center text-[18px]"
            value={text}
            inputMode={spec.inputMode}
            placeholder={spec.format(base)}
            aria-label={`${spec.label} in ${spec.unit === 'h:mm' ? 'hours and minutes' : spec.unit}`}
            aria-invalid={invalid}
            onChange={(e) => type(e.target.value)}
            onBlur={() => {
              if (invalid) {
                setText(value === undefined ? '' : spec.format(value));
                setInvalid(false);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') onClose();
            }}
          />
        </div>
        <StepButton aria-label={`More ${spec.noun}`} onClick={() => step(1)}>
          +
        </StepButton>
        <span className="text-mid">{spec.unit}</span>
        <TextButton className="ml-auto" onClick={onClose}>
          Done
        </TextButton>
      </div>
      {invalid ? <span className="text-red">{spec.hint}</span> : null}
    </div>
  );
}
