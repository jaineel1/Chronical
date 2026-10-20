import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, foodRepo, mealRepo, routineRepo } from '@/data/repo';
import { DEMO_REPLY_MD, seedDemo } from '@/data/seed';
import { todayKey } from '@/lib/dates';
import { buildNightlyPrompt } from '@/lib/prompt/nightly';
import { gatherNightlyInput } from './gather';
import { acceptReply } from './nightFlow';

const ctx = { promptMd: 'the prompt', model: 'Opus', kind: 'nightly' as const, knownNouns: [] };

const REPLY = `${DEMO_REPLY_MD}

## MEALS
- Breakfast | Oats with banana | 250 g | 380 kcal | P 12 g | C 60 g | F 8 g
- Lunch | Dal rice | 400 g | 600 kcal | P 20 g | C 95 g | F 14 g
- Snack | Protein bar | 60 g | 220 kcal

## SUMMARY
Five of six routines. 980 kcal logged across two meals.

## ROUTINE
- Evening walk | Body | Endurance | 2 | daily | 19:00-19:30 | sleep comes easier | another short night`;

describe('more of today, meals and the new reply sections', () => {
  let today: string;

  beforeEach(async () => {
    await seedDemo();
    today = todayKey();
  });

  it('puts the glance, the new fields and known meal numbers into the prompt', async () => {
    await dayLogRepo.update(today, { sleepHours: 6, waterL: 2.5, steps: 8200, workoutType: 'Gym', workoutMin: 45, caffeineCups: 2, stress: 4, deepWorkHours: 3, topWin: 'Shipped invoicing', gratitude: 'A quiet morning' });
    const oats = await foodRepo.ensure('Oats with banana');
    await foodRepo.setNutrition(oats.id, { grams: 250, kcal: 380, proteinG: 12 }, 'you');
    await mealRepo.addFood(today, (await db.foods.get(oats.id))!, 'breakfast', 500);

    const md = buildNightlyPrompt(await gatherNightlyInput(today));
    const glance = md.indexOf('## Today at a glance, Day 23');
    expect(glance).toBeGreaterThan(md.indexOf('\n---\n'));
    expect(glance).toBeLessThan(md.indexOf('# State of Me'));
    expect(md).toMatch(/sleep 6 h \(7-day avg [\d.]+ h\)/);
    expect(md).toContain('water 2.5 L · 8,200 steps · workout Gym 45 min · caffeine 2 · deep work 3 h · stress 4');
    expect(md).toContain('Top win today: Shipped invoicing');
    expect(md).toContain('Grateful for: A quiet morning');
    // The saved 250 g portion, scaled to the 500 g eaten.
    expect(md).toContain('breakfast Oats with banana (known: 500 g · 760 kcal · P 24)');
    expect(md).toContain('## MEALS');
    expect(md).toContain('## SUMMARY');
    expect(md).toContain('## ROUTINE');
    expect(md).toContain('Reply with these ten sections');
  });

  it('a pasted reply fills the meals and saved meals, keeps typed numbers, and stores the recap and routine', async () => {
    const oats = await foodRepo.ensure('Oats with banana');
    const dal = await foodRepo.ensure('Dal rice');
    await mealRepo.addFood(today, oats, 'breakfast');
    const lunch = await mealRepo.addFood(today, dal, 'lunch');
    await mealRepo.setNutrition(lunch.id, { grams: 300, kcal: 450 }, 'you');

    const res = await acceptReply(today, REPLY, ctx);
    expect(res.ok).toBe(true);
    expect(res.message).toContain('No logged meal called Protein bar');

    const meals = await mealRepo.forDate(today);
    const byFood = new Map(meals.map((m) => [m.foodId, m]));
    expect(byFood.get(oats.id)?.nutrition).toEqual({ grams: 250, kcal: 380, proteinG: 12, carbsG: 60, fatG: 8 });
    expect(byFood.get(oats.id)?.nutritionFrom).toBe('claude');
    // Typed numbers win over Claude's.
    expect(byFood.get(dal.id)?.nutrition).toEqual({ grams: 300, kcal: 450 });
    // The saved meal learns the portion, so tomorrow it is filled in at once.
    expect((await db.foods.get(oats.id))?.nutrition?.kcal).toBe(380);

    const log = await dayLogRepo.get(today);
    expect(log?.summaryMd).toBe('Five of six routines. 980 kcal logged across two meals.');
    expect(log?.routineSuggestion).toMatchObject({ name: 'Evening walk', pillar: 'BODY', subStat: 'Endurance', status: 'open' });
  });

  it('does not suggest a routine that is already in the game', async () => {
    await db.routines.put({ ...(await routineRepo.listActive())[0]!, id: 'walk', name: 'Evening walk' });
    await acceptReply(today, REPLY, ctx);
    expect((await dayLogRepo.get(today))?.routineSuggestion).toBeUndefined();
  });
});
