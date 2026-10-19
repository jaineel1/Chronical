import { describe, expect, it } from 'vitest';
import { STATE_OF_ME_MD } from '@/data/seed';
import { compressDayLog, formatScreen, shortRoutineName, tonightBlock, type TonightInput } from './dayLog';
import { buildDeepBlock } from './deep';
import { DEEP_TOKEN_BUDGET, NIGHTLY_TOKEN_BUDGET, buildNightlyPrompt, type NightlyInput } from './nightly';
import { GAME_MASTER_PREAMBLE, VOICE_RULES, estimateTokens } from './shared';

const TONIGHT: TonightInput = {
  date: '2026-10-18',
  dayNo: 23,
  log: {
    date: '2026-10-18',
    weightKg: 72.4,
    sleepHours: 6.5,
    mood: 4,
    energy: 3,
    screenMin: 130,
    urgesResisted: 2,
    scrollSessions: 1,
    phoneFreeEvening: true,
    feltLine: 'Tired but steady. The run was the best part of the day.',
    lessonApplied: 'Scheduled the 9 to 11 block the night before.',
  },
  yesterday: { weightKg: 72.6, screenMin: 120 },
  routines: [
    { name: 'Gym', pillar: 'BODY', subStat: 'Strength', weight: 3, status: 'done', streak: 15, streakBefore: 14 },
    { name: 'Deep work, two hours', pillar: 'WORK', subStat: 'Focus', weight: 3, status: 'shielded', streak: 2, streakBefore: 2, cost: 'Three misses and it slips a week' },
    { name: 'Phone-free evening', pillar: 'DOPAMINE', subStat: 'Restraint', weight: 2, status: 'missed', streak: 0, streakBefore: 3 },
    { name: 'Read 20 pages', pillar: 'MIND', subStat: 'Learning', weight: 1, status: 'extra', streak: 5, streakBefore: 5 },
  ],
  routineScore: { BODY: 3, MIND: 1, DOPAMINE: -1 },
  meals: [
    { slot: 'breakfast', name: 'Oats, banana' },
    { slot: 'lunch', name: 'Dal rice', feltAfter: 4 },
  ],
  questions: [
    { text: 'What did you avoid today?', answer: 'The tax form.' },
    { text: 'Who did you make better today?' },
  ],
  lessonBook: 'Deep Work',
  questsToday: [
    { text: 'Easy 5 km', done: true },
    { text: 'Message Mentor', done: false },
  ],
};

function input(over: Partial<NightlyInput> = {}): NightlyInput {
  return {
    date: '2026-10-18',
    dayNo: 23,
    displayName: 'Jaineel',
    deepMode: false,
    excludeMoney: false,
    stateOfMeMd: STATE_OF_ME_MD,
    originSheetMd: '## Part 1\n**Q** What should the game call you?\n**A** Jaineel',
    goals: [
      {
        title: 'Sub-4 marathon',
        pillar: 'BODY',
        status: 'active',
        targetDate: '2027-01-04',
        milestones: [
          { title: 'Long run 30 km', current: 22, target: 30, unit: 'km', done: false },
          { title: 'Half marathon', done: true },
        ],
      },
      { title: 'Old goal', pillar: 'MIND', status: 'paused', milestones: [] },
    ],
    quietPeople: [{ name: 'Mentor', daysQuiet: 21, everyDays: 14, wantCloser: true }],
    reading: [{ title: 'Deep Work', author: 'Cal Newport', lessons: ["Schedule the block, don't decide in the moment."] }],
    skills: [
      { name: 'Running', level: 62 },
      { name: 'Frontend', level: 71 },
    ],
    monthDigests: [{ label: 'September 2026', md: 'A month of 6 AM starts.' }],
    pastDays: Array.from({ length: 30 }, (_, i) => `D${i + 1} line ${i + 1}`),
    tonight: TONIGHT,
    ...over,
  };
}

describe('compressDayLog', () => {
  it('writes one line in the documented shape', () => {
    const line = compressDayLog(
      { date: '2026-10-17', weightKg: 72.4, sleepHours: 6.5, mood: 4, energy: 3, screenMin: 130, feltLine: 'Tired but steady.' },
      ['Gym', 'Run, 8 km at 5:52', 'Skincare'],
      ['Deep work, two hours'],
      [],
      { dayNo: 22 },
    );
    expect(line).toBe('D22 Sat · done: Gym, Run, Skincare · skipped: Deep work · 72.4 kg · slept 6.5 h · mood 4 · energy 3 · screen 2:10 · felt: Tired but steady.');
    expect(line).not.toContain('\n');
  });

  it('adds the extras only when they are there, and says when nothing was logged', () => {
    expect(compressDayLog({ date: '2026-10-17', urgesResisted: 2, scrollSessions: 0, phoneFreeEvening: true }, [], [], ['Oats, banana', 'Dal rice'])).toBe(
      '2026-10-17 Sat · urges resisted 2 · phone-free evening · meals: Oats, banana; Dal rice',
    );
    expect(compressDayLog({ date: '2026-10-16' }, [], [], [], { dayNo: 21 })).toBe('D21 Fri · nothing logged');
  });

  it('formats screen time and short names', () => {
    expect(formatScreen(130)).toBe('2:10');
    expect(formatScreen(5)).toBe('0:05');
    expect(shortRoutineName('Run, 8 km at 5:52')).toBe('Run');
  });
});

describe('tonightBlock', () => {
  const block = tonightBlock(TONIGHT);

  it('carries every number and line from tonight', () => {
    expect(block).toContain('## Tonight, Day 23, Sunday, 18 October');
    expect(block).toContain('weight 72.4 kg (72.6 yesterday)');
    expect(block).toContain('slept 6.5 h');
    expect(block).toContain('mood 4 of 5');
    expect(block).toContain('energy 3 of 5');
    expect(block).toContain('screen 2:10 (+10 min on yesterday)');
    expect(block).toContain('Urges resisted 2 · scroll sessions 1 · phone-free evening: yes');
    expect(block).toContain('Meals: breakfast Oats, banana · lunch Dal rice (felt 4 of 5 after)');
    expect(block).toContain('How today felt: Tired but steady. The run was the best part of the day.');
    expect(block).toContain('Lesson applied, from Deep Work: Scheduled the 9 to 11 block the night before.');
    expect(block).toContain('- What did you avoid today? The tax form.');
    expect(block).not.toContain('Who did you make better today?');
    expect(block).toContain("Today's quests from the last letter, 1 of 2 done. Done: Easy 5 km. Not done: Message Mentor.");
  });

  it('explains each routine outcome', () => {
    expect(block).toContain('Routines. The app has already scored them: Body +3 · Skin 0 · Mind +1 · Work 0 · Dopamine -1.');
    expect(block).toContain('- done: Gym (Body/Strength, weight 3), streak 15');
    expect(block).toContain("This week's shield covers it, so the 2-day streak holds");
    expect(block).toContain('Cost of missing: Three misses and it slips a week');
    expect(block).toContain('No shield left this week; the 3-day streak ends.');
    expect(block).toContain('- done on a day off: Read 20 pages');
  });

  it('has no emoji', () => {
    expect(/\p{Extended_Pictographic}/u.test(block)).toBe(false);
  });
});

describe('buildNightlyPrompt', () => {
  it('puts rules, task and reply format before the rule, then the data', () => {
    const md = buildNightlyPrompt(input());
    expect(md.startsWith(GAME_MASTER_PREAMBLE)).toBe(true);
    expect(md).toContain(VOICE_RULES);
    const [head, data] = md.split('\n---\n');
    expect(data).toBeDefined();
    for (const h of ['## BRIEF', '## AFFIRMATIONS', '## QUESTS', '## STATS', '## WARNINGS', '## INSIGHTS', '## LESSON']) {
      expect(head).toContain(`\n${h}\n`);
    }
    expect(head).toContain('150 to 400 words');
    expect(head).toContain('Exactly two lines. Each must contain a number or a name from the log');
    expect(head).toContain('- [Pillar] quest text | reward: real-life reward');
    expect(head).toContain('from -3 to +3, on top of the routine scores');
    expect(head).toContain('Name A -> B');
    expect(head).toContain('Do not score the routines again');
    expect(head).toContain('Body +3 · Skin 0 · Mind +1 · Work 0 · Dopamine -1');
    expect(head).toContain('starting "From <book title>:"');
    expect(head).toContain('Body: Strength, Endurance, Recovery, Nutrition.');
    expect(head).toContain('Running 62, Frontend 71');
    expect(data).toContain('# State of Me');
    expect(data).toContain('- [Body] Sub-4 marathon, by Monday, 4 January: Long run 30 km (22 of 30 km); Half marathon (done)');
    expect(data).not.toContain('Old goal');
    expect(data).toContain('- Mentor: 21 days quiet (usually every 14), wants to be closer');
    expect(data).toContain("- Deep Work by Cal Newport. Lessons so far: Schedule the block, don't decide in the moment.");
    expect(data).toContain('Running 62 · Frontend 71');
    expect(data).toContain('### September 2026\nA month of 6 AM starts.');
    expect(data).toContain('## Tonight, Day 23');
  });

  it('sends the last 14 days normally and no Origin Sheet', () => {
    const md = buildNightlyPrompt(input());
    expect(md).toContain('## Last 14 days, oldest first\nD17 line 17');
    expect(md).toContain('D30 line 30');
    expect(md).not.toContain('D16 line 16');
    expect(md).not.toContain('Origin Sheet\n');
    expect(estimateTokens(md)).toBeLessThan(NIGHTLY_TOKEN_BUDGET);
  });

  it('adds up to 90 days and the Origin Sheet in deep mode', () => {
    const md = buildNightlyPrompt(input({ deepMode: true }));
    expect(md).toContain('Tonight is a deep night');
    expect(md).toContain('## Origin Sheet\n## Part 1');
    expect(md).toContain('## Earlier days, oldest first (16)\nD1 line 1');
    expect(md).toContain('## Last 14 days, oldest first\nD17 line 17');
  });

  it('brings the Origin Sheet when there is no State of Me yet', () => {
    const md = buildNightlyPrompt(input({ stateOfMeMd: undefined }));
    expect(md).toContain('Not written yet');
    expect(md).toContain('## Origin Sheet');
  });

  it('trims the oldest days first to stay under the budget', () => {
    const long = (i: number) => `D${i} ${'x'.repeat(4000)}`;
    const md = buildNightlyPrompt(input({ pastDays: Array.from({ length: 14 }, (_, i) => long(i + 1)) }));
    expect(estimateTokens(md)).toBeLessThanOrEqual(NIGHTLY_TOKEN_BUDGET);
    expect(md).toContain('D14 x');
    expect(md).not.toContain('D1 x');
    expect(md).toContain('## Tonight, Day 23');
  });

  it('trims older days, then the Origin Sheet, in deep mode', () => {
    const origin = `## Part 1\n${'y'.repeat(150_000)}`;
    const md = buildNightlyPrompt(input({ deepMode: true, originSheetMd: origin, pastDays: Array.from({ length: 90 }, (_, i) => `D${i + 1} ${'z'.repeat(300)}`) }));
    expect(estimateTokens(md)).toBeLessThanOrEqual(DEEP_TOKEN_BUDGET);
    expect(md).toContain('(The rest of the Origin Sheet was left out to keep this prompt short.)');
    expect(md).not.toContain('## Earlier days');
    expect(md).toContain('D90 z');
    expect(md).toContain('D77 z');
  });

  it('strips money from the data half only when asked', () => {
    const rich = input({ tonight: { ...TONIGHT, log: { ...TONIGHT.log!, feltLine: 'Paid ₹12,000 rent and felt lighter.' } } });
    expect(buildNightlyPrompt(rich)).toContain('₹12,000');
    const md = buildNightlyPrompt({ ...rich, excludeMoney: true });
    expect(md).not.toContain('₹12,000');
    expect(md).not.toContain('rent and felt lighter');
    expect(md).toContain('## BRIEF');
  });
});

describe('buildDeepBlock', () => {
  it('is empty without content', () => {
    expect(buildDeepBlock({ olderDays: [] })).toBe('');
    expect(buildDeepBlock({ originSheetMd: 'x', olderDays: ['a', 'b'] })).toBe('## Origin Sheet\nx\n\n## Earlier days, oldest first (2)\na\nb');
  });
});
