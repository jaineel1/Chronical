import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { promptRepo, resetAll } from '@/data/repo';
import { seedDemo, type DemoIds } from '@/data/seed';
import { applyLoreReply, loreChanges, loreSubject, rememberedFacts } from './lore';

describe('loreChanges', () => {
  it('keeps only the fields allowed for the type', () => {
    const r = loreChanges('skill', { level: '64', goal: 'Sub-4 marathon', closeness: '5', mood: 'great' });
    expect(r.changes).toEqual({ level: 64, goal: 'Sub-4 marathon' });
    expect(r.applied).toEqual(['level 64', 'goal']);
    expect(r.ignored).toEqual(['closeness', 'mood']);
  });
  it('clamps and parses person fields', () => {
    const r = loreChanges('person', { closeness: '9', contactEveryDays: 'every 10 days', wantCloser: 'Yes, clearly', notes: 'Ask about  the move.' });
    expect(r.changes).toEqual({ closeness: 5, contactEveryDays: 10, wantCloser: true, notes: 'Ask about the move.' });
  });
  it('validates goal dates and book statuses', () => {
    expect(loreChanges('goal', { targetDate: 'January', why: 'Proof.' }).changes).toEqual({ why: 'Proof.' });
    expect(loreChanges('goal', { targetDate: '2027-01-18' }).changes).toEqual({ targetDate: '2027-01-18' });
    expect(loreChanges('book', { status: 'Finished it', author: 'Cal Newport' }).changes).toEqual({ status: 'done', author: 'Cal Newport' });
    expect(loreChanges('book', { status: 'maybe' }).ignored).toEqual(['status']);
  });
});

describe('applyLoreReply', () => {
  let ids: DemoIds;
  beforeEach(async () => {
    await resetAll();
    ids = await seedDemo();
  });

  it('stores the note, achievements and updates for a skill', async () => {
    const skillId = ids.skills.running!;
    const prompt = await promptRepo.create('lore', 'Haiku', 'p', skillId);
    const reply = '## FACTS\n- Started in March.\n## ACHIEVEMENTS\n2026-10-12 | Long run 24 km | 24 km\nnone | Ran in the rain | none\n## LESSONS\nnone\n## UPDATES\nlevel: 63\n## REPLY\nI will remember March.';
    const r = await applyLoreReply({ type: 'skill', itemId: skillId, freeText: 'I started in March.', replyMd: reply, promptId: prompt.id, today: '2026-10-19' });
    expect(r.ok).toBe(true);
    expect(r.message).toBe('Kept 1 fact, 2 achievements. Updated level 63.');
    const lore = await db.lore.toArray();
    expect(lore).toHaveLength(1);
    expect(lore[0]).toMatchObject({ itemType: 'skill', itemId: skillId, text: 'I started in March.', promptId: prompt.id });
    const ach = await db.achievements.where('skillId').equals(skillId).toArray();
    expect(ach.map((a) => [a.date, a.text, a.value, a.unit])).toContainEqual(['2026-10-12', 'Long run 24 km', 24, 'km']);
    expect(ach.map((a) => [a.date, a.text])).toContainEqual(['2026-10-19', 'Ran in the rain']);
    expect((await db.skills.get(skillId))?.level).toBe(63);
    expect((await db.prompts.get(prompt.id))?.parsedOk).toBe(true);
  });

  it('adds new lessons to a book without duplicating old ones, and ignores achievements', async () => {
    const bookId = ids.books.deepwork!;
    const reply = "## FACTS\n- Read it in October.\n## ACHIEVEMENTS\n2026-10-01 | Finished | none\n## LESSONS\n- Schedule the block, don't decide in the moment.\n- Batch shallow work after 4 PM.\n## UPDATES\nstatus: done\n## REPLY\nTwo lessons.";
    const r = await applyLoreReply({ type: 'book', itemId: bookId, freeText: 'x', replyMd: reply, today: '2026-10-19' });
    expect(r.ok).toBe(true);
    expect(r.message).toBe('Kept 1 fact, 1 lesson. Updated status done.');
    const lessons = await db.lessons.where('bookId').equals(bookId).toArray();
    expect(lessons.map((l) => l.text)).toContain('Batch shallow work after 4 PM.');
    expect(lessons).toHaveLength(3);
    expect((await db.books.get(bookId))?.status).toBe('done');
    expect(await db.achievements.filter((a) => a.text === 'Finished').count()).toBe(0);
  });

  it('updates whitelisted person fields', async () => {
    const personId = ids.people.mentor!;
    const r = await applyLoreReply({ type: 'person', itemId: personId, freeText: 'x', replyMd: '## REPLY\nNoted.\n## UPDATES\ncontactEveryDays: 10\nname: Someone else', today: '2026-10-19' });
    expect(r.ok).toBe(true);
    const p = await db.people.get(personId);
    expect(p?.contactEveryDays).toBe(10);
    expect(p?.name).toBe('Mentor');
  });

  it('rejects an unreadable reply and stores nothing', async () => {
    const r = await applyLoreReply({ type: 'goal', itemId: ids.goals.marathon!, freeText: 'x', replyMd: 'Great goal.', today: '2026-10-19' });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/No ## FACTS or ## REPLY/);
    expect(await db.lore.count()).toBe(0);
  });

  it('builds a subject summary that includes remembered facts', async () => {
    const goalId = ids.goals.marathon!;
    await applyLoreReply({ type: 'goal', itemId: goalId, freeText: 'x', replyMd: '## FACTS\n- Race is in Mumbai.\n## REPLY\nOk.', today: '2026-10-19' });
    const s = await loreSubject('goal', goalId, '2026-10-19');
    expect(s?.name).toBe('Sub-4 marathon');
    expect(s?.summaryLines).toContain('Milestone: Long run 30 km: 22 of 30 km');
    expect(s?.summaryLines).toContain('Already known: Race is in Mumbai.');
    expect(rememberedFacts([{ structuredMd: '## FACTS\n- a\n- A' }, { structuredMd: '## FACTS\n- b' }])).toEqual(['a', 'b']);
  });
});
