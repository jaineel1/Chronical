import { describe, expect, it } from 'vitest';
import { STATE_OF_ME_MD } from '@/data/seed';
import { buildMonthlyPrompt, buildWeeklyPrompt } from './weekly';
import { GAME_MASTER_PREAMBLE } from './shared';

const goals = [{ title: 'Invoicing module', pillar: 'WORK' as const, status: 'active' as const, milestones: [{ title: 'Send and track', current: 6, target: 10, unit: 'tasks', done: false }] }];

describe('buildWeeklyPrompt', () => {
  const md = buildWeeklyPrompt({
    periodStart: '2026-10-12',
    periodEnd: '2026-10-18',
    dayNoStart: 17,
    dayNoEnd: 23,
    displayName: 'Jaineel',
    stateOfMeMd: STATE_OF_ME_MD,
    goals,
    warnings: ['Gym streak at risk.', 'Gym streak at risk.', 'Mentor quiet for 21 days.'],
    days: ['## Tonight, Day 17\nfull detail 17', '## Tonight, Day 23\nfull detail 23'],
    excludeMoney: false,
  });

  it('asks for the five sections and the State of Me shape', () => {
    expect(md.startsWith(GAME_MASTER_PREAMBLE)).toBe(true);
    for (const h of ['## DIGEST', '## STATE_OF_ME', '## QUESTS', '## WARNINGS', '## INSIGHTS']) expect(md).toContain(`\n${h}\n`);
    expect(md).toContain('At most 150 words');
    expect(md).toContain('at most 400 words');
    for (const h of ['# State of Me', '## Where I am', '## Patterns the game master has noticed', '## People', '## Voice']) expect(md).toContain(h);
    expect(md).toContain('Exactly three quests for the coming week.');
  });

  it('carries the State of Me, goals, the week and its warnings once each', () => {
    const data = md.split('\n---\n')[1]!;
    expect(data).toContain('**Jaineel**, 20, Ahmedabad.');
    expect(data).toContain('- [Work] Invoicing module: Send and track (6 of 10 tasks)');
    expect(data.match(/Gym streak at risk\./g)).toHaveLength(1);
    expect(data).toContain('full detail 17');
    expect(data).toContain('full detail 23');
    expect(md).toContain('Days 17 to 23, Monday, 12 October to Sunday, 18 October');
  });
});

describe('buildWeeklyPrompt with a boss', () => {
  const base = {
    periodStart: '2026-10-12',
    periodEnd: '2026-10-18',
    dayNoStart: 17,
    dayNoEnd: 23,
    displayName: 'Jaineel',
    goals,
    warnings: [],
    days: ['## Tonight, Day 23\nfull detail 23'],
    excludeMoney: false,
  };
  const boss = {
    start: '2026-10-19',
    end: '2026-10-25',
    routines: [
      { name: 'Phone-free evening', pillar: 'DOPAMINE' as const, weight: 3, scheduledDays: 7 },
      { name: 'Evening walk', pillar: 'BODY' as const, weight: 2, scheduledDays: 1 },
    ],
    pillarLevels: [
      { pillar: 'BODY' as const, level: 7.4 },
      { pillar: 'DOPAMINE' as const, level: 3.1 },
    ],
  };

  it('asks for a ## BOSS with the HP rule and lists the routines with weights and full-week damage', () => {
    const md = buildWeeklyPrompt({ ...base, boss });
    const [instructions, data] = md.split('\n---\n') as [string, string];
    expect(instructions).toContain('Reply with these six sections');
    expect(instructions).toContain('set three quests and one boss for the coming week');
    for (const f of ['\n## BOSS\n', '\nName: ', '\nPillar: ', '\nHP: ', '\nWeak to: ', '\nReward: ', '\nTaunt: ']) expect(instructions).toContain(f);
    expect(instructions).toContain('their weakest pillar or a pattern from this week');
    expect(instructions).toContain('about 70% of the full-week damage');
    expect(data).toContain("## The boss's week, Monday, 19 October to Sunday, 25 October");
    expect(data).toContain('- Dopamine level 3.1 (weakest)\n- Body level 7.4');
    expect(data).toContain('- Phone-free evening (Dopamine): weight 3, scheduled 7 days, full-week damage 21');
    expect(data).toContain('- Evening walk (Body): weight 2, scheduled 1 day, full-week damage 2');
  });

  it('leaves the boss out without routines, as before', () => {
    for (const md of [buildWeeklyPrompt(base), buildWeeklyPrompt({ ...base, boss: { ...boss, routines: [] } })]) {
      expect(md).toContain('Reply with these five sections');
      expect(md).not.toContain('## BOSS');
      expect(md).not.toContain('Routines that can hit the boss');
    }
  });
});

describe('buildMonthlyPrompt', () => {
  it('uses the weekly digests and at most 30 compressed days', () => {
    const md = buildMonthlyPrompt({
      periodStart: '2026-09-01',
      periodEnd: '2026-09-30',
      monthLabel: 'September 2026',
      displayName: 'Jaineel',
      stateOfMeMd: undefined,
      goals,
      warnings: [],
      weeklyDigests: [{ label: '1 to 7 Sep', md: 'Week one.' }],
      days: Array.from({ length: 35 }, (_, i) => `D${i + 1} line`),
      excludeMoney: false,
    });
    expect(md).toContain('monthly digest for September 2026');
    expect(md).toContain('### 1 to 7 Sep\nWeek one.');
    expect(md).toContain('Exactly three quests for the coming month.');
    expect(md).toContain('D35 line');
    expect(md).not.toContain('D5 line\n');
    expect(md).toContain('Not written yet');
  });
});
