import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { db } from '@/data/db';
import { MemoryRouter } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { dayLogRepo, profileRepo, resetAll } from '@/data/repo';
import { nowIso, todayKey } from '@/lib/dates';
import { CampfireScreen, countLogged } from './CampfireScreen';
import { fireScale, progressLine } from './FireScene';
import { inferSlot } from './MealsSection';
import { parseScreenTime } from './NumbersSection';

function renderAt(path: string) {
  return render(
    <ShellProvider>
      <MemoryRouter initialEntries={[path]}>
        <CampfireScreen />
      </MemoryRouter>
    </ShellProvider>,
  );
}

describe('CampfireScreen', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Asha');
    await profileRepo.update({ onboardedAt: nowIso() });
  });

  it('invites the first routine when there are none, and still offers the rest of the log', async () => {
    renderAt('/campfire');
    expect(await screen.findByText('Add your first routine. The night log starts there.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a routine' })).toHaveAttribute('href', '/edit/routines/new');
    expect(screen.getByText("Tonight's numbers")).toBeInTheDocument();
    expect(await screen.findByTestId('copy-prompt')).toHaveTextContent("Send tonight's log");
    expect(screen.getByText(/For Haiku\. About/)).toBeInTheDocument();
  });

  it('folds the log away when tonight already has a letter', async () => {
    await dayLogRepo.update(todayKey(), { briefMd: 'Day 1. A letter.' });
    renderAt('/campfire');
    expect(await screen.findByText("Tonight's letter is in.")).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit the log' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Read it' })).toHaveAttribute('href', '/');
    expect(screen.queryByText("Tonight's numbers")).not.toBeInTheDocument();
  });

  it('opens the weekly review from the query string and saves a pasted review', async () => {
    renderAt('/campfire?view=weekly');
    expect(await screen.findByTestId('copy-prompt')).toHaveTextContent('Copy the weekly review');
    expect(screen.getByText(/For Sonnet\. About/)).toBeInTheDocument();
    const reply = [
      '## DIGEST',
      'Five of seven nights logged. Sleep averaged 6.8 h.',
      '## STATE_OF_ME',
      '# State of Me',
      'Asha, week two.',
      '## Where I am',
      '- Steady.',
      '## QUESTS',
      '- [Body] Three runs | reward: the 10 km stays easy',
      '## WARNINGS',
      '- Two short nights.',
      '## INSIGHTS',
      '- Logged nights were better nights.',
    ].join('\n');
    fireEvent.change(screen.getByTestId('reply-text'), { target: { value: reply } });
    fireEvent.click(screen.getByTestId('use-reply'));
    expect(await screen.findByText('Week saved. Your State of Me is up to date.')).toBeInTheDocument();
    expect(await screen.findByText('Last weekly digest')).toBeInTheDocument();
    expect((await profileRepo.get())?.stateOfMeMd).toContain('Asha, week two.');
    const prompt = (await db.prompts.toArray())[0];
    expect(prompt).toMatchObject({ kind: 'weekly', model: 'Sonnet', parsedOk: true });
    expect((await dayLogRepo.get(todayKey()))?.quests.map((q) => q.text)).toEqual(['Three runs']);
  });

  it('keeps a reply without a letter as a draft and says why', async () => {
    renderAt('/campfire');
    fireEvent.change(await screen.findByTestId('reply-text'), { target: { value: 'Great day, keep going.' } });
    fireEvent.click(screen.getByTestId('use-reply'));
    expect(await screen.findByText('No ## BRIEF section. The reply was kept as a draft.', {}, { timeout: 4000 })).toBeInTheDocument();
    expect((await dayLogRepo.get(todayKey()))?.rawDraft).toBe('Great day, keep going.');
  }, 10_000);
});

describe('Campfire helpers', () => {
  it('counts what is logged and grows the fire', () => {
    expect(countLogged([], null, 0)).toEqual({ logged: 0, total: 7 });
    expect(fireScale(0, 11)).toBe(3);
    expect(fireScale(7, 11)).toBe(4);
    expect(fireScale(10, 11)).toBe(5);
    expect(progressLine(7, 11)).toBe('7 of 11 logged. The fire grows.');
    expect(progressLine(11, 11)).toBe('11 of 11 logged. The fire is high.');
  });

  it('reads screen time the ways people type it', () => {
    expect(parseScreenTime('2:10')).toBe(130);
    expect(parseScreenTime('2h10')).toBe(130);
    expect(parseScreenTime('2h')).toBe(120);
    expect(parseScreenTime('95')).toBe(95);
    expect(parseScreenTime('95m')).toBe(95);
    expect(parseScreenTime('')).toBeUndefined();
    expect(parseScreenTime('lots')).toBeNull();
  });

  it('guesses the meal slot from how many came before', () => {
    expect([0, 1, 2, 3, 7].map(inferSlot)).toEqual(['breakfast', 'lunch', 'dinner', 'snack', 'snack']);
  });
});
