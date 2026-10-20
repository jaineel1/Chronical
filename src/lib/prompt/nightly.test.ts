import { describe, expect, it } from 'vitest';
import { STATE_OF_ME_MD } from '@/data/seed';
import type { WebNode } from '@/data/types';
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
    notes: [],
    tomorrow: { date: '2026-10-19', slots: [], routineWindows: [] },
    web: { nodes: [], edges: [] },
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
    expect(block).toContain("The week's shield covers it, so the 2-day streak holds, and no shield is left this week.");
    expect(block).toContain('Cost of missing: Three misses and it slips a week.');
    expect(block).toContain('No shield left this week, so the 3-day streak ends.');
    expect(block).toContain('- done on a day off: Read 20 pages');
  });

  it('describes a past day as recorded, without costs', () => {
    const past = tonightBlock({ ...TONIGHT, past: true, heading: '### Day 23, Sunday, 18 October' });
    expect(past.startsWith('### Day 23, Sunday, 18 October\nRoutines, app score: Body +3')).toBe(true);
    expect(past).toContain('A shield covered it; the 2-day streak held.');
    expect(past).toContain('- skipped: Phone-free evening (Dopamine/Restraint, weight 2); the 3-day streak ended.');
    expect(past).not.toContain('Cost of missing');
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

function node(i: number, over: Partial<WebNode> = {}): WebNode {
  return {
    id: `n${i}`,
    createdAt: '2026-10-01T00:00:00.000Z',
    updatedAt: '2026-10-01T00:00:00.000Z',
    type: 'topic',
    label: `Thread ${i}`,
    summaryMd: `Summary ${i}. ${'w'.repeat(300)}`,
    facts: [],
    firstSeen: '2026-10-01',
    lastSeen: '2026-10-18',
    mentions: 1,
    importance: 3,
    ...over,
  };
}

describe('v2 data blocks', () => {
  const withAll = () =>
    input({
      notes: [
        { time: '13:05', kind: 'rant', text: 'The group project is a mess.\nNobody replied.' },
        { time: '16:40', kind: 'life', text: 'Coffee with Riya after Maths.' },
      ],
      tomorrow: {
        date: '2026-10-19',
        slots: [
          { start: '11:00', end: '11:15', title: 'Break', kind: 'break' },
          { start: '09:00', end: '10:00', title: 'Maths', kind: 'class', room: 'B-204' },
        ],
        routineWindows: [{ name: 'Run, 8 km', window: '06:00-07:00' }],
      },
      targets: { kcal: 2200, proteinG: 140, waterL: 3, sleepHours: 7.5, screenMin: 120 },
      tonight: {
        ...TONIGHT,
        log: { ...TONIGHT.log!, waterL: 2.5 },
        meals: [
          { slot: 'breakfast', name: 'Oats', nutrition: { kcal: 380, proteinG: 12 } },
          { slot: 'lunch', name: 'Dal rice' },
        ],
      },
      web: {
        nodes: [node(1, { label: 'Riya', type: 'person', importance: 4, facts: [{ date: '2026-10-18', text: 'Studies Maths with you' }] }), node(2, { label: 'Sub-4 marathon', type: 'goal' })],
        edges: [{ id: 'e1', createdAt: '', updatedAt: '', from: 'n1', to: 'n2', relation: 'runs with', weight: 2, firstSeen: '2026-10-10', lastSeen: '2026-10-18' }],
      },
    });

  it('renders notes, tomorrow, targets and the web after the glance, in that order', () => {
    const md = buildNightlyPrompt(withAll());
    const data = md.split('\n---\n')[1]!;
    const order = ['## Today at a glance', "## Today's notes", "## Tomorrow's timetable", '## Targets and intake', '## Mind web', '# State of Me'].map((h) => data.indexOf(h));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(data).toContain("## Today's notes\n- 13:05 rant: The group project is a mess.\n  Nobody replied.\n- 16:40 life: Coffee with Riya after Maths.");
    expect(data).toContain("## Tomorrow's timetable, Monday, 19 October\n- 09:00-10:00 Maths (B-204)\n- 11:00-11:15 Break\nRoutine windows: Run 06:00-07:00");
    expect(data).toContain('- Calories: 380 kcal, target 2,200 kcal, short by 1,820 kcal (numbers for 1 of 2 meals)');
    expect(data).toContain('- Protein: 12 g, target 140 g, short by 128 g');
    expect(data).toContain('- Water: 2.5 L, target 3 L, short by 0.5 L');
    expect(data).toContain('- Sleep: 6.5 h, target 7.5 h, short by 1 h');
    expect(data).toContain('- Screen time: 2:10, target at most 2:00, over by 0:10');
    expect(data).toContain('- Riya (person, importance 4, 1 mention, last 2026-10-18): Summary 1.');
    expect(data).toContain('  - 2026-10-18: Studies Maths with you');
    expect(data).toContain('Links:\n- Riya -> Sub-4 marathon: runs with');
  });

  it('says so when there are no notes, classes, targets or web', () => {
    const md = buildNightlyPrompt(input({ tomorrow: { date: '2026-10-19', slots: [{ start: '11:00', end: '11:15', title: 'Break', kind: 'break' }], routineWindows: [] } }));
    expect(md).toContain("## Today's notes\nNo notes today.");
    expect(md).toContain("## Tomorrow's timetable, Monday, 19 October\nNo classes tomorrow.");
    expect(md).not.toContain('11:00-11:15 Break');
    expect(md).toContain('## Targets and intake\nNo targets set.\nMeals today: 2, no numbers yet.');
    expect(md).toContain('## Mind web\nNothing in the web yet.');
  });

  it('asks for the seventeen sections with their rules', () => {
    const head = buildNightlyPrompt(input()).split('\n---\n')[0]!;
    expect(head).toContain('Reply with these seventeen sections');
    const headers = [...head.matchAll(/^## ([A-Z_]+)$/gm)].map((m) => m[1]);
    expect(headers).toEqual(['BRIEF', 'AFFIRMATIONS', 'QUESTS', 'STATS', 'WARNINGS', 'INSIGHTS', 'LESSON', 'MEALS', 'SUMMARY', 'ROUTINE', 'RIGHT', 'BETTER', 'FOOD', 'RANT', 'PEOPLE', 'WEB', 'PLAN']);
    expect(head).toContain('- 06:30-07:00 | what to do | Pillar');
    expect(head).toContain('never on top of a class');
    expect(head).toContain('actually named in tonight');
    expect(head).toContain('Three to eight lines in all tonight');
    expect(head).toContain('- link: Label A -> Label B | relation | note');
  });

  it('halves the web excerpt before it touches the last 14 days', () => {
    const nodes = Array.from({ length: 25 }, (_, i) => node(i));
    const full = buildNightlyPrompt(input({ web: { nodes, edges: [] } }));
    const pad = Math.ceil((NIGHTLY_TOKEN_BUDGET - estimateTokens(full)) * 4) + 800;
    const md = buildNightlyPrompt(input({ web: { nodes, edges: [] }, tonight: { ...TONIGHT, log: { ...TONIGHT.log!, feltLine: 'f'.repeat(pad) } } }));
    expect(estimateTokens(md)).toBeLessThanOrEqual(NIGHTLY_TOKEN_BUDGET);
    expect(md).toContain('## Last 14 days, oldest first\nD17 line 17');
    expect((md.match(/^- Thread /gm) ?? []).length).toBeLessThan((full.match(/^- Thread /gm) ?? []).length);
  });
});

describe('buildDeepBlock', () => {
  it('is empty without content', () => {
    expect(buildDeepBlock({ olderDays: [] })).toBe('');
    expect(buildDeepBlock({ originSheetMd: 'x', olderDays: ['a', 'b'] })).toBe('## Origin Sheet\nx\n\n## Earlier days, oldest first (2)\na\nb');
  });
});
