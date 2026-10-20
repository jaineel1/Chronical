import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { dayLogRepo, resetAll, timetableRepo } from '@/data/repo';
import { TimetableScreen } from '@/features/vault/TimetableScreen';
import { NowScreen } from './NowScreen';

function renderScreen(ui: React.ReactElement) {
  return render(
    <ShellProvider>
      <MemoryRouter>{ui}</MemoryRouter>
    </ShellProvider>,
  );
}

describe('NowScreen', () => {
  beforeEach(async () => {
    await resetAll();
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
    vi.setSystemTime(new Date(2026, 9, 19, 10, 0));
  });
  afterEach(() => vi.useRealTimers());

  it('toggles a plan block done and writes it to the day log', async () => {
    await dayLogRepo.update('2026-10-19', { plan: [{ id: 'p1', start: '09:00', end: '10:30', text: 'Deep work', pillar: 'WORK' }] });
    renderScreen(<NowScreen />);
    const block = await screen.findByTestId('plan-block', {}, { timeout: 4000 });
    expect(block).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(block);
    await waitFor(async () => expect((await dayLogRepo.get('2026-10-19'))?.plan?.[0]?.done).toBe(true), { timeout: 4000 });
    await waitFor(() => expect(screen.getByTestId('plan-block')).toHaveAttribute('aria-pressed', 'true'));
  }, 10_000);

  it('moves to tomorrow and invites a timetable when there is none', async () => {
    renderScreen(<NowScreen />);
    expect(await screen.findByRole('link', { name: 'Add a timetable' }, { timeout: 4000 })).toHaveAttribute('href', '/vault/timetable');
    fireEvent.click(screen.getByRole('button', { name: 'Tomorrow' }));
    expect(screen.getByText('Tuesday, 20 October')).toBeInTheDocument();
  }, 10_000);
});

describe('TimetableScreen', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('adds a slot, edits it and deletes it', async () => {
    renderScreen(<TimetableScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a slot' }, { timeout: 4000 }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Networks' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save slot' }));
    await waitFor(async () => expect((await timetableRepo.list()).map((e) => e.title)).toEqual(['Networks']), { timeout: 4000 });

    fireEvent.click(await screen.findByRole('button', { name: /Monday, Networks, 09:00 to 09:55/ }));
    fireEvent.change(screen.getByLabelText('Room'), { target: { value: 'E203' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(async () => expect((await timetableRepo.list())[0]?.room).toBe('E203'), { timeout: 4000 });

    fireEvent.click(await screen.findByRole('button', { name: /Monday, Networks/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete slot' }));
    await waitFor(async () => expect(await timetableRepo.list()).toHaveLength(0), { timeout: 4000 });
  }, 15_000);

  it('rejects an end before the start', async () => {
    renderScreen(<TimetableScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Add a slot' }, { timeout: 4000 }));
    fireEvent.change(screen.getByLabelText('Title'), { target: { value: 'Backwards' } });
    fireEvent.change(screen.getByLabelText('End'), { target: { value: '08:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save slot' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('End has to be after the start.');
    expect(await timetableRepo.list()).toHaveLength(0);
  }, 10_000);

  it('asks before replacing the timetable with a preset', async () => {
    await timetableRepo.add({ day: 1, start: '09:00', end: '10:00', title: 'Mine', kind: 'class' });
    renderScreen(<TimetableScreen />);
    fireEvent.click(await screen.findByRole('button', { name: 'Load a preset' }, { timeout: 4000 }));
    expect(screen.getByText(/This replaces your 1 slot/)).toBeInTheDocument();
    expect(await timetableRepo.list()).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: 'Replace my timetable' }));
    await waitFor(async () => expect((await timetableRepo.list()).length).toBeGreaterThan(30), { timeout: 4000 });
    expect((await timetableRepo.list()).some((e) => e.title === 'Mine')).toBe(false);
  }, 10_000);
});
