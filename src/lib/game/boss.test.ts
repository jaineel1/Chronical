import { describe, expect, it } from 'vitest';
import type { WeeklyBoss } from './boss';
import { activeBoss, bossState, bossWeek, daysLeft, fullWeekDamage, matchWeakTo, scheduledDays } from './boss';
import { makeLog, makeRoutine } from './testkit';

// 2026-10-19 is a Monday; the review for 12 to 18 October sets a boss for 19 to 25 October.
const week = bossWeek('2026-10-18');

const scroll = makeRoutine({ id: 'phone', name: 'Phone-free evening', weight: 3, days: [] });
const walk = makeRoutine({ id: 'walk', name: 'Evening walk', weight: 2, days: [1, 3, 5] });
const gym = makeRoutine({ id: 'gym', name: 'Gym', weight: 4 });

const boss: WeeklyBoss = {
  name: 'The Late-Night Scroll',
  pillar: 'DOPAMINE',
  hp: 19,
  weakTo: [{ name: 'Phone-free evening', routineId: 'phone' }, { name: 'evening walk' }],
  reward: 'A paperback',
  taunt: 'One more video.',
  ...week,
};

describe('boss week and full-week damage', () => {
  it('runs the seven days after the period', () => {
    expect(week).toEqual({ start: '2026-10-19', end: '2026-10-25' });
  });

  it('counts scheduled days; no days means every day', () => {
    expect(scheduledDays(scroll, week.start, week.end)).toBe(7);
    expect(scheduledDays(walk, week.start, week.end)).toBe(3);
    expect(fullWeekDamage(scroll, week.start, week.end)).toBe(21);
    expect(fullWeekDamage(walk, week.start, week.end)).toBe(6);
  });
});

describe('matchWeakTo', () => {
  it('matches names ignoring case and punctuation, and keeps unknown names without an id', () => {
    expect(matchWeakTo(['phone free evening', 'Evening Walk', 'Cold shower'], [scroll, walk, gym])).toEqual([
      { name: 'phone free evening', routineId: 'phone' },
      { name: 'Evening Walk', routineId: 'walk' },
      { name: 'Cold shower' },
    ]);
  });
});

describe('bossState', () => {
  it('deals each weak-to routine its weight per day done inside the week', () => {
    const logs = [
      makeLog('phone', '2026-10-18', true), // the day before: does not count
      makeLog('phone', '2026-10-19', true),
      makeLog('phone', '2026-10-20', true),
      makeLog('phone', '2026-10-21', false),
      makeLog('walk', '2026-10-19', true),
      makeLog('gym', '2026-10-19', true), // not weak-to
      makeLog('walk', '2026-10-26', true), // after the week
    ];
    const s = bossState(boss, [scroll, walk, gym], logs);
    expect(s.dealt).toBe(3 + 3 + 2);
    expect(s.remaining).toBe(11);
    expect(s.defeated).toBe(false);
    expect(s.hits).toEqual([
      { name: 'Phone-free evening', routineId: 'phone', weight: 3, times: 2, damage: 6 },
      { name: 'Evening walk', routineId: 'walk', weight: 2, times: 1, damage: 2 },
    ]);
  });

  it('is defeated at 0 HP and never goes below it', () => {
    const logs = ['19', '20', '21', '22', '23', '24', '25'].map((d) => makeLog('phone', `2026-10-${d}`, true));
    const s = bossState(boss, [scroll, walk], logs);
    expect(s.dealt).toBe(21);
    expect(s.remaining).toBe(0);
    expect(s.defeated).toBe(true);
  });

  it('gives no damage for a name that matches no routine or repeats one', () => {
    const s = bossState(
      { ...boss, weakTo: [{ name: 'Cold shower' }, { name: 'Phone-free evening' }, { name: 'PHONE-FREE EVENING' }] },
      [scroll],
      [makeLog('phone', '2026-10-19', true)],
    );
    expect(s.hits.map((h) => h.damage)).toEqual([0, 3, 0]);
    expect(s.hits[0]?.weight).toBe(0);
  });
});

describe('activeBoss and daysLeft', () => {
  const digests = [
    { kind: 'weekly' as const, periodEnd: '2026-10-11', boss: { ...boss, name: 'Old', ...bossWeek('2026-10-11') } },
    { kind: 'weekly' as const, periodEnd: '2026-10-18', boss },
    { kind: 'monthly' as const, periodEnd: '2026-10-18', boss: { ...boss, name: 'Monthly' } },
    { kind: 'weekly' as const, periodEnd: '2026-10-04' },
  ];

  it('shows the newest boss from its review day to the end of its week', () => {
    expect(activeBoss(digests, '2026-10-17')?.name).toBe('Old');
    expect(activeBoss(digests, '2026-10-18')?.name).toBe('The Late-Night Scroll');
    expect(activeBoss(digests, '2026-10-25')?.name).toBe('The Late-Night Scroll');
    expect(activeBoss(digests, '2026-10-26')).toBeUndefined();
    expect(activeBoss([], '2026-10-20')).toBeUndefined();
  });

  it('counts days left including today', () => {
    expect(daysLeft(boss, '2026-10-18')).toBe(0);
    expect(daysLeft(boss, '2026-10-19')).toBe(7);
    expect(daysLeft(boss, '2026-10-25')).toBe(1);
  });
});
