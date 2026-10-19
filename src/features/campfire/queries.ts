/** Read-only live queries for the Campfire (and a few the Morning reuses). */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Book, Digest, Food, Meal, RoutineLog } from '@/data/types';
import { buildNightlyPrompt } from '@/lib/prompt/nightly';
import { gatherKnownNouns, gatherNightlyInput } from './gather';

export interface MealView {
  meal: Meal;
  name: string;
}

export function useMeals(date: string): MealView[] | undefined {
  return useLiveQuery(async () => {
    const meals = await db.meals.where('date').equals(date).sortBy('createdAt');
    const foods = await db.foods.bulkGet(meals.map((m) => m.foodId));
    return meals.map((meal, i) => ({ meal, name: foods[i]?.name ?? 'Something' }));
  }, [date]);
}

export function useFoods(): Food[] | undefined {
  return useLiveQuery(() => db.foods.orderBy('name').toArray(), []);
}

export function useReadingBooks(): Book[] | undefined {
  return useLiveQuery(async () => (await db.books.where('status').equals('reading').toArray()).sort((a, b) => a.title.localeCompare(b.title)), []);
}

/** Every log of every routine: streaks are derived from these. */
export function useRoutineLogs(): RoutineLog[] | undefined {
  return useLiveQuery(() => db.routineLogs.toArray(), []);
}

/** The nightly prompt for `date`, rebuilt whenever anything it reads changes. */
export function useNightlyPrompt(date: string): string | undefined {
  return useLiveQuery(async () => buildNightlyPrompt(await gatherNightlyInput(date)), [date]);
}

export function useKnownNouns(): string[] | undefined {
  return useLiveQuery(() => gatherKnownNouns(), []);
}

export function useLatestDigest(kind: Digest['kind']): Digest | null | undefined {
  return useLiveQuery(async () => {
    const rows = await db.digests.where('kind').equals(kind).toArray();
    return rows.sort((a, b) => b.periodEnd.localeCompare(a.periodEnd))[0] ?? null;
  }, [kind]);
}
