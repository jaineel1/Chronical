import { describe, expect, it } from 'vitest';
import { DEMO_REPLY_MD } from '@/data/seed';
import { EMPTY_BRIEF_ERROR, NO_BRIEF_ERROR, isGenericAffirmation, parseNightlyReply, parseQuestLine, parseStatLine } from './reply';

const strip = (qs: { pillar?: string; text: string; reward?: string }[]) => qs.map(({ pillar, text, reward }) => ({ pillar, text, reward }));

const MINIMAL = `## BRIEF
Day 4. You slept 7 hours.

## QUESTS
- [Body] Walk 30 minutes | reward: legs

## STATS
Body +1
`;

describe('parseNightlyReply: the demo reply', () => {
  const r = parseNightlyReply(DEMO_REPLY_MD, { knownNouns: ['Gym', 'Mentor', 'Running'] });

  it('is ok and keeps the whole letter', () => {
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.briefMd.startsWith('Day 23. Yesterday you ran 8 km at 5:52')).toBe(true);
    expect(r.briefMd.endsWith('keeps a door open.')).toBe(true);
    expect(r.briefMd).toBe(DEMO_REPLY_MD.split('## AFFIRMATIONS')[0]!.replace('## BRIEF\n', '').trim());
    expect(r.briefMd.split('\n\n')).toHaveLength(3);
  });

  it('reads three quests with pillars and rewards', () => {
    expect(strip(r.quests)).toEqual([
      { pillar: 'WORK', text: 'Two hours of deep work on the invoicing module', reward: 'ships Friday' },
      { pillar: 'BODY', text: 'Easy 5 km at 6:00 pace', reward: 'week 11 of 22 stays on plan' },
      { pillar: 'MIND', text: 'Message Mentor, one line is enough', reward: 'Mind goes up by 2' },
    ]);
    expect(r.quests.every((q) => q.done === false && q.id.length > 0)).toBe(true);
    expect(new Set(r.quests.map((q) => q.id)).size).toBe(3);
  });

  it('reads the stats exactly', () => {
    expect(r.stats).toEqual([
      { target: 'Body', delta: 2 },
      { target: 'Skin', delta: 0 },
      { target: 'Mind', delta: -1 },
      { target: 'Work', delta: 3 },
      { target: 'Dopamine', delta: 1 },
      { target: 'Running', from: 62, to: 62 },
    ]);
  });

  it('reads affirmations, warning, insight and lesson', () => {
    expect(r.affirmations).toHaveLength(2);
    expect(r.affirmations[0]).toBe('Twenty-three nights in a row. You are already the person you said you wanted to become.');
    expect(r.flaggedAffirmations).toEqual([]);
    expect(r.warnings).toEqual(['Gym streak at risk: one shield left this week.']);
    expect(r.insights).toEqual(['Late nights are followed by energy 3. Three of three this week.']);
    expect(r.lessonMd).toBe("From Deep Work: schedule the block, don't decide in the moment.");
    expect(r.extraSections).toEqual([]);
  });
});

describe('parseNightlyReply: malformed input', () => {
  it('rejects a reply with no headers at all', () => {
    const r = parseNightlyReply('Great day. You ran 8 km and slept well. Keep going.');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe(NO_BRIEF_ERROR);
    expect(r.briefMd).toBe('');
  });

  it('rejects a reply without BRIEF even when other sections exist', () => {
    const r = parseNightlyReply('## QUESTS\n- [Body] Run | reward: legs\n## STATS\nBody +1');
    expect(r.ok).toBe(false);
    expect(r.errors).toEqual([NO_BRIEF_ERROR]);
    expect(r.quests).toEqual([]);
  });

  it('rejects an empty BRIEF', () => {
    const r = parseNightlyReply('## BRIEF\n\n## QUESTS\n- Run');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe(EMPTY_BRIEF_ERROR);
  });

  it('reads lowercase headers', () => {
    const r = parseNightlyReply(MINIMAL.toLowerCase().replace('day 4', 'Day 4'));
    expect(r.ok).toBe(true);
    expect(r.briefMd).toBe('Day 4. you slept 7 hours.');
    expect(r.quests[0]?.pillar).toBe('BODY');
    expect(r.stats).toEqual([{ target: 'Body', delta: 1 }]);
  });

  it('reads bold headers, colon headers and numbered headers', () => {
    const md = '**Brief**\nA letter.\n\n**QUESTS:**\n- [Work] Ship | reward: done\n\nStats:\nWork +2\n\n3. Lesson\nFrom Deep Work: block it.';
    const r = parseNightlyReply(md);
    expect(r.ok).toBe(true);
    expect(r.briefMd).toBe('A letter.');
    expect(strip(r.quests)).toEqual([{ pillar: 'WORK', text: 'Ship', reward: 'done' }]);
    expect(r.stats).toEqual([{ target: 'Work', delta: 2 }]);
    expect(r.lessonMd).toBe('From Deep Work: block it.');
  });

  it('ignores prose before the first header', () => {
    const r = parseNightlyReply(`Here is tonight's reply, in the format you asked for.\n\n${MINIMAL}`);
    expect(r.ok).toBe(true);
    expect(r.briefMd).toBe('Day 4. You slept 7 hours.');
    expect(r.extraSections).toEqual([]);
  });

  it('handles CRLF line endings', () => {
    const r = parseNightlyReply(DEMO_REPLY_MD.replace(/\n/g, '\r\n'));
    expect(r.ok).toBe(true);
    expect(r.quests).toHaveLength(3);
    expect(r.stats).toHaveLength(6);
    expect(r.briefMd).not.toContain('\r');
  });

  it('keeps going when QUESTS is missing, and says so', () => {
    const r = parseNightlyReply('## BRIEF\nA letter.\n## STATS\nBody +1\n## AFFIRMATIONS\n- 3 runs this week.\n## LESSON\nOne.');
    expect(r.ok).toBe(true);
    expect(r.quests).toEqual([]);
    expect(r.errors).toEqual(['No ## QUESTS section.']);
  });

  it('reads STATS written as bullets with bold names and colons', () => {
    const r = parseNightlyReply('## BRIEF\nx\n## STATS\n- **Body** +2\n* Mind: -1\n- **Work +3**\n• Skin: 0');
    expect(r.stats).toEqual([
      { target: 'Body', delta: 2 },
      { target: 'Mind', delta: -1 },
      { target: 'Work', delta: 3 },
      { target: 'Skin', delta: 0 },
    ]);
  });

  it('reads unicode arrows, minus signs and en dashes', () => {
    const r = parseNightlyReply('## BRIEF\nx\n## STATS\nRunning 62 → 64\nMind −1\nSkin – 2\nLifting 48->49\nUI design: 66 to 67');
    expect(r.stats).toEqual([
      { target: 'Running', from: 62, to: 64 },
      { target: 'Mind', delta: -1 },
      { target: 'Skin', delta: -2 },
      { target: 'Lifting', from: 48, to: 49 },
      { target: 'UI design', from: 66, to: 67 },
    ]);
  });

  it('unwraps a reply pasted inside a ```markdown fence', () => {
    const r = parseNightlyReply('Sure, here it is:\n```markdown\n' + DEMO_REPLY_MD + '```\n');
    expect(r.ok).toBe(true);
    expect(r.quests).toHaveLength(3);
    expect(r.lessonMd).toContain('Deep Work');
    expect(r.briefMd).not.toContain('```');
  });

  it('merges duplicate list sections and keeps the last letter', () => {
    const md = '## BRIEF\nFirst draft.\n## QUESTS\n- [Body] Run | reward: legs\n## STATS\nBody +1\n## BRIEF\nFinal letter.\n## QUESTS\n- [Mind] Read | reward: calm\n- [Body] Run | reward: legs\n## STATS\nBody +2\nMind 1';
    const r = parseNightlyReply(md);
    expect(r.ok).toBe(true);
    expect(r.briefMd).toBe('Final letter.');
    expect(strip(r.quests)).toEqual([
      { pillar: 'BODY', text: 'Run', reward: 'legs' },
      { pillar: 'MIND', text: 'Read', reward: 'calm' },
    ]);
    expect(r.stats).toEqual([
      { target: 'Body', delta: 2 },
      { target: 'Mind', delta: 1 },
    ]);
    expect(r.errors).toContain('BRIEF appeared 2 times; the last one was kept.');
    expect(r.errors).toContain('QUESTS appeared 2 times; they were merged.');
  });

  it('keeps unknown sections verbatim', () => {
    const r = parseNightlyReply('## BRIEF\nx\n## P.S.\nDrink water.\n\nTwo lines.\n## Mood map\n- calm');
    expect(r.extraSections).toEqual([
      { title: 'P.S.', body: 'Drink water.\n\nTwo lines.' },
      { title: 'Mood map', body: '- calm' },
    ]);
  });

  it('maps headers with extra words onto the known sections', () => {
    const r = parseNightlyReply('## Brief for tomorrow\nx\n## Lesson for tomorrow\nFrom Atomic Habits: never miss twice.');
    expect(r.ok).toBe(true);
    expect(r.lessonMd).toBe('From Atomic Habits: never miss twice.');
  });

  it('reads an inline LESSON line', () => {
    const r = parseNightlyReply('## BRIEF\nx\n\nLESSON: From Deep Work: plan the block.');
    expect(r.lessonMd).toBe('From Deep Work: plan the block.');
    expect(r.briefMd).toBe('x');
  });

  it('drops "None" placeholders in warnings and insights', () => {
    const r = parseNightlyReply('## BRIEF\nx\n## WARNINGS\n- None\n## INSIGHTS\nNone.');
    expect(r.warnings).toEqual([]);
    expect(r.insights).toEqual([]);
  });
});

describe('STATS grammar', () => {
  it('reads every documented shape', () => {
    expect(parseStatLine('Body +2')).toEqual([{ target: 'Body', delta: 2 }]);
    expect(parseStatLine('Body -2')).toEqual([{ target: 'Body', delta: -2 }]);
    expect(parseStatLine('Body 0')).toEqual([{ target: 'Body', delta: 0 }]);
    expect(parseStatLine('Body: +2')).toEqual([{ target: 'Body', delta: 2 }]);
    expect(parseStatLine('Running 62 -> 64')).toEqual([{ target: 'Running', from: 62, to: 64 }]);
    expect(parseStatLine('Running 62 → 64')).toEqual([{ target: 'Running', from: 62, to: 64 }]);
    expect(parseStatLine('body/endurance +1')).toEqual([{ target: 'Body/Endurance', delta: 1 }]);
    expect(parseStatLine('Work / Focus +1.5')).toEqual([{ target: 'Work/Focus', delta: 1.5 }]);
  });

  it('splits several stats on one line', () => {
    expect(parseStatLine('Body +2 · Mind -1 · Body/Endurance +1 · Running 62 -> 64')).toEqual([
      { target: 'Body', delta: 2 },
      { target: 'Mind', delta: -1 },
      { target: 'Body/Endurance', delta: 1 },
      { target: 'Running', from: 62, to: 64 },
    ]);
    expect(parseStatLine('Body +2, Mind -1')).toEqual([
      { target: 'Body', delta: 2 },
      { target: 'Mind', delta: -1 },
    ]);
  });

  it('ignores trailing comments and sentence full stops', () => {
    expect(parseStatLine('Body +2 (gym and the run)')).toEqual([{ target: 'Body', delta: 2 }]);
    expect(parseStatLine('Body +2, because the run held')).toEqual([{ target: 'Body', delta: 2 }]);
    expect(parseStatLine('Mind -1.')).toEqual([{ target: 'Mind', delta: -1 }]);
    expect(parseStatLine('Running 62 -> 64.')).toEqual([{ target: 'Running', from: 62, to: 64 }]);
    expect(parseStatLine('+2 Body')).toEqual([{ target: 'Body', delta: 2 }]);
  });

  it('keeps unknown names as written and leaves prose alone', () => {
    expect(parseStatLine('Public speaking 31 -> 33')).toEqual([{ target: 'Public speaking', from: 31, to: 33 }]);
    expect(parseStatLine('Body/Flexibility +1')).toEqual([{ target: 'Body/Flexibility', delta: 1 }]);
    expect(parseStatLine('Nothing changed much today')).toEqual([]);
    expect(parseStatLine('None')).toEqual([]);
  });

  it('clamps pillar adjustments to -3..+3 and reports unreadable lines', () => {
    const r = parseNightlyReply('## BRIEF\nx\n## STATS\nBody +5\nMind/Calm -4\nRunning 62 -> 70\nthe week was good');
    expect(r.stats).toEqual([
      { target: 'Body', delta: 3 },
      { target: 'Mind/Calm', delta: -3 },
      { target: 'Running', from: 62, to: 70 },
    ]);
    expect(r.errors).toContain('Body +5 is outside -3 to +3; kept +3.');
    expect(r.errors).toContain('Could not read a STATS line: "the week was good".');
  });
});

describe('QUESTS grammar', () => {
  const q = (line: string) => {
    const quest = parseQuestLine(line);
    return quest ? { pillar: quest.pillar, text: quest.text, reward: quest.reward } : undefined;
  };

  it('reads the documented shape and the reward variants', () => {
    expect(q('- [Work] Ship the module | reward: ships Friday')).toEqual({ pillar: 'WORK', text: 'Ship the module', reward: 'ships Friday' });
    expect(q('[body] Run 5 km (reward: legs stay loose)')).toEqual({ pillar: 'BODY', text: 'Run 5 km', reward: 'legs stay loose' });
    expect(q('[Mind] Call Mom — reward: she hears from you')).toEqual({ pillar: 'MIND', text: 'Call Mom', reward: 'she hears from you' });
    expect(q('[Skin] Sunscreen, reward — no new spots')).toEqual({ pillar: 'SKIN', text: 'Sunscreen', reward: 'no new spots' });
    expect(q('1. **[Dopamine]** Phone in the drawer by 9 | the evening is yours')).toEqual({
      pillar: 'DOPAMINE',
      text: 'Phone in the drawer by 9',
      reward: 'the evening is yours',
    });
  });

  it('treats the pillar and the reward as optional', () => {
    expect(q('Read 20 pages')).toEqual({ pillar: undefined, text: 'Read 20 pages', reward: undefined });
    expect(q('Work: two deep hours | reward: invoices out')).toEqual({ pillar: 'WORK', text: 'two deep hours', reward: 'invoices out' });
    expect(q('[Social] Dinner with Aarav | reward: a friend')).toEqual({ pillar: undefined, text: 'Dinner with Aarav', reward: 'a friend' });
    expect(q('- [ ] [Body] Stretch | reward: no stiff back')).toEqual({ pillar: 'BODY', text: 'Stretch', reward: 'no stiff back' });
    expect(q('')).toBeUndefined();
  });

  it('skips intro lines inside the section', () => {
    const r = parseNightlyReply('## BRIEF\nx\n## QUESTS\nThree for tomorrow:\n- [Body] Run | reward: legs');
    expect(r.quests.map((x) => x.text)).toEqual(['Run']);
  });
});

describe('affirmations', () => {
  it('flags lines with no number and none of the player names', () => {
    const r = parseNightlyReply(
      '## BRIEF\nx\n## AFFIRMATIONS\n- You are enough.\n- Fourteen gym days in a row.\n- The Gym does not lie.\n- *Mentor would be proud of 3 shipped tasks.*',
      { knownNouns: ['Gym'] },
    );
    expect(r.affirmations).toEqual(['You are enough.', 'Fourteen gym days in a row.', 'The Gym does not lie.', 'Mentor would be proud of 3 shipped tasks.']);
    expect(r.flaggedAffirmations).toEqual(['You are enough.']);
  });

  it('matches known names on word boundaries only', () => {
    expect(isGenericAffirmation('You showed up again.', ['Run'])).toBe(true);
    expect(isGenericAffirmation('The Run held.', ['Run'])).toBe(false);
    expect(isGenericAffirmation('Your running is improving.', ['Run'])).toBe(true);
    expect(isGenericAffirmation('Twenty-three nights.', [])).toBe(false);
    expect(isGenericAffirmation('One step at a time.', [])).toBe(true);
  });
});
