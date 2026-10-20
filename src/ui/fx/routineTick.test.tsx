import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { stamp } from '@/data/repo';
import type { Routine, RoutineLog } from '@/data/types';
import { RoutinesSection } from '@/features/campfire/RoutinesSection';

const DATE = '2026-10-20';
const run = stamp<Routine>({
  id: 'run',
  name: 'Morning run',
  pillar: 'BODY',
  subStat: 'Endurance',
  weight: 2,
  days: [],
  upside: 'keeps the plan on track',
  cost: 'a slower half',
  streak: 0,
  shields: 1,
  archived: false,
  sortOrder: 0,
});
const log = (date: string, done: boolean) => stamp<RoutineLog>({ id: `l-${date}`, routineId: 'run', date, done, shielded: false });

function view(logs: RoutineLog[]) {
  const today = logs.find((l) => l.date === DATE);
  return (
    <MemoryRouter>
      <RoutinesSection date={DATE} routines={[{ routine: run, log: today, scheduledToday: true }]} logs={logs} closed={false} notes={[]} />
    </MemoryRouter>
  );
}

describe('RoutinesSection reward ticks', () => {
  it('pops the weight and rolls the streak when the saved log turns done', () => {
    const before = [log('2026-10-19', true)];
    const { rerender } = render(view(before));
    expect(screen.queryByTestId('tick-pop')).not.toBeInTheDocument();
    expect(screen.getByText('1 day')).not.toHaveClass('rw-tick');

    rerender(view([...before, log(DATE, true)]));
    expect(screen.getByTestId('tick-pop')).toHaveTextContent('+2');
    expect(screen.getByText('2 days')).toHaveClass('rw-tick');
    expect(screen.getByRole('checkbox', { name: 'Morning run' }).className).toMatch(/rw-pulse-/);

    rerender(view([...before, log(DATE, false)]));
    expect(screen.queryByTestId('tick-pop')).not.toBeInTheDocument();
  });
});
