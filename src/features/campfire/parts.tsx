/**
 * Small pieces the Campfire and Morning screens share: a clock, the thin ink progress line from
 * the scene blocks, a square stepper button, a line input that saves as you type, and links
 * styled as the two button kinds.
 */
import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { Check, TextInput } from '@/ui/primitives';

/** The current time, refreshed every `intervalMs`. */
export function useNow(intervalMs = 20_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(t);
  }, [intervalMs]);
  return now;
}

/** True while a CSS media query matches. Reads synchronously on first render so layouts do not flash. */
export function useMediaQuery(query: string): boolean {
  const read = () => typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(read);
  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const sync = () => setMatches(mql.matches);
    sync();
    mql.addEventListener('change', sync);
    return () => mql.removeEventListener('change', sync);
  }, [query]);
  return matches;
}

/** Tailwind's `lg`: the two-column desktop layouts. */
export function useIsDesktop(): boolean {
  return useMediaQuery('(min-width: 1024px)');
}

/** The 2px line under the scene text: faint track, ink fill. `value` is 0..1. */
export function ProgressLine({ value, label }: { value: number; label: string }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <div role="img" aria-label={label} className="h-[2px] bg-faint">
      <div className="h-[2px] bg-ink" style={{ width: `${pct}%` }} />
    </div>
  );
}

/**
 * A checkbox bound to stored data. It shows the new state the moment it is tapped and hands over to
 * the store once the write comes back, so it never flickers back while IndexedDB catches up.
 */
export function LiveCheck({
  checked,
  onCheckedChange,
  ...rest
}: { checked: boolean; onCheckedChange: (next: boolean) => unknown } & Omit<InputHTMLAttributes<HTMLInputElement>, 'checked' | 'onChange' | 'type'>) {
  const [pending, setPending] = useState<boolean | null>(null);
  useEffect(() => {
    setPending(null);
  }, [checked]);
  return (
    <Check
      {...rest}
      checked={pending ?? checked}
      onChange={(e) => {
        const next = e.target.checked;
        setPending(next);
        Promise.resolve(onCheckedChange(next)).catch(() => setPending(null));
      }}
    />
  );
}

/** A text button (walnut, no box). The shared Button's text variant keeps the md padding, so this stays local. */
export function TextButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`cursor-pointer border-0 bg-transparent p-0 text-left text-walnut disabled:cursor-default disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

/** Square outline button for steppers. */
export function StepButton({ className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={`inline-flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center border border-walnut bg-transparent text-walnut disabled:cursor-default disabled:opacity-50 ${className}`}
      {...rest}
    />
  );
}

/** A link that looks like the walnut primary button. */
export function ButtonLink({ to, children, className = '' }: { to: string; children: ReactNode; className?: string }) {
  return (
    <Link to={to} className={`inline-flex h-11 items-center justify-center whitespace-nowrap bg-walnut px-4 text-paper no-underline ${className}`}>
      {children}
    </Link>
  );
}

/** A link that looks like a text button. */
export function TextLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="text-walnut no-underline">
      {children}
    </Link>
  );
}

/**
 * One line of free text in the serif face. Keeps its own text while focused, saves half a second
 * after typing stops, and again on blur or unmount, so nothing typed is lost.
 */
export function LineInput({
  id,
  value,
  onSave,
  placeholder,
  label,
}: {
  id: string;
  value: string;
  onSave: (text: string) => void | Promise<unknown>;
  placeholder?: string;
  /** Accessible name when no <label for> points at the input. */
  label?: string;
}) {
  const [text, setText] = useState(value);
  const latest = useRef(value);
  const focused = useRef(false);
  const timer = useRef<number | undefined>(undefined);
  const save = useRef(onSave);
  save.current = onSave;

  useEffect(() => {
    if (!focused.current && !timer.current) {
      setText(value);
      latest.current = value;
    }
  }, [value]);

  const flush = () => {
    if (timer.current === undefined) return;
    window.clearTimeout(timer.current);
    timer.current = undefined;
    void save.current(latest.current.trim());
  };

  useEffect(() => flush, []);

  return (
    <TextInput
      id={id}
      className="font-serif text-[16px]"
      value={text}
      placeholder={placeholder}
      aria-label={label}
      autoComplete="off"
      onFocus={() => {
        focused.current = true;
      }}
      onBlur={() => {
        focused.current = false;
        flush();
      }}
      onChange={(e) => {
        const next = e.target.value;
        setText(next);
        latest.current = next;
        if (timer.current !== undefined) window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => {
          timer.current = undefined;
          void save.current(latest.current.trim());
        }, 500);
      }}
    />
  );
}
