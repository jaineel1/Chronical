/**
 * Day keys are local calendar dates as 'YYYY-MM-DD'. A "game day" rolls over at `rolloverHour`
 * (default 4), so a 1 AM log still belongs to the evening before.
 */

export const DEFAULT_ROLLOVER_HOUR = 4;

export function toDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1, 12, 0, 0, 0);
}

/** The game day that `now` belongs to. */
export function todayKey(rolloverHour = DEFAULT_ROLLOVER_HOUR, now: Date = new Date()): string {
  const shifted = new Date(now.getTime() - rolloverHour * 60 * 60 * 1000);
  return toDayKey(shifted);
}

export function addDays(key: string, n: number): string {
  const d = fromDayKey(key);
  d.setDate(d.getDate() + n);
  return toDayKey(d);
}

export function daysBetween(a: string, b: string): number {
  const ms = fromDayKey(b).getTime() - fromDayKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

export function daysSince(iso: string | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return null;
  return Math.max(0, Math.floor((now.getTime() - then.getTime()) / 86_400_000));
}

/** 1-based day number since the profile started (day 1 = the start day). */
export function dayNumber(startedAtIso: string, rolloverHour = DEFAULT_ROLLOVER_HOUR, now: Date = new Date()): number {
  const start = todayKey(rolloverHour, new Date(startedAtIso));
  return daysBetween(start, todayKey(rolloverHour, now)) + 1;
}

/** ISO week key like '2026-W42', Monday-based. */
export function weekKey(key: string): string {
  const d = fromDayKey(key);
  const day = (d.getDay() + 6) % 7; // Mon=0
  d.setDate(d.getDate() - day + 3); // Thursday of this week
  const firstThursday = new Date(d.getFullYear(), 0, 4);
  const week = 1 + Math.round(((d.getTime() - firstThursday.getTime()) / 86_400_000 - 3 + ((firstThursday.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`;
}

export function monthKey(key: string): string {
  return key.slice(0, 7);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

/** 'Sunday, 18 October' */
export function formatLongDate(key: string): string {
  const d = fromDayKey(key);
  return `${WEEKDAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** '18 Oct' */
export function formatShortDate(key: string): string {
  const d = fromDayKey(key);
  return `${d.getDate()} ${MONTHS[d.getMonth()]?.slice(0, 3)}`;
}

/** 0 = Sunday … 6 = Saturday, for routine day masks. */
export function weekdayOf(key: string): number {
  return fromDayKey(key).getDay();
}

export function nowIso(): string {
  return new Date().toISOString();
}
