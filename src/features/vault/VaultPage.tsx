import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { ChevronIcon } from '@/ui/icons';

/** Every Vault page: sets the ink bar, wraps content in <Page>, and offers the way back. */
export function VaultPage({
  title,
  meta,
  back = { to: '/vault', label: 'Vault' },
  wide = false,
  children,
}: {
  title: string;
  meta?: string;
  back?: { to: string; label: string } | null;
  /** Use the full desktop width (for screens with a two-column layout). */
  wide?: boolean;
  children: ReactNode;
}) {
  useShellBar(title, meta);
  return (
    <Page wide={wide}>
      {back ? <BackLink to={back.to} label={back.label} /> : null}
      {children}
    </Page>
  );
}

export function BackLink({ to, label }: { to: string; label: string }) {
  return (
    <Link to={to} className="flex items-center gap-1.5 self-start py-1 no-underline">
      <ChevronIcon size={12} className="rotate-180" />
      <span>{label}</span>
    </Link>
  );
}

/** A full-width row link with a muted second line and a chevron, hairline below. */
export function RowLink({ to, title, sub, right, testId }: { to: string; title: ReactNode; sub?: ReactNode; right?: ReactNode; testId?: string }) {
  return (
    <Link to={to} className="flex items-center gap-3 border-b border-faint py-2.5 text-ink no-underline last:border-b-0" data-testid={testId}>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="flex items-baseline justify-between gap-3">
          <span className="min-w-0 truncate">{title}</span>
          {right}
        </span>
        {sub ? <span className="text-mid">{sub}</span> : null}
      </span>
      <ChevronIcon size={12} className="shrink-0 text-mid" />
    </Link>
  );
}
