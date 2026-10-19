/**
 * Small building blocks shared by the World screens and the editors. They compose the foundation
 * primitives (Button, Chip, TextInput) and keep the Paper look: no cards, hairlines, walnut actions.
 */
import { useCallback, useId, useState, type ReactNode, type SelectHTMLAttributes } from 'react';
import { Link, useNavigate, type LinkProps } from 'react-router';
import { Button, Chip } from '@/ui/primitives';

/** A Link that looks like the text button: walnut, no underline. */
export function TextLink({ className = '', ...rest }: LinkProps) {
  return <Link className={`inline-flex items-center gap-2 self-start text-walnut no-underline ${className}`} {...rest} />;
}

/** Go back inside the app when there is history to go back to, otherwise to `fallback`. */
export function useGoBack(fallback: string): () => void {
  const navigate = useNavigate();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof idx === 'number' && idx > 0) navigate(-1);
    else navigate(fallback, { replace: true });
  }, [navigate, fallback]);
}

/** Label + chips. A <div>, not a <label>: a label would forward clicks on its text to the first chip. */
export function ChoiceGroup({ label, hint, error, children }: { label: ReactNode; hint?: ReactNode; error?: string; children: ReactNode }) {
  const id = useId();
  return (
    <div role="group" aria-labelledby={id} className="flex flex-col gap-1">
      <span id={id} className="text-mid">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
      {hint ? <span className="text-mid">{hint}</span> : null}
      {error ? <ErrorText>{error}</ErrorText> : null}
    </div>
  );
}

/** Pick one value from a list of chips. */
export function ChipChoice<T extends string | number>({
  options,
  value,
  onChange,
  render = (o) => String(o),
}: {
  options: readonly T[];
  value: T | undefined;
  onChange: (v: T) => void;
  render?: (o: T) => ReactNode;
}) {
  return (
    <>
      {options.map((o) => (
        <Chip key={String(o)} active={o === value} onClick={() => onChange(o)}>
          {render(o)}
        </Chip>
      ))}
    </>
  );
}

export function ErrorText({ children }: { children: ReactNode }) {
  return <span className="text-red">{children}</span>;
}

/** Native select styled like TextInput. */
export function Select({ className = '', children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={`w-full cursor-pointer border-0 border-b border-faint bg-transparent px-0 py-1 outline-none focus:border-ink ${className}`} {...rest}>
      {children}
    </select>
  );
}

/**
 * The bottom of an editor form: Back on the left, the walnut Save on the right. It sticks just
 * above the phone's bottom nav while the form is on screen, and settles at the form's end.
 */
export function SaveBar({ onBack, saving = false, label = 'Save', note }: { onBack: () => void; saving?: boolean; label?: string; note?: ReactNode }) {
  return (
    <div className="sticky bottom-[calc(env(safe-area-inset-bottom)+65px)] z-10 -mx-6 flex flex-col gap-2 border-t border-faint bg-paper px-6 py-3 lg:bottom-0 lg:-mx-10 lg:px-10">
      {note ? <div>{note}</div> : null}
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="text" onClick={onBack}>
          Back
        </Button>
        <Button type="submit" disabled={saving} className="min-w-[120px]" data-testid="save">
          {saving ? 'Saving' : label}
        </Button>
      </div>
    </div>
  );
}

/** A red text action that asks once before it acts. */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  onConfirm,
  quiet = false,
  className = '',
  askingClassName = '',
}: {
  label: string;
  question: ReactNode;
  confirmLabel: string;
  onConfirm: () => void | Promise<void>;
  /** Mid-coloured trigger for per-row actions in a list; the confirm step is red either way. */
  quiet?: boolean;
  className?: string;
  /** Extra classes while asking, e.g. `basis-full` to take its own line in a wrapping row. */
  askingClassName?: string;
}) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!asking) {
    return (
      <button
        type="button"
        className={`cursor-pointer self-start border-0 bg-transparent p-0 ${quiet ? 'text-mid' : 'text-red'} ${className}`}
        onClick={() => setAsking(true)}
      >
        {label}
      </button>
    );
  }
  return (
    <div role="alertdialog" aria-label={label} className={`flex flex-col gap-2 border border-dashed border-red p-3 ${className} ${askingClassName}`}>
      <span className="text-red">{question}</span>
      <div className="flex items-center gap-5">
        <button
          type="button"
          disabled={busy}
          className="cursor-pointer border-0 bg-transparent p-0 text-red underline underline-offset-4 disabled:opacity-50"
          onClick={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
              setAsking(false);
            }
          }}
        >
          {confirmLabel}
        </button>
        <Button type="button" variant="text" onClick={() => setAsking(false)}>
          Keep it
        </Button>
      </div>
    </div>
  );
}

/** Parse a number input; empty or invalid → undefined. */
export function numberOrUndefined(text: string): number | undefined {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : undefined;
}

/** Downscale an image file so its longest side is at most `max` px; returns a JPEG data URL. */
export async function downscaleImage(file: File, max = 512): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('That file is not an image this browser can read.'));
      el.src = url;
    });
    const scale = Math.min(1, max / Math.max(img.naturalWidth || 1, img.naturalHeight || 1));
    const w = Math.max(1, Math.round(img.naturalWidth * scale));
    const h = Math.max(1, Math.round(img.naturalHeight * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('This browser cannot resize images.');
    ctx.fillStyle = '#ebe3d4'; // paper, under transparent PNGs
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    return canvas.toDataURL('image/jpeg', 0.85);
  } finally {
    URL.revokeObjectURL(url);
  }
}
