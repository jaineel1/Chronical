import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { db } from '@/data/db';
import { dayLogRepo, gameRepo, profileRepo, resetAll } from '@/data/repo';
import { MorningScreen } from '@/features/morning/MorningScreen';
import { addDays, nowIso, todayKey } from '@/lib/dates';
import { applyNightStats } from '@/lib/game/apply';
import { pointsForLevel } from '@/lib/game/level';

function renderMorning() {
  return render(
    <ShellProvider>
      <MemoryRouter initialEntries={['/']}>
        <MorningScreen />
      </MemoryRouter>
    </ShellProvider>,
  );
}

describe('Morning reward moments', () => {
  beforeEach(async () => {
    localStorage.clear();
    await resetAll();
    await profileRepo.ensure('Asha');
    await profileRepo.update({ onboardedAt: nowIso() });
    const below8 = pointsForLevel(8) - 1;
    for (const s of await db.subStatState.toArray()) await gameRepo.setSubStatPoints(s.pillar, s.name, s.pillar === 'BODY' ? below8 : 10);
    const date = addDays(todayKey(), -1);
    await dayLogRepo.update(date, { briefMd: 'Day 2. You ran 5 km.', stats: [{ target: 'Body', delta: 2 }, { target: 'Mind', delta: -1 }] });
    await applyNightStats(date);
  });

  it('fills the moved bars and shows the level-up once per night on this device', async () => {
    const first = renderMorning();
    expect(await screen.findByText('Body reached level 8')).toBeInTheDocument();
    expect(screen.getByTestId('pillar-BODY').querySelector('.rw-fill')).not.toBeNull();
    expect(screen.getByTestId('pillar-MIND').querySelector('.rw-fill')).not.toBeNull();
    expect(screen.getByTestId('pillar-SKIN').querySelector('.rw-fill')).toBeNull();
    expect(screen.getByTestId('pillar-MIND')).toHaveTextContent('-1');
    expect(screen.getByTestId('pillar-MIND').querySelector('.text-red')).not.toBeNull();
    expect(screen.queryByText(/^Mind reached level/)).not.toBeInTheDocument();
    first.unmount();

    renderMorning();
    expect(await screen.findByTestId('pillar-BODY')).toHaveTextContent('+2');
    expect(screen.queryByText('Body reached level 8')).not.toBeInTheDocument();
    expect(screen.getByTestId('pillar-BODY').querySelector('.rw-fill')).toBeNull();
  });
});
