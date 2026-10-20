import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { resetAll, timetableRepo } from '@/data/repo';
import { NowStrip } from './NowStrip';

function renderStrip() {
  return render(
    <MemoryRouter>
      <NowStrip />
    </MemoryRouter>,
  );
}

describe('NowStrip', () => {
  beforeEach(async () => {
    await resetAll();
    // Only the clock and the interval are faked, so IndexedDB and promises keep running for real.
    vi.useFakeTimers({ toFake: ['Date', 'setInterval', 'clearInterval'] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows the class that covers the fake time, and what is next', async () => {
    // Monday 19 October 2026, 14:30.
    vi.setSystemTime(new Date(2026, 9, 19, 14, 30));
    await timetableRepo.add({ day: 1, start: '14:10', end: '15:05', title: 'Compiler Design', kind: 'class', room: 'F1-302' });
    await timetableRepo.add({ day: 1, start: '15:10', end: '16:05', title: 'Operating System', kind: 'class', room: 'F-504' });

    renderStrip();

    expect(await screen.findByText('Now: Compiler Design, F1-302, until 15:05', {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByText('Next: Operating System, F-504, 15:10')).toBeInTheDocument();
    expect(screen.getByTestId('now-clock')).toHaveTextContent('14:30');
    expect(screen.getByRole('link', { name: 'See the day' })).toHaveAttribute('href', '/now');
  }, 10_000);

  it('invites a timetable when nothing is scheduled', async () => {
    vi.setSystemTime(new Date(2026, 9, 19, 14, 30));
    renderStrip();
    expect(await screen.findByText(/Nothing scheduled\./, {}, { timeout: 4000 })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Add a timetable' })).toHaveAttribute('href', '/vault/timetable');
    expect(screen.getByTestId('now-clock')).toHaveTextContent('14:30');
  }, 10_000);
});
