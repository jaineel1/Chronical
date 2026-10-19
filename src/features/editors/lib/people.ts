/**
 * The people tree's rules: how quiet a branch is, how it is drawn, and who to reach out to.
 *
 *   ≤ 7 days quiet  → ink (spoke this week)
 *   ≤ 14 days       → mid (within two weeks)
 *   > 14 days       → red, dashed branch, "fading"
 *   never contacted → faint, "never"
 */
import type { Person } from '@/data/types';
import { daysBetween, toDayKey } from '@/lib/dates';

export type PersonTone = 'ink' | 'mid' | 'red' | 'faint';

/** Accepts a day key or an ISO timestamp; returns a day key or undefined. */
export function contactDayKey(value: string | undefined): string | undefined {
  if (!value) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? undefined : toDayKey(d);
}

/** Whole days since the last contact, or null when there has never been one. Never negative. */
export function daysQuiet(person: Pick<Person, 'lastContact'>, today: string): number | null {
  const key = contactDayKey(person.lastContact);
  if (!key) return null;
  return Math.max(0, daysBetween(key, today));
}

export function personTone(days: number | null): PersonTone {
  if (days === null) return 'faint';
  if (days <= 7) return 'ink';
  if (days <= 14) return 'mid';
  return 'red';
}

export function daysLabel(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** Second line of a tree node: "1 day, family", "16 days, fading", "never, gym". */
export function personMeta(person: Pick<Person, 'lastContact' | 'circle'>, today: string): string {
  const days = daysQuiet(person, today);
  if (days === null) return `never, ${person.circle}`;
  return `${daysLabel(days)}, ${personTone(days) === 'red' ? 'fading' : person.circle}`;
}

/** Tree order: most recent contact first, never-contacted last; ties keep the input order. */
export function sortForTree<P extends Pick<Person, 'lastContact'>>(people: readonly P[], today: string): P[] {
  return people
    .map((p, i) => ({ p, i, d: daysQuiet(p, today) }))
    .sort((a, b) => (a.d ?? Number.POSITIVE_INFINITY) - (b.d ?? Number.POSITIVE_INFINITY) || a.i - b.i)
    .map((x) => x.p);
}

/**
 * How overdue someone is: days quiet minus how often the player wants contact. Someone never
 * contacted counts from the day they were added.
 */
export function overdueBy(person: Pick<Person, 'lastContact' | 'contactEveryDays' | 'createdAt'>, today: string): number {
  const quiet = daysQuiet(person, today) ?? Math.max(0, daysBetween(contactDayKey(person.createdAt) ?? today, today));
  return quiet - Math.max(1, person.contactEveryDays || 1);
}

/** The person to reach out to today: most overdue; ties go to the ones the player wants closer. */
export function mostOverdue<P extends Pick<Person, 'lastContact' | 'contactEveryDays' | 'createdAt' | 'wantCloser' | 'closeness'>>(
  people: readonly P[],
  today: string,
): P | undefined {
  let best: { p: P; score: number } | undefined;
  for (const p of people) {
    const score = overdueBy(p, today);
    if (
      !best ||
      score > best.score ||
      (score === best.score && p.wantCloser && !best.p.wantCloser) ||
      (score === best.score && p.wantCloser === best.p.wantCloser && p.closeness > best.p.closeness)
    ) {
      best = { p, score };
    }
  }
  return best?.p;
}

export function treeSummary(people: readonly Pick<Person, 'lastContact'>[], today: string): { branches: number; fading: number } {
  return {
    branches: people.length,
    fading: people.filter((p) => personTone(daysQuiet(p, today)) === 'red').length,
  };
}

/** "8 branches, 2 fading" */
export function treeMeta(people: readonly Pick<Person, 'lastContact'>[], today: string): string {
  const { branches, fading } = treeSummary(people, today);
  return `${branches} ${branches === 1 ? 'branch' : 'branches'}, ${fading} fading`;
}

/** Header note for the reach-out section: "21 days quiet", "due in 3 days", "never contacted". */
export function quietNote(person: Pick<Person, 'lastContact' | 'contactEveryDays' | 'createdAt'>, today: string): string {
  const days = daysQuiet(person, today);
  if (days === null) return 'never contacted';
  const over = overdueBy(person, today);
  if (over < 0) return `due in ${daysLabel(-over)}`;
  return `${daysLabel(days)} quiet`;
}
