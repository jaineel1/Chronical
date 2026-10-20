/**
 * The day's intake against the player's targets: one row per measure, and plain-language
 * "went well" / "could be better" lines with the numbers in them. Pure.
 */
import type { MealSlot, Nutrition, Settings } from '@/data/types';

export type Targets = NonNullable<Settings['targets']>;
export type IntakeTone = 'good' | 'low' | 'over' | 'none';
export type IntakeKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'water' | 'steps' | 'sleep' | 'screen';

export interface IntakeInput {
  /** Summed nutrition of the day's meals (`sumNutrition(...).total`). */
  nutrition: Nutrition;
  waterL?: number;
  steps?: number;
  sleepHours?: number;
  screenMin?: number;
  mealsLogged: number;
  /** Meals that have a calorie figure. */
  mealsCounted: number;
}

export interface IntakeRow {
  key: IntakeKey;
  label: string;
  /** Undefined when the day has no figure for it yet. */
  value: number | undefined;
  target?: number;
  unit: string;
  /** value / target, 0 when either is missing. Can pass 1. */
  ratio: number;
  tone: IntakeTone;
}

export interface IntakeReport {
  rows: IntakeRow[];
  good: string[];
  better: string[];
}

/** Within this much of the target counts as on target. */
const NEAR = 0.9;
const KCAL_OVER = 1.1;
/** Grams of protein in one egg, the one concrete swap the app suggests. */
const EGG_PROTEIN_G = 6;
const GLASS_L = 0.25;
const STEPS_PER_MIN = 100;

function num(n: number, digits = 0): string {
  const f = 10 ** digits;
  return (Math.round(n * f) / f).toLocaleString('en-IN', { maximumFractionDigits: digits });
}

export function formatMinutes(min: number): string {
  const m = Math.round(min);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  const rest = m % 60;
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`;
}

function toneFor(key: IntakeKey, value: number | undefined, target: number | undefined): IntakeTone {
  if (value === undefined || !target) return 'none';
  const r = value / target;
  if (key === 'screen') return r <= 1 ? 'good' : 'over';
  if (key === 'kcal') return r < NEAR ? 'low' : r > KCAL_OVER ? 'over' : 'good';
  return r < NEAR ? 'low' : 'good';
}

const ROW_SPEC: { key: IntakeKey; label: string; unit: string }[] = [
  { key: 'kcal', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fat', label: 'Fat', unit: 'g' },
  { key: 'water', label: 'Water', unit: 'L' },
  { key: 'steps', label: 'Steps', unit: '' },
  { key: 'sleep', label: 'Sleep', unit: 'h' },
  { key: 'screen', label: 'Screen', unit: 'min' },
];

function targetOf(key: IntakeKey, t: Targets): number | undefined {
  switch (key) {
    case 'kcal':
      return t.kcal;
    case 'protein':
      return t.proteinG;
    case 'water':
      return t.waterL;
    case 'steps':
      return t.steps;
    case 'sleep':
      return t.sleepHours;
    case 'screen':
      return t.screenMin;
    default:
      return undefined;
  }
}

function valueOf(key: IntakeKey, i: IntakeInput): number | undefined {
  switch (key) {
    case 'kcal':
      return i.nutrition.kcal;
    case 'protein':
      return i.nutrition.proteinG;
    case 'carbs':
      return i.nutrition.carbsG;
    case 'fat':
      return i.nutrition.fatG;
    case 'water':
      return i.waterL;
    case 'steps':
      return i.steps;
    case 'sleep':
      return i.sleepHours;
    case 'screen':
      return i.screenMin;
  }
}

/** The message for a measure with a target and a figure, or null when it needs none. */
function line(row: IntakeRow): { good?: string; better?: string } {
  const { key, value, target } = row;
  if (value === undefined || !target) return {};
  const diff = Math.abs(value - target);
  switch (key) {
    case 'kcal': {
      const head = `Calories ${num(value)} of ${num(target)}`;
      if (row.tone === 'good') return { good: `${head}: on target.` };
      if (row.tone === 'low') return { better: `${head}: ${num(diff)} kcal short.` };
      return { better: `${head}: ${num(diff)} kcal over.` };
    }
    case 'protein': {
      const head = `Protein ${num(value)} g of ${num(target)}`;
      if (row.tone === 'good') return { good: `${head}: covered.` };
      const eggs = Math.max(1, Math.round(diff / EGG_PROTEIN_G));
      return { better: `${head}: ${num(diff)} g short. About ${eggs} ${eggs === 1 ? 'egg' : 'eggs'} (${EGG_PROTEIN_G} g each) covers it.` };
    }
    case 'water': {
      const head = `Water ${num(value, 1)} L of ${num(target, 1)}`;
      if (row.tone === 'good') return { good: `${head}: hydrated.` };
      const glasses = Math.max(1, Math.ceil(diff / GLASS_L));
      return { better: `${head}: ${num(diff, 1)} L short. ${glasses} more ${glasses === 1 ? 'glass' : 'glasses'} (250 ml) would have closed it.` };
    }
    case 'steps': {
      const head = `Steps ${num(value)} of ${num(target)}`;
      if (row.tone === 'good') return { good: `${head}: on your feet enough.` };
      return { better: `${head}: ${num(diff)} short. About ${Math.ceil(diff / STEPS_PER_MIN)} min of walking covers it.` };
    }
    case 'sleep': {
      const head = `Sleep ${num(value, 1)} h of ${num(target, 1)}`;
      if (row.tone === 'good') return { good: `${head}: rested.` };
      return { better: `${head}: ${num(diff * 60)} min short. Lights out ${num(diff * 60)} min earlier tonight.` };
    }
    case 'screen': {
      const head = `Screen ${formatMinutes(value)} of ${formatMinutes(target)}`;
      if (row.tone === 'good') return { good: `${head}: inside the limit.` };
      return { better: `${head}: ${formatMinutes(diff)} over. Cut that from tomorrow's evening session.` };
    }
    default:
      return {};
  }
}

/**
 * Rows for every measure that has a target or a figure today (carbs and fat only ever have a
 * figure), plus the went-well and could-be-better lists. With no targets the lists only say
 * what is missing from the log.
 */
export function intakeReport(targets: Targets | undefined, input: IntakeInput): IntakeReport {
  const t = targets ?? {};
  const rows: IntakeRow[] = [];
  for (const spec of ROW_SPEC) {
    const value = valueOf(spec.key, input);
    const target = targetOf(spec.key, t);
    if (value === undefined && target === undefined) continue;
    const ratio = value !== undefined && target ? value / target : 0;
    rows.push({ ...spec, value, target, ratio, tone: toneFor(spec.key, value, target) });
  }

  const good: string[] = [];
  const better: string[] = [];
  for (const row of rows) {
    const l = line(row);
    if (l.good) good.push(l.good);
    if (l.better) better.push(l.better);
  }

  if (input.mealsLogged === 0) {
    better.push('No meals logged yet. Add one and the calories and protein fill in.');
  } else if (input.mealsCounted < input.mealsLogged) {
    const missing = input.mealsLogged - input.mealsCounted;
    better.push(`${missing} of ${input.mealsLogged} ${input.mealsLogged === 1 ? 'meal has' : 'meals have'} no numbers, so the totals run low.`);
  }
  return { rows, good, better };
}

/* ------------------------------- meal timeline ------------------------------- */

export const SLOT_ORDER: MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export interface TimelineSlot {
  slot: MealSlot;
  kcal: number;
  /** 0..1 share of the day's calories. */
  share: number;
  meals: number;
}

/** Calories per meal slot in day order, for a stacked bar. Meals without calories count as zero. */
export function mealTimeline(meals: { slot: MealSlot; nutrition?: Nutrition }[]): TimelineSlot[] {
  const slots = SLOT_ORDER.map((slot) => ({ slot, kcal: 0, share: 0, meals: 0 }));
  for (const m of meals) {
    const s = slots.find((x) => x.slot === m.slot);
    if (!s) continue;
    s.meals++;
    if (typeof m.nutrition?.kcal === 'number') s.kcal += m.nutrition.kcal;
  }
  const total = slots.reduce((a, s) => a + s.kcal, 0);
  if (total > 0) for (const s of slots) s.share = s.kcal / total;
  return slots;
}
