import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { dayLogRepo, resetAll } from '@/data/repo';
import { addDays } from '@/lib/dates';
import { Achievements } from './Achievements';
import { BADGE_LOCKED_PALETTE, BADGE_MAPS, BADGE_PALETTE } from './badgeSprites';

const SHOWN_KEY = 'chronicle.badges.shown';

describe('badge sprites', () => {
  it('are 12×12 and use only palette letters', () => {
    for (const [name, map] of Object.entries(BADGE_MAPS)) {
      expect(map.length, name).toBe(12);
      for (const row of map) {
        expect(row.length, name).toBe(12);
        for (const ch of row) if (ch !== '.') expect(Object.keys(BADGE_PALETTE), `${name} ${ch}`).toContain(ch);
      }
    }
    expect(Object.keys(BADGE_LOCKED_PALETTE).sort()).toEqual(Object.keys(BADGE_PALETTE).sort());
  });
});

describe('Achievements', () => {
  beforeEach(async () => {
    await resetAll();
    window.localStorage.clear();
  });

  it('shows locked progress on an empty world and plays nothing', async () => {
    const { container } = render(<Achievements />);
    expect(await screen.findByText('0 of 14')).toBeInTheDocument();
    expect(screen.getByLabelText(/^Seven nights, locked, 0 of 7 nights/)).toBeInTheDocument();
    expect(container.querySelector('.badge-reveal')).toBeNull();
  });

  it('reveals a newly earned badge once, with its date, and remembers it', async () => {
    await dayLogRepo.update('2026-09-03', { briefMd: 'Dear you' });
    const first = render(<Achievements />);
    const cell = await screen.findByLabelText(/^First letter, earned 3 Sep/);
    expect(within(cell).getByText('3 Sep')).toBeInTheDocument();
    await waitFor(() => expect(cell.querySelector('.badge-reveal')).not.toBeNull());
    expect(JSON.parse(window.localStorage.getItem(SHOWN_KEY) ?? '[]')).toEqual(['letter-1']);
    first.unmount();

    render(<Achievements />);
    const again = await screen.findByLabelText(/^First letter, earned/);
    // Give the effect a chance to run, so a wrong replay would show up.
    await new Promise((r) => setTimeout(r, 50));
    expect(again.querySelector('.badge-reveal')).toBeNull();
  });

  it('renders fine when stored ids are garbage', async () => {
    window.localStorage.setItem(SHOWN_KEY, '{not json');
    for (let i = 0; i < 7; i++) await dayLogRepo.update(addDays('2026-09-01', i), { closedAt: '2026-09-10T22:00:00.000Z' });
    render(<Achievements />);
    expect(await screen.findByLabelText(/^Seven nights, earned 7 Sep/)).toBeInTheDocument();
  });
});
