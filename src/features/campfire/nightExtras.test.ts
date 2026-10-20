import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, foodRepo, mealRepo, noteRepo, profileRepo, routineRepo, timetableRepo } from '@/data/repo';
import { DEMO_REPLY_MD, seedDemo } from '@/data/seed';
import { addDays, todayKey, weekdayOf } from '@/lib/dates';
import { NIGHTLY_TOKEN_BUDGET, buildNightlyPrompt } from '@/lib/prompt/nightly';
import { estimateTokens } from '@/lib/prompt/shared';
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
    expect(md).toContain('Reply with these seventeen sections');
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

const V2_REPLY = `${DEMO_REPLY_MD}

## RIGHT
- 8 km run, day 15 of the streak.

## BETTER
- Lights out by 23:00.

## FOOD
- good: protein near 120 g
- better: water 1.8 of 3 L

## RANT
It is fair to be annoyed. Send the one message before 10.

## PEOPLE
- Riya | college | lent her Maths notes
- Dev | acquaintance | met at the gym
- Mentor | close | finally replied

## WEB
- node: person | Riya | lent her Maths notes
- node: place | Library | the quiet floor works
- link: Riya -> Library | studies at
- link: Riya -> Maths revision | helps with
- summary: Nobody | x

## PLAN
- 06:30-07:00 | Easy 5 km | Body
- 09:00-11:00 | Deep work | Work
- nonsense line`;

describe('the v2 night: notes, timetable, targets, the web and the plan', () => {
  let today: string;

  beforeEach(async () => {
    await seedDemo();
    today = todayKey();
  });

  it('puts the day\'s notes, tomorrow\'s timetable, the targets and the web into the prompt', async () => {
    await noteRepo.add(today, 'rant', 'The group project is a mess.');
    await noteRepo.add(today, 'life', 'Coffee with Riya.');
    const tomorrow = addDays(today, 1);
    await timetableRepo.add({ day: weekdayOf(tomorrow), start: '09:00', end: '10:00', title: 'Maths', kind: 'class', room: 'B-204' });
    await timetableRepo.add({ day: weekdayOf(tomorrow), start: '11:00', end: '12:00', title: 'Old lab', kind: 'lab', to: addDays(today, -1) });
    await timetableRepo.add({ day: (weekdayOf(tomorrow) + 1) % 7, start: '08:00', end: '09:00', title: 'Other day', kind: 'class' });
    await profileRepo.updateSettings({ targets: { kcal: 2200, waterL: 3 } });

    const md = buildNightlyPrompt(await gatherNightlyInput(today));
    expect(md).toMatch(/## Today's notes\n- \d\d:\d\d rant: The group project is a mess.\n- \d\d:\d\d life: Coffee with Riya./);
    expect(md).toContain('- 09:00-10:00 Maths (B-204)');
    expect(md).not.toContain('Old lab');
    expect(md).not.toContain('Other day');
    expect(md).toContain('- Calories: ');
    expect(md).toContain('target 3 L');
    // The player's own things are in the web excerpt before anything is written.
    expect(md).toContain('## Mind web\nThe ');
    expect(md).toContain('- Mentor (person');
    expect(await db.webNodes.count()).toBe(0);
    expect(estimateTokens(md)).toBeLessThanOrEqual(NIGHTLY_TOKEN_BUDGET);
  });

  it('saves the review, food notes and rant answer, puts the plan on tomorrow, and fills people and the web', async () => {
    const before = await db.people.count();
    const res = await acceptReply(today, V2_REPLY, ctx);
    expect(res.ok).toBe(true);
    expect(res.message).toContain('Met 2 new people: Riya, Dev.');
    // Riya (already a node from ## PEOPLE), Library, and the topic made for "Maths revision".
    expect(res.message).toContain('Web: 3 nodes, 2 links.');
    expect(res.message).toContain('New in the web as a topic: Maths revision.');
    expect(res.message).toContain('Nothing in the web called Nobody, so that summary was skipped.');
    expect(res.message).toContain('Tomorrow has a plan: 2 blocks.');

    const log = await dayLogRepo.get(today);
    expect(log?.review).toEqual({ right: ['8 km run, day 15 of the streak.'], better: ['Lights out by 23:00.'] });
    expect(log?.foodNotes).toEqual({ good: ['protein near 120 g'], better: ['water 1.8 of 3 L'] });
    expect(log?.rantReplyMd).toBe('It is fair to be annoyed. Send the one message before 10.');
    expect(log?.plan).toBeUndefined();

    const next = await dayLogRepo.get(addDays(today, 1));
    expect(next?.plan?.map((b) => [b.start, b.end, b.text, b.pillar])).toEqual([
      ['06:30', '07:00', 'Easy 5 km', 'BODY'],
      ['09:00', '11:00', 'Deep work', 'WORK'],
    ]);
    expect(new Set(next!.plan!.map((b) => b.id)).size).toBe(2);

    expect(await db.people.count()).toBe(before + 2);
    const mentor = (await db.people.toArray()).find((p) => p.name === 'Mentor')!;
    expect(mentor.lastContact).toBe(today);
    const riya = (await db.people.toArray()).find((p) => p.name === 'Riya')!;
    const riyaNode = await db.webNodes.filter((n) => n.refId === riya.id).toArray();
    expect(riyaNode).toHaveLength(1);
    expect(riyaNode[0]!.facts).toEqual([{ date: today, text: 'lent her Maths notes' }]);
    // linkExisting ran: the demo's goals and skills have nodes too.
    expect(await db.webNodes.filter((n) => n.type === 'skill').count()).toBeGreaterThan(0);
    expect(await db.webEdges.count()).toBe(2);
  });

  it('a re-paste changes nothing in people, contacts or the web', async () => {
    await acceptReply(today, V2_REPLY, ctx);
    const counts = async () => [await db.people.count(), await db.contacts.count(), await db.webNodes.count(), await db.webEdges.count()];
    const first = await counts();
    const mentions = (await db.webNodes.toArray()).map((n) => `${n.label}:${n.mentions}`).sort();
    const res = await acceptReply(today, V2_REPLY, ctx);
    expect(res.ok).toBe(true);
    expect(await counts()).toEqual(first);
    expect((await db.webNodes.toArray()).map((n) => `${n.label}:${n.mentions}`).sort()).toEqual(mentions);
  });

  it('an older reply leaves tomorrow\'s plan and the web alone', async () => {
    await dayLogRepo.update(addDays(today, 1), { plan: [{ id: 'mine', start: '07:00', end: '08:00', text: 'My own block' }] });
    const res = await acceptReply(today, DEMO_REPLY_MD, ctx);
    expect(res.ok).toBe(true);
    expect(res.message).not.toContain('Web:');
    expect((await dayLogRepo.get(addDays(today, 1)))?.plan).toEqual([{ id: 'mine', start: '07:00', end: '08:00', text: 'My own block' }]);
    expect(await db.webEdges.count()).toBe(0);
  });
});
