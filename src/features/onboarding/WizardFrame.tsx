import type { ReactNode } from 'react';

/**
 * The wizard sits outside the Shell, so it draws its own ink top bar. Content is a 640 px column
 * on desktop and full width with 24 px gutters on phones; the footer (Back · Skip · Continue)
 * sticks to the bottom above the safe area.
 */
export function WizardFrame({
  title = 'Origin Sheet',
  meta,
  top,
  footer,
  children,
}: {
  title?: string;
  meta?: string;
  /** Rendered first inside the column, e.g. the progress line. */
  top?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-baseline justify-between gap-4 bg-ink px-6 py-3.5 text-paper lg:px-10">
        <span className="truncate">{title}</span>
        {meta ? <span className="shrink-0 text-bar-text">{meta}</span> : null}
      </header>
      <main className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-2 px-6 pt-4 pb-10 md:px-0 lg:pt-8">
        {top}
        {children}
      </main>
      {footer ? (
        <div className="sticky bottom-0 z-10 border-t border-faint bg-paper">
          <div className="mx-auto flex w-full max-w-[640px] items-center gap-5 px-6 pt-3 pb-[calc(env(safe-area-inset-bottom)+12px)] md:px-0">{footer}</div>
        </div>
      ) : null}
    </div>
  );
}

/** Quiet empty paper while the profile loads: no spinner. */
export function QuietPaper() {
  return <div className="min-h-dvh bg-paper" aria-busy="true" />;
}
