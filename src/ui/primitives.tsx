import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, TextareaHTMLAttributes } from 'react';

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

/** Shaded section header: title left, muted note right. */
export function SectionHeader({ title, note, action }: { title: ReactNode; note?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 bg-paper-2 px-2.5 py-[3px]">
      <span>{title}</span>
      <span className="flex items-baseline gap-3">
        {note ? <span className="text-mid">{note}</span> : null}
        {action}
      </span>
    </div>
  );
}

/** Content block under a SectionHeader, indented to match. */
export function Section({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-2 px-2.5 ${className}`}>{children}</div>;
}

export function Hairline() {
  return <div aria-hidden="true" className="hairline" />;
}

/* ------------------------------------------------------------------ */
/* Bars                                                                */
/* ------------------------------------------------------------------ */

export function Bar({
  value,
  max = 10,
  thin = false,
  label,
}: {
  value: number;
  max?: number;
  thin?: boolean;
  label?: string;
}) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const h = thin ? 'h-[2px]' : 'h-1';
  return (
    <div
      role={label ? 'meter' : undefined}
      aria-label={label}
      aria-valuenow={label ? Math.round(value * 10) / 10 : undefined}
      aria-valuemin={label ? 0 : undefined}
      aria-valuemax={label ? max : undefined}
      className={`${h} flex-1 bg-faint`}
    >
      <div className={`${h} bg-mid`} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** One row: name | bar | value | optional delta. Used for pillars, sub-stats and skills. */
export function StatRow({
  name,
  value,
  max = 10,
  delta,
  trailing,
  sub = false,
  nameWidth = 84,
  format = (v: number) => v.toFixed(1),
}: {
  name: string;
  value: number;
  max?: number;
  delta?: number;
  trailing?: ReactNode;
  sub?: boolean;
  nameWidth?: number;
  format?: (v: number) => string;
}) {
  return (
    <div className={`flex items-center gap-3 ${sub ? 'pl-4 text-mid' : ''}`}>
      <span style={{ width: nameWidth }} className="shrink-0 truncate">
        {name}
      </span>
      <Bar value={value} max={max} thin={sub} />
      <span className="w-[30px] shrink-0 text-right">{format(value)}</span>
      {delta !== undefined ? (
        <span className={`w-7 shrink-0 text-right ${delta < 0 ? 'text-red' : 'text-mid'}`}>
          {delta > 0 ? `+${delta}` : delta}
        </span>
      ) : null}
      {trailing}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Controls                                                            */
/* ------------------------------------------------------------------ */

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'outline' | 'text'; size?: 'md' | 'lg' };

export function Button({ variant = 'primary', size = 'md', className = '', ...rest }: ButtonProps) {
  const base = 'inline-flex items-center justify-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-default disabled:opacity-50';
  // Text buttons carry no box: no height, no horizontal padding, so they align with the text around them.
  const sizes = variant === 'text' ? (size === 'lg' ? 'text-[18px]' : '') : size === 'lg' ? 'h-12 px-4 text-[18px]' : 'h-9 px-3';
  const variants = {
    primary: 'bg-walnut text-paper border-0',
    outline: 'bg-transparent text-walnut border border-walnut',
    text: 'bg-transparent text-walnut border-0 p-0 h-auto',
  }[variant];
  return <button className={`${base} ${sizes} ${variants} ${className}`} {...rest} />;
}

export function Check(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input type="checkbox" className="m-0 h-3.5 w-3.5 shrink-0 accent-ink" {...props} />;
}

export function Chip({ children, active = false, onClick }: { children: ReactNode; active?: boolean; onClick?: () => void }) {
  const cls = active ? 'border-ink bg-paper-2' : 'border-faint';
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={`border px-2 py-[3px] ${cls} cursor-pointer`}>
        {children}
      </button>
    );
  }
  return <span className={`border px-2 py-[3px] ${cls}`}>{children}</span>;
}

export function Field({ label, hint, children }: { label: ReactNode; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-mid">{label}</span>
      {children}
      {hint ? <span className="text-mid">{hint}</span> : null}
    </label>
  );
}

export function TextInput({ className = '', ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={`w-full border-0 border-b border-faint bg-transparent px-0 py-1 outline-none focus:border-ink ${className}`}
      {...rest}
    />
  );
}

export function TextArea({ className = '', ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={`w-full resize-y border border-faint bg-transparent p-2 font-serif text-[16px] leading-[1.5] outline-none focus:border-ink ${className}`}
      {...rest}
    />
  );
}

/** Big number tile used on Campfire: label, value, unit. */
export function NumberTile({ label, value, unit, tone = 'mid' }: { label: string; value: ReactNode; unit?: ReactNode; tone?: 'mid' | 'red' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-mid">{label}</span>
      <span className="text-[32px] leading-none">{value}</span>
      {unit ? <span className={tone === 'red' ? 'text-red' : 'text-mid'}>{unit}</span> : null}
    </div>
  );
}

/** Empty state that invites the next action instead of describing absence. */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-3 border border-dashed border-faint p-4 text-mid">
      <span>{children}</span>
      {action}
    </div>
  );
}
