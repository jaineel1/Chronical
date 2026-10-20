import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { db } from '@/data/db';
import { dayLogRepo, foodRepo, mealRepo, noteRepo, profileRepo, resetAll } from '@/data/repo';
import { addDays, todayKey } from '@/lib/dates';
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

// Dexie's live queries resolve outside act(); see the routine editor test.
const g = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
let previousActEnvironment: boolean | undefined;
beforeAll(() => {
  previousActEnvironment = g.IS_REACT_ACT_ENVIRONMENT;
  g.IS_REACT_ACT_ENVIRONMENT = false;
});
afterAll(() => {
  g.IS_REACT_ACT_ENVIRONMENT = previousActEnvironment;
});

const DATE = '2026-03-10';

describe('day editor', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
  });

  it('saves a number and a note edit on blur, and says Saved', async () => {
    await dayLogRepo.update(DATE, { weightKg: 70 });
    const note = await noteRepo.add(DATE, 'rant', 'old words');
    renderAt(`/edit/day/${DATE}`);

    const weight = await screen.findByLabelText('Weight, kg');
    expect(weight).toHaveValue('70');
    fireEvent.focus(weight);
    fireEvent.change(weight, { target: { value: '71.4' } });
    fireEvent.blur(weight);
    await waitFor(async () => expect((await dayLogRepo.get(DATE))?.weightKg).toBe(71.4));
    expect(await screen.findByText('Saved')).toBeInTheDocument();

    const text = await screen.findByLabelText(/^Rant note 1/);
    fireEvent.focus(text);
    fireEvent.change(text, { target: { value: 'new words' } });
    fireEvent.blur(text);
    await waitFor(async () => expect((await db.notes.get(note.id))?.text).toBe('new words'));
  });

  it('does not save a number it cannot read', async () => {
    await dayLogRepo.update(DATE, { weightKg: 70 });
    renderAt(`/edit/day/${DATE}`);
    const weight = await screen.findByLabelText('Weight, kg');
    fireEvent.focus(weight);
    fireEvent.change(weight, { target: { value: 'heavy' } });
    fireEvent.blur(weight);
    expect(await screen.findByText('A weight in kg, like 72.4.')).toBeInTheDocument();
    expect((await dayLogRepo.get(DATE))?.weightKg).toBe(70);
  });

  it('adds and removes a meal', async () => {
    renderAt(`/edit/day/${DATE}`);
    fireEvent.change(await screen.findByLabelText('New meal name'), { target: { value: 'Dal rice' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add the meal' }));
    await waitFor(async () => expect(await mealRepo.forDate(DATE)).toHaveLength(1));
    expect((await foodRepo.list()).map((f) => f.name)).toEqual(['Dal rice']);

    fireEvent.click(await screen.findByRole('button', { name: 'Remove meal 1' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Remove' }));
    await waitFor(async () => expect(await mealRepo.forDate(DATE)).toHaveLength(0));
  });

  it('renames a meal and changes its slot', async () => {
    const food = await foodRepo.ensure('Toast');
    const meal = await mealRepo.add(DATE, food.id, 'breakfast');
    renderAt(`/edit/day/${DATE}`);
    const name = await screen.findByLabelText('Name of meal 1');
    fireEvent.focus(name);
    fireEvent.change(name, { target: { value: 'Eggs' } });
    fireEvent.blur(name);
    fireEvent.change(screen.getByLabelText('Slot of meal 1'), { target: { value: 'dinner' } });
    await waitFor(async () => {
      const row = await db.meals.get(meal.id);
      expect(row?.slot).toBe('dinner');
      expect((await db.foods.get(row?.foodId ?? ''))?.name).toBe('Eggs');
    });
  });
});

describe('day list', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
  });

  it('lists the last 60 days, newest first, with their facts', async () => {
    const today = todayKey();
    const yesterday = addDays(today, -1);
    await dayLogRepo.update(yesterday, { weightKg: 72.4, sleepHours: 6.5 });
    await noteRepo.add(yesterday, 'life', 'hello');
    renderAt('/edit/days');

    const rows = await screen.findAllByRole('link', { name: /^Edit \d{4}-/ });
    expect(rows).toHaveLength(60);
    expect(rows[0]).toHaveAttribute('href', `/edit/day/${today}`);
    const row = screen.getByRole('link', { name: `Edit ${yesterday}` });
    expect(row).toHaveTextContent('72.4 kg, 6.5 h sleep, 1 note');
    expect(row).toHaveAttribute('href', `/edit/day/${yesterday}`);
  });

  it('is reachable from the edit index', async () => {
    renderAt('/edit');
    expect(await screen.findByRole('link', { name: /Past days/ })).toHaveAttribute('href', '/edit/days');
  });
});
