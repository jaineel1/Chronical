import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Chip, TextArea, TextInput } from '@/ui/primitives';
import { ErrorText } from '../lib/ui';
import type { NumberReader } from './parse';

/** Runs a save and tells the page about it ("Saved", or the error). Provided by DayEditor. */
export type RunSave = (save: () => Promise<unknown>) => Promise<void>;

const SaveContext = createContext<RunSave | null>(null);
export const SaveProvider = SaveContext.Provider;

export function useRunSave(): RunSave {
  const run = useContext(SaveContext);
  if (!run) throw new Error('Day fields must sit inside a SaveProvider.');
  return run;
}

/** A number box that saves when it loses focus. Unreadable or out-of-range text is not saved. */
export function NumberField({
  label,
  value,
  read,
  min,
  max,
  hint,
  format = (n) => String(n),
  placeholder = '--',
  inputMode = 'decimal',
  onSave,
}: {
  label: string;
  value: number | undefined;
  read: NumberReader;
  min?: number;
  max?: number;
  hint: string;
  format?: (n: number) => string;
  placeholder?: string;
  inputMode?: 'decimal' | 'numeric' | 'text';
  onSave: (v: number | undefined) => Promise<unknown>;
}) {
  const run = useRunSave();
  const shown = value === undefined ? '' : format(value);
  const [text, setText] = useState(shown);
  const [bad, setBad] = useState(false);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(shown);
  }, [shown]);

  function commit() {
    focused.current = false;
    const v = read(text);
    if (v === null || (v !== undefined && ((min !== undefined && v < min) || (max !== undefined && v > max)))) {
      setBad(true);
      return;
    }
    setBad(false);
    if (v !== value) void run(() => onSave(v));
    else setText(shown);
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="flex flex-col gap-1">
        <span className="text-mid">{label}</span>
        <TextInput
          inputMode={inputMode}
          value={text}
          placeholder={placeholder}
          aria-invalid={bad}
          autoComplete="off"
          onFocus={() => {
            focused.current = true;
          }}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      </label>
      {bad ? <ErrorText>{hint}</ErrorText> : null}
    </div>
  );
}

/** A text box (one line, or several) that saves its trimmed text when it loses focus. */
export function TextField({
  label,
  value,
  onSave,
  multiline = false,
  placeholder,
}: {
  label: string;
  value: string;
  onSave: (text: string) => Promise<unknown>;
  multiline?: boolean;
  placeholder?: string;
}) {
  const run = useRunSave();
  const [text, setText] = useState(value);
  const focused = useRef(false);
  useEffect(() => {
    if (!focused.current) setText(value);
  }, [value]);

  function commit() {
    focused.current = false;
    const next = text.trim();
    if (next !== value.trim()) void run(() => onSave(next));
    else setText(value);
  }

  const common = {
    value: text,
    placeholder,
    onFocus: () => {
      focused.current = true;
    },
    onBlur: commit,
  };
  return (
    <label className="flex flex-col gap-1">
      <span className="text-mid">{label}</span>
      {multiline ? (
        <TextArea rows={3} {...common} onChange={(e) => setText(e.target.value)} />
      ) : (
        <TextInput
          className="font-serif text-[16px]"
          autoComplete="off"
          {...common}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
      )}
    </label>
  );
}

/** 1 to 5 chips; tapping the chosen one clears it. */
export function RatingField({ label, value, onSave }: { label: string; value: number | undefined; onSave: (v: number | undefined) => Promise<unknown> }) {
  const run = useRunSave();
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span role="group" aria-label={`${label}, 1 to 5`} className="flex gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <Chip key={n} active={value === n} onClick={() => void run(() => onSave(value === n ? undefined : n))}>
            {n}
          </Chip>
        ))}
      </span>
    </div>
  );
}

export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-3">
      <span className="text-mid">{title}</span>
      {children}
    </div>
  );
}
