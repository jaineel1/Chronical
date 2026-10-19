import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, gameRepo, routineLogRepo } from '@/data/repo';
import { DEMO_REPLY_MD, seedDemo } from '@/data/seed';
import { todayKey } from '@/lib/dates';
import { pillarTotals } from '@/lib/game/daily';
import { buildNightlyPrompt, NIGHTLY_TOKEN_BUDGET } from '@/lib/prompt/nightly';
import { estimateTokens } from '@/lib/prompt/shared';
import { NO_BRIEF_ERROR } from '@/lib/parse/reply';
import { gatherKnownNouns, gatherMonthlyInput, gatherNightlyInput, gatherWeeklyInput, monthPeriod } from './gather';
import { SAVED_MESSAGE, acceptReply, rescoreNight, sendNight } from './nightFlow';
import { questionsFor, QUESTION_BANK } from './questions';

const ctx = { promptMd: 'the prompt', model: 'Haiku', kind: 'nightly' as const };

async function points() {
  const subs = await db.subStatState.toArray();
  return Object.fromEntries(subs.map((s) => [`${s.pillar}/${s.name}`, Math.round(s.points * 1000) / 1000]));
}

async function routineId(name: string): Promise<string> {
  return (await db.routines.filter((r) => r.name === name).first())!.id;
}

describe('the night flow on the demo world', () => {
  let today: string;

  beforeEach(async () => {
    await seedDemo();
    today = todayKey();
  });

  it('gathers a complete nightly prompt under the budget', async () => {
    await routineLogRepo.set(await routineId('Evening skincare'), today, true);
    await dayLogRepo.update(today, { weightKg: 72.2, feltLine: 'Long day, good run.', answers: { [questionsFor(23)[0]!.id]: 'Email to the client.' } });
    const input = await gatherNightlyInput(today);
    expect(input.dayNo).toBe(23);
    expect(input.pastDays.length).toBe(22);
    expect(input.tonight.routines.find((r) => r.name === 'Evening skincare')?.status).toBe('done');
    expect(input.quietPeople.map((p) => p.name)).toContain('Mentor');
    expect(input.reading.map((b) => b.title)).toEqual(['Deep Work']);
    expect(input.tonight.questsToday).toHaveLength(3);
    const md = buildNightlyPrompt(input);
    expect(estimateTokens(md)).toBeLessThan(NIGHTLY_TOKEN_BUDGET);
    expect(md).toContain('weight 72.2 kg (72.4 yesterday)');
    expect(md).toContain('How today felt: Long day, good run.');
    expect(md).toContain('Email to the client.');
    expect(md).toContain('## Last 14 days, oldest first\nD9 ');
    expect(md).toContain('D22 ');
    expect(md).toContain('**Jaineel**, 20, Ahmedabad.');
  });

  it('send, paste, re-paste: stats land once and the letter is saved', async () => {
    const skincare = await routineId('Evening skincare');
    await routineLogRepo.set(skincare, today, true);
    const base = await points();

    const sent = await sendNight(today, ctx);
    let log = await dayLogRepo.get(today);
    expect(log?.closedAt).toBeTruthy();
    expect(log?.compiledMd).toBe('the prompt');
    expect(log?.promptId).toBeTruthy();
    expect(log?.statsAppliedAt).toBeTruthy();
    expect(log?.routineStats).toContainEqual({ target: 'Skin/Routine', delta: 2 });
    // First miss of the week for every other scheduled routine: shields, no penalty.
    expect(pillarTotals(log!.routineStats!).WORK).toBe(0);
    expect(sent.warnings.every((w) => w.endsWith('shield used, none left this week'))).toBe(true);
    const afterSend = await points();
    expect(afterSend['SKIN/Routine']).toBeCloseTo(base['SKIN/Routine']! + 2, 6);

    const nouns = await gatherKnownNouns();
    const res = await acceptReply(today, DEMO_REPLY_MD, { ...ctx, knownNouns: nouns });
    expect(res).toEqual({ ok: true, message: SAVED_MESSAGE });
    log = await dayLogRepo.get(today);
    expect(log?.briefMd?.startsWith('Day 23.')).toBe(true);
    expect(log?.quests).toHaveLength(3);
    expect(log?.repliedAt).toBeTruthy();
    expect(pillarTotals([...(log?.routineStats ?? []), ...(log?.stats ?? [])]).WORK).toBe(3);
    const prompt = await db.prompts.get(log!.promptId!);
    expect(prompt).toMatchObject({ parsedOk: true, replyMd: DEMO_REPLY_MD, kind: 'nightly', model: 'Haiku', subject: today });
    const afterReply = await points();
    expect(afterReply['WORK/Focus']).toBeCloseTo(afterSend['WORK/Focus']! + 3, 6);
    expect(afterReply['MIND/Calm']).toBeCloseTo(afterSend['MIND/Calm']! - 1, 6);

    await acceptReply(today, DEMO_REPLY_MD, { ...ctx, knownNouns: nouns });
    expect(await points()).toEqual(afterReply);
    expect((await gameRepo.pillars()).WORK.points).toBeGreaterThan(0);
  });

  it('keeps a reply without a BRIEF as a draft and changes nothing else', async () => {
    await sendNight(today, ctx);
    await acceptReply(today, DEMO_REPLY_MD, { ...ctx, knownNouns: [] });
    const before = await points();
    const bad = await acceptReply(today, '## QUESTS\n- [Body] Run', { ...ctx, knownNouns: [] });
    expect(bad).toEqual({ ok: false, error: NO_BRIEF_ERROR });
    const log = await dayLogRepo.get(today);
    expect(log?.rawDraft).toBe('## QUESTS\n- [Body] Run');
    expect(log?.briefMd?.startsWith('Day 23.')).toBe(true);
    expect(await points()).toEqual(before);
    expect((await db.prompts.get(log!.promptId!))?.parsedOk).toBe(false);
  });

  it('closes the night on paste when the copy never happened', async () => {
    const res = await acceptReply(today, DEMO_REPLY_MD, { ...ctx, knownNouns: [] });
    expect(res.ok).toBe(true);
    const log = await dayLogRepo.get(today);
    expect(log?.closedAt).toBeTruthy();
    expect(log?.promptId).toBeTruthy();
    expect(log?.rawDraft).toBeUndefined();
    expect(await db.prompts.where('subject').equals(today).count()).toBe(1);
  });

  it('re-scores a closed night when a routine is ticked late, and keeps week quests on a re-paste', async () => {
    await sendNight(today, ctx);
    const journal = await routineId('One line in the journal');
    const before = await points();
    await routineLogRepo.set(journal, today, true);
    await rescoreNight(today);
    const after = await points();
    expect(after['MIND/Reflection']).toBeCloseTo(before['MIND/Reflection']! + 1, 6);
    expect((await routineLogRepo.get(journal, today))?.shielded).toBe(false);

    await dayLogRepo.update(today, { quests: [{ id: 'wk-1', text: 'Week quest', done: false }], warnings: ['This week: careful'] });
    await acceptReply(today, DEMO_REPLY_MD, { ...ctx, knownNouns: [] });
    const log = await dayLogRepo.get(today);
    expect(log?.quests.map((q) => q.text)).toContain('Week quest');
    expect(log?.quests).toHaveLength(4);
    expect(log?.warnings).toEqual(['Gym streak at risk: one shield left this week.', 'This week: careful']);
  });

  it('gathers the weekly and monthly inputs', async () => {
    const weekly = await gatherWeeklyInput(today);
    expect(weekly.days).toHaveLength(7);
    expect(weekly.days[0]).toMatch(/^### Day 17, /);
    expect(weekly.dayNoEnd).toBe(23);
    expect(weekly.warnings).toContain('Gym streak at risk: one shield left this week.');
    const monthly = await gatherMonthlyInput(today);
    const period = monthPeriod(today);
    expect(monthly.periodStart).toBe(period.start);
    expect(monthly.days.length).toBeGreaterThan(0);
    expect(monthly.days.length).toBeLessThanOrEqual(30);
  });
});

describe('questions and periods', () => {
  it('gives three distinct questions a night from a bank of 30', () => {
    expect(QUESTION_BANK).toHaveLength(30);
    expect(new Set(QUESTION_BANK.map((q) => q.id)).size).toBe(30);
    for (let n = 1; n <= 60; n++) expect(new Set(questionsFor(n).map((q) => q.id)).size).toBe(3);
    expect(questionsFor(23)).toEqual(questionsFor(23));
    expect(questionsFor(23)).not.toEqual(questionsFor(24));
    expect(QUESTION_BANK.some((q) => q.text.includes('!'))).toBe(false);
  });

  it('digests the previous month on the 1st to 3rd', () => {
    expect(monthPeriod('2026-11-02')).toEqual({ start: '2026-10-01', end: '2026-10-31' });
    expect(monthPeriod('2026-11-04')).toEqual({ start: '2026-11-01', end: '2026-11-04' });
    expect(monthPeriod('2026-01-01')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });
});
