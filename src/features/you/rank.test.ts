import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { promptRepo, resetAll } from '@/data/repo';
import { seedDemo } from '@/data/seed';
import { applySkillRankReply, rankMessage } from './rank';

describe('applySkillRankReply', () => {
  beforeEach(async () => {
    await resetAll();
    await seedDemo();
  });

  it('updates levels, milestones and lastAssessedAt, adds assessments and attaches the reply', async () => {
    const prompt = await promptRepo.create('skill_rank', 'Sonnet', 'prompt');
    const reply = `## ASSESSMENT
Running | 64 | 92 | 55 | The 22 km long run moved you up.
Frontend | 71 | 97 | 70 | Same as last time.

## NEXT_MILESTONES
Running | 64 -> 70: a half marathon under 1:55`;
    const r = await applySkillRankReply(reply, prompt.id);
    expect(r.ok).toBe(true);
    expect(r.message).toMatch(/^Rankings updated: Running 62 → 64, Frontend 71 → 71\./);
    expect(r.message).toContain('Not ranked: Lifting, UI design, Public speaking, Cooking.');

    const running = await db.skills.where('sortOrder').equals(0).first();
    expect(running?.name).toBe('Running');
    expect(running?.level).toBe(64);
    expect(running?.milestones).toEqual(['64 to 70: a half marathon under 1:55']);
    expect(running?.lastAssessedAt).toBeTruthy();

    const frontend = (await db.skills.toArray()).find((s) => s.name === 'Frontend');
    expect(frontend?.milestones[0]).toBe('71 to 78: a production app with paying users');

    const assessments = await db.assessments.toArray();
    expect(assessments).toHaveLength(2);
    expect(assessments.find((a) => a.skillId === running!.id)).toMatchObject({ level: 64, percentileGeneral: 92, percentilePractitioners: 55, promptId: prompt.id });

    const stored = await db.prompts.get(prompt.id);
    expect(stored?.parsedOk).toBe(true);
    expect(stored?.replyMd).toBe(reply);
  });

  it('changes nothing on a reply without an assessment, but keeps the reply on the prompt', async () => {
    const prompt = await promptRepo.create('skill_rank', 'Sonnet', 'prompt');
    const before = (await db.skills.toArray()).map((s) => s.level);
    const r = await applySkillRankReply('Sorry, I need more information.', prompt.id);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('No ## ASSESSMENT section in the reply. Nothing was changed.');
    expect((await db.skills.toArray()).map((s) => s.level)).toEqual(before);
    expect(await db.assessments.count()).toBe(0);
    expect((await db.prompts.get(prompt.id))?.parsedOk).toBe(false);
  });

  it('writes the message in the arrow format', () => {
    expect(rankMessage([{ skillId: 'a', name: 'Running', from: 62.4, to: 64 }])).toBe('Rankings updated: Running 62 → 64.');
  });
});
