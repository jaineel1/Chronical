import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { db } from '@/data/db';
import { profileRepo, resetAll } from '@/data/repo';
import { EditorsRoutes } from '../EditorsRoutes';

function renderAt(path: string) {
  return render(
    <ShellProvider>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/edit/*" element={<EditorsRoutes />} />
        </Routes>
      </MemoryRouter>
    </ShellProvider>,
  );
}

// Dexie's live queries resolve outside act(); Testing Library still wraps every render and event in
// act() and restores this flag afterwards, so only those async updates stop warning.
const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;
beforeAll(() => {
  previousActEnvironment = g.IS_REACT_ACT_ENVIRONMENT;
  g.IS_REACT_ACT_ENVIRONMENT = false;
});
afterAll(() => {
  g.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

describe('routine editor', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
  });

  it('asks for name, pillar, sub-stat, upside and cost before it saves', async () => {
    renderAt('/edit/routines/new');
    const save = await screen.findByRole('button', { name: 'Save' });

    fireEvent.click(save);
    expect(await screen.findByText('Still missing: name, pillar, upside, cost.')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Name/), { target: { value: 'Stretch, ten minutes' } });
    fireEvent.click(screen.getByRole('button', { name: 'Body' }));
    expect(await screen.findByText('Still missing: sub-stat, upside, cost.')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Recovery' }));
    fireEvent.change(screen.getByLabelText(/^Upside/), { target: { value: 'Legs stay loose' } });
    fireEvent.change(screen.getByLabelText(/^Cost of a miss/), { target: { value: 'A minute lost on Sunday' } });
    fireEvent.change(screen.getByLabelText(/^Time window/), { target: { value: 'evening' } });
    fireEvent.click(save);
    expect(await screen.findByText('Use HH:MM-HH:MM, like 06:00-07:30.')).toBeInTheDocument();
    expect(await db.routines.count()).toBe(0);

    fireEvent.change(screen.getByLabelText(/^Time window/), { target: { value: '21:30 - 21:40' } });
    fireEvent.click(screen.getByRole('button', { name: 'Mon' }));
    fireEvent.click(save);

    await waitFor(async () => expect(await db.routines.count()).toBe(1));
    const [routine] = await db.routines.toArray();
    expect(routine).toMatchObject({
      name: 'Stretch, ten minutes',
      pillar: 'BODY',
      subStat: 'Recovery',
      weight: 2,
      days: [1],
      window: '21:30-21:40',
      upside: 'Legs stay loose',
      cost: 'A minute lost on Sunday',
      streak: 0,
      shields: 1,
      archived: false,
      sortOrder: 0,
    });
    // Back on the list, with the new routine in it.
    expect(await screen.findByRole('link', { name: 'Stretch, ten minutes' })).toBeInTheDocument();
  });

  it('clears the sub-stat when the pillar changes', async () => {
    renderAt('/edit/routines/new?pillar=SKIN');
    fireEvent.click(await screen.findByRole('button', { name: 'Protection' }));
    fireEvent.click(screen.getByRole('button', { name: 'Mind' }));
    expect(screen.queryByRole('button', { name: 'Protection' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Calm' })).toBeInTheDocument();
  });
});
