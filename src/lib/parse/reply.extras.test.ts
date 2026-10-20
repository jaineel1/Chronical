import { describe, expect, it } from 'vitest';
import { DEMO_REPLY_MD } from '@/data/seed';
import { parseMealLine, parseNightlyReply } from './reply';

const BRIEF = '## BRIEF\nDay 23. You ran 8 km.\n\n';

describe('## MEALS', () => {
  it('reads slot, name, grams, calories and macros', () => {
    expect(parseMealLine('- Breakfast | Oats with banana | 250 g | 380 kcal | P 12 g | C 60 g | F 8 g')).toEqual({
      slot: 'breakfast',
      name: 'Oats with banana',
      grams: 250,
      kcal: 380,
      proteinG: 12,
      carbsG: 60,
      fatG: 8,
    });
  });

  it('takes labels in any order, words for macros, commas in numbers, and no slot', () => {
    expect(parseMealLine('- **Dal rice** | 1,050 cal | protein 30g | 400 g | fat 20 g | carbs 150 g')).toEqual({
      name: 'Dal rice',
      kcal: 1050,
      proteinG: 30,
      grams: 400,
      fatG: 20,
      carbsG: 150,
    });
  });

  it('skips totals, None and lines without numbers', () => {
    const r = parseNightlyReply(`${BRIEF}## MEALS\n- Lunch | Dal rice | 400 g | 600 kcal\n- Total | 600 kcal\n- Dinner | Salad\n- None`);
    expect(r.meals).toEqual([{ slot: 'lunch', name: 'Dal rice', grams: 400, kcal: 600 }]);
  });
});

describe('## SUMMARY', () => {
  it('keeps the recap as one paragraph', () => {
    const r = parseNightlyReply(`${BRIEF}## Summary\nFour of six routines.\n1,850 kcal across three meals.`);
    expect(r.summaryMd).toBe('Four of six routines. 1,850 kcal across three meals.');
  });
});

describe('## ROUTINE', () => {
  it('reads one routine row', () => {
    const r = parseNightlyReply(`${BRIEF}## ROUTINE\n- Evening walk | Body | Endurance | 2 | daily | 19:00-19:30 | sleep comes easier | another short night`);
    expect(r.routine).toEqual({
      name: 'Evening walk',
      pillar: 'BODY',
      subStat: 'Endurance',
      weight: 2,
      days: [],
      window: '19:00-19:30',
      upside: 'sleep comes easier',
      cost: 'another short night',
    });
  });

  it('suggests nothing for "- None"', () => {
    expect(parseNightlyReply(`${BRIEF}## ROUTINE\n- None`).routine).toBeUndefined();
  });

  it('keeps only the first row when several come', () => {
    const r = parseNightlyReply(`${BRIEF}## ROUTINES\n- A | Mind | Focus | 1 | daily | none | x | y\n- B | Mind | Focus | 1 | daily | none | x | y`);
    expect(r.routine?.name).toBe('A');
  });
});

describe('older replies', () => {
  it('still parse, with no meals, summary or routine', () => {
    const r = parseNightlyReply(DEMO_REPLY_MD);
    expect(r.ok).toBe(true);
    expect(r.meals).toEqual([]);
    expect(r.summaryMd).toBe('');
    expect(r.routine).toBeUndefined();
    expect(r.extraSections).toEqual([]);
  });
});
