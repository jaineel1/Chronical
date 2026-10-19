import type { PromptKind } from '@/data/types';
import { formatShortDate, toDayKey } from '@/lib/dates';

export const KIND_LABEL: Record<PromptKind, string> = {
  nightly: 'Nightly',
  weekly: 'Weekly',
  origin: 'Origin',
  skill_rank: 'Skill rank',
  lore: 'Lore',
  deep: 'Deep',
  monthly: 'Monthly',
};

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** "18 Oct, 22:14" in local time. */
export function formatStamp(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${formatShortDate(toDayKey(d))}, ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Local day key of an ISO timestamp. */
export function dayOf(iso: string): string {
  return toDayKey(new Date(iso));
}

export function plural(n: number, one: string, many = `${one}s`): string {
  return `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`;
  return `${(n / 1024 / 1024 / 1024).toFixed(1)} GB`;
}
