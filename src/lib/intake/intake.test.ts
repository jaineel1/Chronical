import { describe, expect, it } from 'vitest';
import { formatMinutes, intakeReport, mealTimeline } from './intake';

const base = { nutrition: {}, mealsLogged: 0, mealsCounted: 0 };

describe('intakeReport', () => {
  it('writes a protein shortfall with the number and a concrete swap', () => {
    const r = intakeReport({ proteinG: 120 }, { ...base, nutrition: { proteinG: 92 }, mealsLogged: 2, mealsCounted: 2 });
    const row = r.rows.find((x) => x.key === 'protein');
    expect(row).toMatchObject({ value: 92, target: 120, tone: 'low' });
    expect(row?.ratio).toBeCloseTo(92 / 120);
    expect(r.better).toEqual(['Protein 92 g of 120: 28 g short. About 5 eggs (6 g each) covers it.']);
    expect(r.good).toEqual([]);
  });

  it('calls calories on target within 10 percent, short below 90, over above 110', () => {
    const run = (kcal: number) => intakeReport({ kcal: 2000 }, { ...base, nutrition: { kcal }, mealsLogged: 1, mealsCounted: 1 });
    expect(run(2100).rows[0]?.tone).toBe('good');
    expect(run(2100).good[0]).toBe('Calories 2,100 of 2,000: on target.');
    expect(run(1500).rows[0]?.tone).toBe('low');
    expect(run(1500).better[0]).toContain('500 kcal short');
    expect(run(2400).rows[0]?.tone).toBe('over');
    expect(run(2400).better[0]).toContain('400 kcal over');
  });

  it('treats screen time as a limit', () => {
    const under = intakeReport({ screenMin: 180 }, { ...base, screenMin: 120, mealsLogged: 1, mealsCounted: 1 });
    expect(under.rows[0]).toMatchObject({ key: 'screen', tone: 'good' });
    expect(under.good[0]).toBe('Screen 2 h of 3 h: inside the limit.');
    const over = intakeReport({ screenMin: 180 }, { ...base, screenMin: 250, mealsLogged: 1, mealsCounted: 1 });
    expect(over.rows[0]?.tone).toBe('over');
    expect(over.better[0]).toBe("Screen 4 h 10 min of 3 h: 1 h 10 min over. Cut that from tomorrow's evening session.");
  });

  it('turns water, steps and sleep gaps into amounts', () => {
    const r = intakeReport(
      { waterL: 3, steps: 8000, sleepHours: 8 },
      { ...base, waterL: 2, steps: 6000, sleepHours: 6.5, mealsLogged: 1, mealsCounted: 1 },
    );
    expect(r.better).toEqual([
      'Water 2 L of 3: 1 L short. 4 more glasses (250 ml) would have closed it.',
      'Steps 6,000 of 8,000: 2,000 short. About 20 min of walking covers it.',
      'Sleep 6.5 h of 8: 90 min short. Lights out 90 min earlier tonight.',
    ]);
  });

  it('shows carbs and fat as plain figures without a target', () => {
    const r = intakeReport(undefined, { ...base, nutrition: { carbsG: 200, fatG: 60 }, mealsLogged: 1, mealsCounted: 1 });
    expect(r.rows.map((x) => [x.key, x.value, x.target, x.tone])).toEqual([
      ['carbs', 200, undefined, 'none'],
      ['fat', 60, undefined, 'none'],
    ]);
    expect(r.good).toEqual([]);
    expect(r.better).toEqual([]);
  });

  it('keeps a row for a target with no figure yet, and says so when meals are missing', () => {
    const r = intakeReport({ kcal: 2000 }, { ...base, mealsLogged: 3, mealsCounted: 1 });
    expect(r.rows[0]).toMatchObject({ key: 'kcal', value: undefined, ratio: 0, tone: 'none' });
    expect(r.better).toEqual(['2 of 3 meals have no numbers, so the totals run low.']);
  });

  it('invites the first meal when none is logged', () => {
    expect(intakeReport(undefined, base).better).toEqual(['No meals logged yet. Add one and the calories and protein fill in.']);
  });

  it('lets ratio pass 1', () => {
    const r = intakeReport({ waterL: 2 }, { ...base, waterL: 3, mealsLogged: 1, mealsCounted: 1 });
    expect(r.rows[0]?.ratio).toBe(1.5);
    expect(r.good[0]).toBe('Water 3 L of 2: hydrated.');
  });
});

describe('mealTimeline', () => {
  it('splits calories by slot in day order', () => {
    const t = mealTimeline([
      { slot: 'lunch', nutrition: { kcal: 600 } },
      { slot: 'breakfast', nutrition: { kcal: 300 } },
      { slot: 'snack', nutrition: { kcal: 100 } },
      { slot: 'snack' },
    ]);
    expect(t.map((s) => s.slot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack']);
    expect(t.map((s) => s.kcal)).toEqual([300, 600, 0, 100]);
    expect(t.map((s) => Math.round(s.share * 100))).toEqual([30, 60, 0, 10]);
    expect(t[3]?.meals).toBe(2);
  });

  it('has zero shares when nothing has calories', () => {
    expect(mealTimeline([{ slot: 'lunch' }]).every((s) => s.share === 0)).toBe(true);
  });
});

describe('formatMinutes', () => {
  it('reads as minutes or hours', () => {
    expect([45, 60, 130].map(formatMinutes)).toEqual(['45 min', '1 h', '2 h 10 min']);
  });
});
