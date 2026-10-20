import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, profileRepo, resetAll, routineRepo } from '@/data/repo';
import type { Routine } from '@/data/types';
import { NO_DIGEST_ERROR, applyWeeklyReply, isPeriodQuest, isPeriodWarning, parseWeeklyReply } from './weekly';

const REPLY = `## DIGEST
Six of seven gym days, 41 km run, sleep averaged 6.6 h. Deep work held four days.

## STATE_OF_ME
# State of Me
**Jaineel**, 20, Ahmedabad. Week 4 of the game.

## Where I am
- Body: long run 24 km.

## Patterns the game master has noticed
- Short nights are followed by energy 3.

## People
- Mentor answered after three weeks.

## Voice
- Direct, warm.

## QUESTS
- [Body] Long run 26 km on Sunday | reward: week 12 stays on plan
- [Work] Ship the invoicing module | reward: the agency bills itself
- [Mind] Call Aarav | reward: the friendship stays warm

## WARNINGS
- Screen time crept up to 2:40 on three nights.

## INSIGHTS
- Deep work happened on every day the block was planned the night before.
`;

describe('parseWeeklyReply', () => {
  it('reads every section and keeps the State of Me whole', () => {
    const r = parseWeeklyReply(REPLY);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.digestMd).toBe('Six of seven gym days, 41 km run, sleep averaged 6.6 h. Deep work held four days.');
    expect(r.stateOfMeMd.startsWith('# State of Me\n**Jaineel**, 20, Ahmedabad.')).toBe(true);
    for (const h of ['## Where I am', '## Patterns the game master has noticed', '## People', '## Voice']) expect(r.stateOfMeMd).toContain(h);
    expect(r.stateOfMeMd).toContain('- Mentor answered after three weeks.');
    expect(r.stateOfMeMd).not.toContain('QUESTS');
    expect(r.quests.map((q) => [q.pillar, q.text, q.reward])).toEqual([
      ['BODY', 'Long run 26 km on Sunday', 'week 12 stays on plan'],
      ['WORK', 'Ship the invoicing module', 'the agency bills itself'],
      ['MIND', 'Call Aarav', 'the friendship stays warm'],
    ]);
    expect(r.warnings).toEqual(['Screen time crept up to 2:40 on three nights.']);
    expect(r.insights).toHaveLength(1);
  });

  it('accepts "## State of Me" as the section header and adds the title when missing', () => {
    const r = parseWeeklyReply('**Digest**\nA week.\n\n## State of me\n## Where I am\n- Fine.\n\nQuests:\n- Run | reward: legs');
    expect(r.ok).toBe(true);
    expect(r.digestMd).toBe('A week.');
    expect(r.stateOfMeMd).toBe('# State of Me\n\n## Where I am\n- Fine.');
    expect(r.quests).toHaveLength(1);
  });

  it('unwraps a fenced reply and rejects one without a digest', () => {
    expect(parseWeeklyReply('```markdown\n' + REPLY + '\n```').ok).toBe(true);
    const bad = parseWeeklyReply('## STATE_OF_ME\n# State of Me\nx');
    expect(bad.ok).toBe(false);
    expect(bad.errors).toEqual([NO_DIGEST_ERROR]);
  });

  it('notes a missing State of Me without failing', () => {
    const r = parseWeeklyReply('## DIGEST\nA week.\r\n## QUESTS\n- None');
    expect(r.ok).toBe(true);
    expect(r.stateOfMeMd).toBe('');
    expect(r.quests).toEqual([]);
    expect(r.errors[0]).toContain('STATE_OF_ME');
  });
});

const ROUTINE: Omit<Routine, 'id' | 'createdAt' | 'updatedAt'> = {
  name: 'x',
  pillar: 'BODY',
  subStat: 'Strength',
  weight: 3,
  days: [],
  upside: '',
  cost: '',
  streak: 0,
  shields: 1,
  archived: false,
  sortOrder: 0,
};

const BOSS = `## BOSS
Name: The Late-Night Scroll
Pillar: Dopamine
HP: 20
Weak to: Phone-free evening, Evening walk
Reward: a new paperback on Sunday
Taunt: One more video. Then another.`;

describe('parseWeeklyReply ## BOSS', () => {
  it('leaves a reply without ## BOSS exactly as before', () => {
    const r = parseWeeklyReply(REPLY);
    expect('boss' in r).toBe(false);
    expect(r.errors).toEqual([]);
  });

  it('reads the boss and leaves the other sections alone', () => {
    const r = parseWeeklyReply(`${REPLY}\n\n${BOSS}`);
    const before = parseWeeklyReply(REPLY);
    expect(r.boss).toEqual({
      name: 'The Late-Night Scroll',
      pillar: 'DOPAMINE',
      hp: 20,
      weakTo: ['Phone-free evening', 'Evening walk'],
      reward: 'a new paperback on Sunday',
      taunt: 'One more video. Then another.',
    });
    expect(r.errors).toEqual([]);
    const noIds = (p: typeof r) => ({ ...p, boss: undefined, quests: p.quests.map((q) => ({ ...q, id: '' })) });
    expect(noIds(r)).toEqual(noIds(before));
  });

  it('accepts bold headers and fields, bullets, a list under "Weak to:" and an HP with words', () => {
    const r = parseWeeklyReply(
      '**DIGEST**\nA week.\n\n**Boss:**\n- **Name:** "The Snooze"\n- **Pillar:** [Body]\n- **HP:** 14 hp (70% of 20)\n- **Weak to:**\n- Gym (weight 4)\n- Evening walk\n- **Reward:** new shoes',
    );
    expect(r.boss).toEqual({ name: 'The Snooze', pillar: 'BODY', hp: 14, weakTo: ['Gym', 'Evening walk'], reward: 'new shoes', taunt: '' });
  });

  it('"- None" sets no boss and no error', () => {
    const r = parseWeeklyReply('## DIGEST\nA week.\n\n## BOSS\n- None');
    expect(r.ok).toBe(true);
    expect(r.boss).toBeUndefined();
    expect(r.errors.some((e) => e.includes('BOSS'))).toBe(false);
  });

  it('notes missing fields without failing the reply', () => {
    const r = parseWeeklyReply('## DIGEST\nA week.\n\n## BOSS\nName: The Snooze\nPillar: Sleep\nReward: x');
    expect(r.ok).toBe(true);
    expect(r.boss).toBeUndefined();
    expect(r.errors).toContain('The ## BOSS section has no usable Pillar, HP or Weak to, so no boss was set this week.');
  });
});

describe('applyWeeklyReply', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
  });

  it('saves the digest, the State of Me and the week quests, and a re-paste replaces them', async () => {
    const today = '2026-10-18';
    await dayLogRepo.update(today, {
      quests: [{ id: 'n1', text: 'Nightly quest', done: false }],
      warnings: ['Nightly warning'],
    });
    const parsed = parseWeeklyReply(REPLY);
    const digest = await applyWeeklyReply(parsed, 'weekly', '2026-10-12', today, 'prompt-1', today);
    expect(digest).toMatchObject({ kind: 'weekly', periodStart: '2026-10-12', periodEnd: today, promptId: 'prompt-1' });
    expect(digest.md).toContain('Six of seven gym days');
    expect(digest.md).toContain('Insights:\n- Deep work happened');

    const profile = await profileRepo.get();
    expect(profile?.stateOfMeMd).toContain('Week 4 of the game.');
    expect(profile?.stateOfMeAt).toBeTruthy();

    let log = await dayLogRepo.get(today);
    expect(log?.quests.map((q) => q.text)).toEqual(['Nightly quest', 'Long run 26 km on Sunday', 'Ship the invoicing module', 'Call Aarav']);
    expect(log?.quests.filter(isPeriodQuest)).toHaveLength(3);
    expect(log?.warnings).toEqual(['Nightly warning', 'This week: Screen time crept up to 2:40 on three nights.']);
    expect(log?.warnings.filter(isPeriodWarning)).toHaveLength(1);

    await applyWeeklyReply(parseWeeklyReply(REPLY), 'weekly', '2026-10-12', today, undefined, today);
    log = await dayLogRepo.get(today);
    expect(log?.quests).toHaveLength(4);
    expect(log?.warnings).toHaveLength(2);
    expect(await db.digests.count()).toBe(1);
    expect((await db.digests.toArray())[0]?.promptId).toBe('prompt-1');

    await applyWeeklyReply(parseWeeklyReply(REPLY), 'monthly', '2026-10-01', today, undefined, today);
    expect(await db.digests.count()).toBe(2);
    expect((await dayLogRepo.get(today))?.quests).toHaveLength(7);
  });

  it('saves the boss on the weekly digest for the next seven days, matching routines, and a re-paste without one clears it', async () => {
    const today = '2026-10-18';
    await routineRepo.create({ ...ROUTINE, name: 'Phone-free evening', pillar: 'DOPAMINE', subStat: 'Restraint' });
    const digest = await applyWeeklyReply(parseWeeklyReply(`${REPLY}\n\n${BOSS}`), 'weekly', '2026-10-12', today, undefined, today);
    const routines = await db.routines.toArray();
    expect(digest.boss).toMatchObject({ name: 'The Late-Night Scroll', hp: 20, start: '2026-10-19', end: '2026-10-25' });
    expect(digest.boss?.weakTo).toEqual([{ name: 'Phone-free evening', routineId: routines[0]!.id }, { name: 'Evening walk' }]);
    expect((await db.digests.get(digest.id))?.boss?.name).toBe('The Late-Night Scroll');

    await applyWeeklyReply(parseWeeklyReply(REPLY), 'weekly', '2026-10-12', today, undefined, today);
    expect((await db.digests.get(digest.id))?.boss).toBeUndefined();

    const monthly = await applyWeeklyReply(parseWeeklyReply(`${REPLY}\n\n${BOSS}`), 'monthly', '2026-10-01', today, undefined, today);
    expect(monthly.boss).toBeUndefined();
  });

  it('refuses a reply that did not parse', async () => {
    await expect(applyWeeklyReply(parseWeeklyReply('nothing'), 'weekly', 'a', 'b')).rejects.toThrow(NO_DIGEST_ERROR);
  });
});
