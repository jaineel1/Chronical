/**
 * Meal numbers: adding a day up, scaling a saved meal to a different portion, formatting, and
 * matching Claude's ## MEALS estimates to the meals the player logged. Pure.
 */
import type { MealSlot, Nutrition } from '@/data/types';

export const MACROS = ['grams', 'kcal', 'proteinG', 'carbsG', 'fatG'] as const;

/** True when the portion has a calorie figure, the one number a day total needs. */
export function hasKcal(n: Nutrition | undefined): n is Nutrition & { kcal: number } {
  return typeof n?.kcal === 'number';
}

/** Sum of every known value. `counted` is how many portions had calories. */
export function sumNutrition(list: (Nutrition | undefined)[]): { total: Nutrition; counted: number } {
  const total: Nutrition = {};
  let counted = 0;
  for (const n of list) {
    if (!n) continue;
    if (hasKcal(n)) counted++;
    for (const k of MACROS) {
      const v = n[k];
      if (typeof v === 'number') total[k] = (total[k] ?? 0) + v;
    }
  }
  return { total, counted };
}

/** The saved portion scaled to `grams`. Without grams on either side the saved portion is used as is. */
export function scaleNutrition(saved: Nutrition, grams: number | undefined): Nutrition {
  if (grams === undefined || !saved.grams) return { ...saved };
  const f = grams / saved.grams;
  const out: Nutrition = { grams };
  for (const k of ['kcal', 'proteinG', 'carbsG', 'fatG'] as const) {
    const v = saved[k];
    if (typeof v === 'number') out[k] = Math.round(v * f * 10) / 10;
  }
  return out;
}

function int(n: number): string {
  return Math.round(n).toLocaleString('en-IN');
}

/** "250 g · 380 kcal · P 12 · C 60 · F 8", only the parts that are known. */
export function formatNutrition(n: Nutrition | undefined, opts: { grams?: boolean } = {}): string {
  if (!n) return '';
  const parts: string[] = [];
  if (opts.grams !== false && typeof n.grams === 'number') parts.push(`${int(n.grams)} g`);
  if (typeof n.kcal === 'number') parts.push(`${int(n.kcal)} kcal`);
  if (typeof n.proteinG === 'number') parts.push(`P ${int(n.proteinG)}`);
  if (typeof n.carbsG === 'number') parts.push(`C ${int(n.carbsG)}`);
  if (typeof n.fatG === 'number') parts.push(`F ${int(n.fatG)}`);
  return parts.join(' · ');
}

export interface MealEstimate extends Nutrition {
  slot?: MealSlot;
  name: string;
}

export interface LoggedMeal {
  id: string;
  slot: MealSlot;
  name: string;
}

function norm(s: string): string {
  return s.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

/**
 * Pairs each estimate with one logged meal: same name and slot first, then same name, then a name
 * that contains the other. Each meal is used once; estimates that match nothing are returned apart.
 */
export function matchEstimates(meals: LoggedMeal[], estimates: MealEstimate[]): { pairs: { mealId: string; estimate: MealEstimate }[]; unmatched: MealEstimate[] } {
  const free = new Map(meals.map((m) => [m.id, m]));
  const pairs: { mealId: string; estimate: MealEstimate }[] = [];
  const unmatched: MealEstimate[] = [];
  const tests: ((m: LoggedMeal, e: MealEstimate) => boolean)[] = [
    (m, e) => norm(m.name) === norm(e.name) && (!e.slot || e.slot === m.slot),
    (m, e) => norm(m.name) === norm(e.name),
    (m, e) => {
      const a = norm(m.name);
      const b = norm(e.name);
      return !!a && !!b && (a.includes(b) || b.includes(a));
    },
  ];
  for (const e of estimates) {
    let hit: LoggedMeal | undefined;
    for (const test of tests) {
      hit = [...free.values()].find((m) => test(m, e));
      if (hit) break;
    }
    if (hit) {
      free.delete(hit.id);
      pairs.push({ mealId: hit.id, estimate: e });
    } else {
      unmatched.push(e);
    }
  }
  return { pairs, unmatched };
}

/** The numbers of an estimate, without its name and slot. */
export function nutritionOf(e: MealEstimate): Nutrition {
  const out: Nutrition = {};
  for (const k of MACROS) {
    const v = e[k];
    if (typeof v === 'number') out[k] = v;
  }
  return out;
}
