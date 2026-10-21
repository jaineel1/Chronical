import type { DayLog, Nutrition } from '@/data/types';

export interface Tile {
  label: string;
  value: string;
  unit?: string;
}

export interface RoutineCount {
  done: number;
  scheduled: number;
  /** The night was closed, so a scheduled routine without a done log was skipped. */
  closed: boolean;
}

function n1(n: number): string {
  return String(Math.round(n * 10) / 10);
}

/** The numbers of one day, from the fields the log really has. A field the day never had gets no tile. */
export function dayTiles(log: DayLog, routines: RoutineCount, meals: Nutrition): Tile[] {
  const tiles: Tile[] = [];
  if (routines.scheduled > 0 || routines.done > 0) {
    const skipped = routines.closed ? Math.max(0, routines.scheduled - routines.done) : 0;
    tiles.push({
      label: 'Routines',
      value: String(routines.done),
      unit: `of ${Math.max(routines.scheduled, routines.done)} done${skipped > 0 ? `, ${skipped} skipped` : ''}`,
    });
  }
  if (log.weightKg !== undefined) tiles.push({ label: 'Weight', value: n1(log.weightKg), unit: 'kg' });
  if (log.sleepHours !== undefined) tiles.push({ label: 'Sleep', value: n1(log.sleepHours), unit: 'hours' });
  if (log.mood !== undefined) tiles.push({ label: 'Mood', value: String(log.mood), unit: 'of 5' });
  if (log.energy !== undefined) tiles.push({ label: 'Energy', value: String(log.energy), unit: 'of 5' });
  if (log.stress !== undefined) tiles.push({ label: 'Stress', value: String(log.stress), unit: 'of 5' });
  if (log.screenMin !== undefined) {
    tiles.push(log.screenMin >= 60 ? { label: 'Screen', value: n1(log.screenMin / 60), unit: 'hours' } : { label: 'Screen', value: String(Math.round(log.screenMin)), unit: 'min' });
  }
  if (log.waterL !== undefined) tiles.push({ label: 'Water', value: n1(log.waterL), unit: 'litres' });
  if (log.steps !== undefined) tiles.push({ label: 'Steps', value: log.steps.toLocaleString('en-IN') });
  if (log.workoutMin !== undefined) tiles.push({ label: 'Workout', value: String(Math.round(log.workoutMin)), unit: log.workoutType ? `min, ${log.workoutType}` : 'min' });
  if (log.deepWorkHours !== undefined) tiles.push({ label: 'Deep work', value: n1(log.deepWorkHours), unit: 'hours' });
  if (meals.kcal !== undefined) tiles.push({ label: 'Calories', value: Math.round(meals.kcal).toLocaleString('en-IN'), unit: 'kcal' });
  if (meals.proteinG !== undefined) tiles.push({ label: 'Protein', value: String(Math.round(meals.proteinG)), unit: 'g' });
  return tiles;
}
