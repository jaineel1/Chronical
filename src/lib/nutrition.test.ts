import { describe, expect, it } from 'vitest';
import { formatNutrition, matchEstimates, nutritionOf, scaleNutrition, sumNutrition } from './nutrition';

describe('sumNutrition', () => {
  it('adds what is known and counts portions with calories', () => {
    const { total, counted } = sumNutrition([{ kcal: 380, proteinG: 12 }, undefined, { grams: 100 }, { kcal: 500, proteinG: 30, fatG: 20 }]);
    expect(total).toEqual({ kcal: 880, proteinG: 42, fatG: 20, grams: 100 });
    expect(counted).toBe(2);
  });
});

describe('scaleNutrition', () => {
  it('scales a saved portion to the grams eaten', () => {
    expect(scaleNutrition({ grams: 200, kcal: 300, proteinG: 10 }, 300)).toEqual({ grams: 300, kcal: 450, proteinG: 15 });
  });

  it('uses the saved portion when grams are unknown on either side', () => {
    expect(scaleNutrition({ kcal: 300 }, 150)).toEqual({ kcal: 300 });
    expect(scaleNutrition({ grams: 200, kcal: 300 }, undefined)).toEqual({ grams: 200, kcal: 300 });
  });
});

describe('formatNutrition', () => {
  it('shows only the known parts', () => {
    expect(formatNutrition({ grams: 250, kcal: 1380.4, proteinG: 12 })).toBe('250 g · 1,380 kcal · P 12');
    expect(formatNutrition({ grams: 250, kcal: 380 }, { grams: false })).toBe('380 kcal');
    expect(formatNutrition(undefined)).toBe('');
  });
});

describe('matchEstimates', () => {
  const meals = [
    { id: 'a', slot: 'breakfast' as const, name: 'Oats with banana' },
    { id: 'b', slot: 'lunch' as const, name: 'Dal rice' },
    { id: 'c', slot: 'dinner' as const, name: 'Dal rice' },
  ];

  it('pairs by name and slot, using each meal once', () => {
    const { pairs, unmatched } = matchEstimates(meals, [
      { slot: 'dinner', name: 'dal rice', kcal: 600 },
      { slot: 'lunch', name: 'Dal Rice', kcal: 550 },
      { name: 'Oats with banana', kcal: 380 },
    ]);
    expect(pairs.map((p) => [p.mealId, p.estimate.kcal])).toEqual([
      ['c', 600],
      ['b', 550],
      ['a', 380],
    ]);
    expect(unmatched).toEqual([]);
  });

  it('falls back to a name that contains the other, and reports what matched nothing', () => {
    const { pairs, unmatched } = matchEstimates(meals, [
      { slot: 'breakfast', name: 'Oats', kcal: 380 },
      { name: 'Protein shake', kcal: 200 },
    ]);
    expect(pairs).toEqual([{ mealId: 'a', estimate: { slot: 'breakfast', name: 'Oats', kcal: 380 } }]);
    expect(unmatched.map((u) => u.name)).toEqual(['Protein shake']);
  });
});

describe('nutritionOf', () => {
  it('drops the name and slot', () => {
    expect(nutritionOf({ slot: 'lunch', name: 'x', grams: 100, kcal: 200 })).toEqual({ grams: 100, kcal: 200 });
  });
});
