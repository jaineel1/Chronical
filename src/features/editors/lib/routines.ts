/** Routine form helpers: weekday masks and the optional time window. */

/** Display order, Monday first. Values are Date#getDay() numbers (0 = Sunday). */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0] as const;
export const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
export const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;

/** Stored form: unique, 0-6, ascending. An empty list means daily. */
export function cleanDays(days: readonly number[]): number[] {
  const set = new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6));
  return set.size === 7 ? [] : [...set].sort((a, b) => a - b);
}

export function toggleDay(days: readonly number[], day: number): number[] {
  return cleanDays(days.includes(day) ? days.filter((d) => d !== day) : [...days, day]);
}

/** [] → "daily"; Mon-Sat → "Mon to Sat"; otherwise "Mon, Wed, Fri, Sun". */
export function daysText(days: readonly number[]): string {
  const clean = cleanDays(days);
  if (clean.length === 0) return 'daily';
  const ordered = WEEK_ORDER.filter((d) => clean.includes(d));
  const idx = ordered.map((d) => WEEK_ORDER.indexOf(d));
  const consecutive = idx.every((v, i) => i === 0 || v === idx[i - 1]! + 1);
  if (consecutive && ordered.length >= 3) return `${DAY_SHORT[ordered[0]!]} to ${DAY_SHORT[ordered[ordered.length - 1]!]}`;
  return ordered.map((d) => DAY_SHORT[d]).join(', ');
}

/** "6:00 - 7:30" → "06:00-07:30"; "" → ""; anything unreadable → null. */
export function normalizeWindow(text: string): string | null {
  const t = text.trim();
  if (!t) return '';
  const m = /^(\d{1,2})[:.](\d{2})\s*(?:-|–|—|to)\s*(\d{1,2})[:.](\d{2})$/i.exec(t);
  if (!m) return null;
  const [h1, m1, h2, m2] = [m[1], m[2], m[3], m[4]].map(Number) as [number, number, number, number];
  if (h1 > 23 || h2 > 24 || m1 > 59 || m2 > 59) return null;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(h1)}:${pad(m1)}-${pad(h2)}:${pad(m2)}`;
}

export function shieldsText(shields: number): string {
  if (shields <= 0) return 'no shield left';
  return shields === 1 ? '1 shield' : `${shields} shields`;
}
