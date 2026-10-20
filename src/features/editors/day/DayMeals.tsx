import { useState, type FormEvent } from 'react';
import { foodRepo, MEAL_SLOTS, mealRepo } from '@/data/repo';
import type { MealSlot, Nutrition } from '@/data/types';
import { Button, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { mealEditRepo } from '../lib/repos';
import { ChipChoice, ChoiceGroup, ConfirmAction, ErrorText, Select } from '../lib/ui';
import { NumberField, TextField, useRunSave } from './fields';
import { readDecimal } from './parse';
import type { DayMeal } from './queries';

export function DayMeals({ date, meals }: { date: string; meals: DayMeal[] }) {
  return (
    <>
      <SectionHeader title="Meals" note={meals.length ? `${meals.length} logged` : 'none logged'} />
      <Section className="gap-5">
        {meals.length ? (
          <ul className="m-0 flex list-none flex-col gap-5 p-0">
            {meals.map((m, i) => (
              <MealRow key={m.meal.id} item={m} n={i + 1} />
            ))}
          </ul>
        ) : null}
        <AddMeal date={date} />
      </Section>
    </>
  );
}

function MealRow({ item, n }: { item: DayMeal; n: number }) {
  const run = useRunSave();
  const { meal, name } = item;
  const setPortion = (changes: Pick<Nutrition, 'grams' | 'kcal'>) => {
    const next: Nutrition = { ...meal.nutrition, ...changes };
    for (const k of Object.keys(next) as (keyof Nutrition)[]) if (next[k] === undefined) delete next[k];
    return mealRepo.setNutrition(meal.id, Object.keys(next).length ? next : undefined, 'you');
  };
  return (
    <li className="flex flex-col gap-3 border-t border-faint pt-4 first:border-t-0 first:pt-0" aria-label={`Meal ${n}`}>
      <div className="grid grid-cols-[8rem_1fr] gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-mid">Slot of meal {n}</span>
          <Select value={meal.slot} onChange={(e) => void run(() => mealEditRepo.update(meal.id, { slot: e.target.value as MealSlot }))}>
            {MEAL_SLOTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </label>
        <TextField
          label={`Name of meal ${n}`}
          value={name}
          onSave={async (v) => {
            if (!v) throw new Error('A meal needs a name. Remove it instead.');
            const food = await foodRepo.ensure(v);
            await mealEditRepo.update(meal.id, { foodId: food.id });
          }}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <NumberField label={`Grams of meal ${n}`} value={meal.nutrition?.grams} read={readDecimal} hint="Grams, like 250." onSave={(v) => setPortion({ grams: v })} />
        <NumberField label={`Kcal of meal ${n}`} value={meal.nutrition?.kcal} read={readDecimal} hint="Calories, like 540." onSave={(v) => setPortion({ kcal: v })} />
      </div>
      <ConfirmAction label={`Remove meal ${n}`} question={`Remove ${name || 'this meal'} from this day?`} confirmLabel="Remove" onConfirm={() => run(() => mealRepo.remove(meal.id))} />
    </li>
  );
}

function AddMeal({ date }: { date: string }) {
  const run = useRunSave();
  const [slot, setSlot] = useState<MealSlot>('lunch');
  const [name, setName] = useState('');
  const [grams, setGrams] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    const clean = name.trim();
    if (!clean) {
      setError('Name the meal.');
      return;
    }
    const g = readDecimal(grams);
    if (g === null) {
      setError('Grams, like 250.');
      return;
    }
    setError(null);
    await run(async () => {
      const food = await foodRepo.ensure(clean);
      await mealRepo.addFood(date, food, slot, g);
    });
    setName('');
    setGrams('');
  }

  return (
    <form onSubmit={add} aria-label="Add a meal" className="flex flex-col gap-3 border border-dashed border-faint p-3">
      <ChoiceGroup label="Add a meal">
        <ChipChoice options={MEAL_SLOTS} value={slot} onChange={setSlot} />
      </ChoiceGroup>
      <div className="grid grid-cols-[1fr_6rem] gap-4">
        <label className="flex flex-col gap-1">
          <span className="text-mid">New meal name</span>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Dal, rice and curd" autoComplete="off" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-mid">Grams, optional</span>
          <TextInput value={grams} onChange={(e) => setGrams(e.target.value)} inputMode="decimal" />
        </label>
      </div>
      {error ? <ErrorText>{error}</ErrorText> : null}
      <Button type="submit" variant="outline" className="self-start">
        Add the meal
      </Button>
    </form>
  );
}
