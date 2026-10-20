import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { db } from '@/data/db';
import { profileRepo, resetAll, routineLogRepo, routineRepo, stamp } from '@/data/repo';
import type { Digest } from '@/data/types';
import { addDays, todayKey } from '@/lib/dates';
import { BossCard } from './BossCard';
import { BOSS_DEFEATED_MAP, BOSS_MAP } from './bossSprites';

describe('BossCard', () => {
  let routineId = '';
  const today = todayKey();

  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Asha');
    const r = await routineRepo.create({
      name: 'Phone-free evening',
      pillar: 'DOPAMINE',
      subStat: 'Restraint',
      weight: 3,
      days: [],
      upside: '',
      cost: '',
      streak: 0,
      shields: 1,
      archived: false,
      sortOrder: 0,
    });
    routineId = r.id;
  });

  async function seedBoss(hp: number) {
    await db.digests.put(
      stamp<Digest>({
        kind: 'weekly',
        periodStart: addDays(today, -7),
        periodEnd: addDays(today, -1),
        md: 'A week.',
        boss: {
          name: 'The Late-Night Scroll',
          pillar: 'DOPAMINE',
          hp,
          weakTo: [{ name: 'Phone-free evening', routineId }, { name: 'Cold shower' }],
          reward: 'a new paperback.',
          taunt: 'One more video.',
          start: today,
          end: addDays(today, 6),
        },
      }),
    );
  }

  it('renders nothing without a boss', async () => {
    const { container } = render(<BossCard />);
    await waitFor(() => expect(db.isOpen()).toBe(true));
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the boss and drops its HP live when a weak-to routine is ticked, then shows it defeated', async () => {
    await seedBoss(5);
    render(<BossCard />);
    expect(await screen.findByText('The Late-Night Scroll')).toBeInTheDocument();
    expect(screen.getByText('One more video.')).toBeInTheDocument();
    expect(screen.getByTestId('boss-hp')).toHaveTextContent('5 of 5');
    expect(screen.getByText('7 days left')).toBeInTheDocument();
    expect(screen.getByText('not one of your routines')).toBeInTheDocument();
    expect(screen.getByText('Reward: a new paperback.')).toBeInTheDocument();

    await routineLogRepo.set(routineId, today, true);
    await waitFor(() => expect(screen.getByTestId('boss-hp')).toHaveTextContent('2 of 5'));
    expect(screen.getByText('3 a hit, 3 dealt')).toBeInTheDocument();

    await routineLogRepo.set(routineId, addDays(today, 1), true);
    await waitFor(() => expect(screen.getByTestId('boss-hp')).toHaveTextContent('0 of 5'));
    expect(screen.getByTestId('boss-defeated')).toHaveTextContent('Defeated. Claim it: a new paperback.');
    expect(screen.getByRole('img', { name: 'The Late-Night Scroll, defeated' })).toBeInTheDocument();
  });

  it('draws sprites with rows of equal length', () => {
    for (const map of [BOSS_MAP, BOSS_DEFEATED_MAP]) {
      expect(new Set(map.map((r) => r.length))).toEqual(new Set([16]));
    }
  });
});
