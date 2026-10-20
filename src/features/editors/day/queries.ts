/** Read-only live queries for the day editor and the day list. Writes go through the repositories. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Book, DayLog, Meal, Note } from '@/data/types';

export interface DayMeal {
  meal: Meal;
  name: string;
}

export interface DayBundle {
  log: DayLog | null;
  meals: DayMeal[];
  notes: Note[];
  books: Book[];
}

export function useDayBundle(date: string): DayBundle | undefined {
  return useLiveQuery(async () => {
    const [log, meals, notes, books] = await Promise.all([
      db.dayLogs.where('date').equals(date).first(),
      db.meals.where('date').equals(date).sortBy('createdAt'),
      db.notes.where('date').equals(date).sortBy('at'),
      db.books.toArray(),
    ]);
    const foods = await db.foods.bulkGet(meals.map((m) => m.foodId));
    return {
      log: log ?? null,
      meals: meals.map((meal, i) => ({ meal, name: foods[i]?.name ?? '' })),
      notes,
      books: books.sort((a, b) => a.title.localeCompare(b.title)),
    };
  }, [date]);
}

export interface DayFacts {
  date: string;
  log: DayLog | null;
  meals: number;
  notes: number;
}

/** Every day from `from` to `to` (inclusive, newest first), with what was logged on it. */
export function useDayFacts(days: string[]): DayFacts[] | undefined {
  const first = days[days.length - 1];
  const last = days[0];
  return useLiveQuery(async () => {
    if (!first || !last) return [];
    const [logs, meals, notes] = await Promise.all([
      db.dayLogs.where('date').between(first, last, true, true).toArray(),
      db.meals.where('date').between(first, last, true, true).toArray(),
      db.notes.where('date').between(first, last, true, true).toArray(),
    ]);
    const logBy = new Map(logs.map((l) => [l.date, l]));
    const count = (rows: { date: string }[]) => {
      const m = new Map<string, number>();
      for (const r of rows) m.set(r.date, (m.get(r.date) ?? 0) + 1);
      return m;
    };
    const mealBy = count(meals);
    const noteBy = count(notes);
    return days.map((date) => ({ date, log: logBy.get(date) ?? null, meals: mealBy.get(date) ?? 0, notes: noteBy.get(date) ?? 0 }));
  }, [first, last]);
}
