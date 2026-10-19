import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, profileRepo, promptRepo, resetAll } from '@/data/repo';
import { addDays, todayKey, weekKey } from '@/lib/dates';
import { parseOriginReply } from '@/lib/parse/origin';
import { ORIGIN_REPLY_FIXTURE } from '@/lib/parse/origin.fixture';
import { addSuggestions, createGame, latestParsedOrigin, recompileOriginSheet, recordOriginPrompt, startWithoutClaude } from './createGame';

describe('createGame', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Riya');
  });

  it('creates the accepted rows, the State of Me and the first letter dated yesterday', async () => {
    const parsed = parseOriginReply(ORIGIN_REPLY_FIXTURE);
    const prompt = await promptRepo.create('origin', 'Sonnet', 'the prompt', 'origin');
    const created = await createGame({
      accepted: { skills: parsed.skills, routines: parsed.routines.slice(0, 5), goals: parsed.goals },
      stateOfMeMd: parsed.stateOfMeMd,
      briefMd: parsed.briefMd,
      affirmations: parsed.affirmations,
      originSheetMd: '# Origin Sheet — Riya',
      promptId: prompt.id,
    });

    expect(created).toEqual({ skills: 6, routines: 5, goals: 6, letterDate: addDays(todayKey(4), -1) });

    const routines = await db.routines.orderBy('sortOrder').toArray();
    expect(routines.map((r) => r.sortOrder)).toEqual([0, 1, 2, 3, 4]);
    expect(routines[0]).toMatchObject({ name: 'Deep work on Streaks', pillar: 'WORK', subStat: 'Focus', weight: 3, days: [1, 2, 3, 4, 5], streak: 0, shields: 1, archived: false });
    expect(routines[0]!.shieldWeek).toBe(weekKey(todayKey(4)));

    const skills = await db.skills.orderBy('sortOrder').toArray();
    expect(skills[0]).toMatchObject({ name: 'Frontend (React)', level: 46, hours: 0, milestones: [] });
    const assessments = await db.assessments.toArray();
    expect(assessments).toHaveLength(6);
    expect(assessments.find((a) => a.skillId === skills[0]!.id)).toMatchObject({ level: 46, promptId: prompt.id, reasoning: 'ships client sites and a React Native beta on her own' });

    const goals = await db.goals.toArray();
    expect(goals).toHaveLength(6);
    expect(goals.every((g) => g.status === 'active')).toBe(true);

    const profile = await profileRepo.get();
    expect(profile?.stateOfMeMd).toBe(parsed.stateOfMeMd);
    expect(profile?.stateOfMeAt).toBeTruthy();
    expect(profile?.originSheetMd).toBe('# Origin Sheet — Riya');
    expect(profile?.onboardedAt).toBeTruthy();
    expect(profile?.startedAt).toBe(profile?.onboardedAt);

    const letter = await dayLogRepo.get(created.letterDate);
    expect(letter).toMatchObject({ briefMd: parsed.briefMd, affirmations: parsed.affirmations, promptId: prompt.id, quests: [], stats: [] });
    expect(letter?.repliedAt).toBeTruthy();
    expect((await dayLogRepo.latestWithBrief())?.date).toBe(created.letterDate);
  });

  it('adds suggestions after existing rows without disturbing them', async () => {
    const parsed = parseOriginReply(ORIGIN_REPLY_FIXTURE);
    await addSuggestions({ skills: parsed.skills.slice(0, 2), routines: parsed.routines.slice(0, 2), goals: [] });
    const counts = await addSuggestions({ skills: parsed.skills.slice(2, 3), routines: parsed.routines.slice(2, 4), goals: parsed.goals.slice(0, 1) });
    expect(counts).toEqual({ skills: 1, routines: 2, goals: 1 });
    expect((await db.routines.orderBy('sortOrder').toArray()).map((r) => r.sortOrder)).toEqual([0, 1, 2, 3]);
    expect((await db.skills.orderBy('sortOrder').toArray()).map((s) => s.name)).toEqual(['Frontend (React)', 'UI design', 'Running']);
  });

  it('starts without Claude: sheet saved, onboarded, no letter', async () => {
    await startWithoutClaude('# Origin Sheet — Riya\n');
    const p = await profileRepo.get();
    expect(p?.onboardedAt).toBeTruthy();
    expect(p?.originSheetMd).toBe('# Origin Sheet — Riya\n');
    expect(await dayLogRepo.latestWithBrief()).toBeUndefined();
  });

  it('recompiles the sheet with the money setting', async () => {
    await profileRepo.update({ onboardingAnswers: { 'identity-01': 'Riya', 'money-06': 'laptop instalments' } });
    expect(await recompileOriginSheet()).toContain('## Part 7: Money');
    await profileRepo.updateSettings({ excludeMoney: true });
    const md = await recompileOriginSheet();
    expect(md).not.toContain('Money');
    expect((await profileRepo.get())?.originSheetMd).toBe(md);
    await profileRepo.update({ onboardingAnswers: {} });
    expect(await recompileOriginSheet()).toBeUndefined();
  });

  it('records one origin prompt per text and finds the latest parsed one', async () => {
    const a = await recordOriginPrompt('prompt A');
    const again = await recordOriginPrompt('prompt A');
    expect(again.id).toBe(a.id);
    expect(a).toMatchObject({ kind: 'origin', model: 'Sonnet', subject: 'origin' });
    await promptRepo.attachReply(a.id, ORIGIN_REPLY_FIXTURE, true);
    const b = await recordOriginPrompt('prompt A');
    expect(b.id).not.toBe(a.id);
    expect((await latestParsedOrigin())?.id).toBe(a.id);
  });
});
