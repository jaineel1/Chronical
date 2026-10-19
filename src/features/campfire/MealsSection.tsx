import { useMemo, useState } from 'react';
import { MEAL_SLOTS, foodRepo, mealRepo } from '@/data/repo';
import type { Food, MealSlot } from '@/data/types';
import { Button, Chip, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { TextButton } from './parts';
import type { MealView } from './queries';

const SLOT_LABEL: Record<MealSlot, string> = { breakfast: 'Breakfast', lunch: 'Lunch', dinner: 'Dinner', snack: 'Snack' };

/** The slot a new meal most likely belongs to: the first three meals of a day, then snacks. */
export function inferSlot(count: number): MealSlot {
  return MEAL_SLOTS[Math.min(count, 3)] ?? 'snack';
}

export function MealsSection({ date, meals, foods }: { date: string; meals: MealView[]; foods: Food[] }) {
  const [adding, setAdding] = useState(false);
  return (
    <>
      <SectionHeader title="Meals" note={meals.length ? `${meals.length} today` : 'none yet'} />
      <Section>
        <div className="flex flex-wrap gap-1.5" data-testid="meals">
          {meals.map(({ meal, name }) => (
            <button
              key={meal.id}
              type="button"
              title="Tap to remove"
              aria-label={`Remove ${name}`}
              onClick={() => void mealRepo.remove(meal.id)}
              className="cursor-pointer border border-faint bg-transparent px-[9px] py-[3px]"
            >
              {name}
            </button>
          ))}
          {!adding ? (
            <button type="button" onClick={() => setAdding(true)} className="cursor-pointer border border-walnut bg-transparent px-2.5 py-[3px] text-walnut">
              Add a meal
            </button>
          ) : null}
        </div>
        {adding ? <MealAdder date={date} count={meals.length} foods={foods} onClose={() => setAdding(false)} /> : null}
      </Section>
    </>
  );
}

function MealAdder({ date, count, foods, onClose }: { date: string; count: number; foods: Food[]; onClose: () => void }) {
  const [name, setName] = useState('');
  const [slot, setSlot] = useState<MealSlot>(() => inferSlot(count));
  const [chosenSlot, setChosenSlot] = useState(false);
  const effectiveSlot = chosenSlot ? slot : inferSlot(count);

  const suggestions = useMemo(() => {
    const q = name.trim().toLowerCase();
    const list = q ? foods.filter((f) => f.name.toLowerCase().includes(q)) : foods;
    return list.slice(0, 8);
  }, [foods, name]);

  async function add(foodName: string) {
    const clean = foodName.trim();
    if (!clean) return;
    const food = await foodRepo.ensure(clean);
    await mealRepo.add(date, food.id, effectiveSlot);
    setName('');
    setChosenSlot(false);
  }

  return (
    <div className="flex flex-col gap-2" data-testid="meal-adder">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <TextInput
            className="font-serif"
            value={name}
            placeholder="What did you eat?"
            aria-label="Meal"
            autoComplete="off"
            autoFocus
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void add(name);
              if (e.key === 'Escape') onClose();
            }}
          />
        </div>
        <Button variant="outline" disabled={!name.trim()} onClick={() => void add(name)}>
          Add
        </Button>
      </div>
      <div role="group" aria-label="Which meal" className="flex flex-wrap gap-1.5">
        {MEAL_SLOTS.map((s) => (
          <Chip
            key={s}
            active={effectiveSlot === s}
            onClick={() => {
              setSlot(s);
              setChosenSlot(true);
            }}
          >
            {SLOT_LABEL[s]}
          </Chip>
        ))}
      </div>
      {suggestions.length ? (
        <div className="flex flex-col gap-1">
          <span className="text-mid">{name.trim() ? 'Tap to add' : 'Eaten before'}</span>
          <div className="flex flex-wrap gap-1.5">
            {suggestions.map((f) => (
              <Chip key={f.id} onClick={() => void add(f.name)}>
                {f.name}
              </Chip>
            ))}
          </div>
        </div>
      ) : null}
      <TextButton className="self-start" onClick={onClose}>
        Done adding
      </TextButton>
    </div>
  );
}
