import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { foodRepo } from '@/data/repo';
import type { Food, Nutrition } from '@/data/types';
import { readNumber } from '@/features/campfire/ExtrasSection';
import { Empty, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { ButtonLink } from '@/features/campfire/parts';
import { plural } from './format';
import { VaultPage } from './VaultPage';

const FIELDS: { key: keyof Nutrition; label: string; integer?: boolean }[] = [
  { key: 'grams', label: 'g' },
  { key: 'kcal', label: 'kcal', integer: true },
  { key: 'proteinG', label: 'P' },
  { key: 'carbsG', label: 'C' },
  { key: 'fatG', label: 'F' },
];

function useFoods(): Food[] | undefined {
  return useLiveQuery(() => db.foods.orderBy('name').toArray(), []);
}

function Cell({ food, field }: { food: Food; field: (typeof FIELDS)[number] }) {
  const value = food.nutrition?.[field.key];
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    const v = readNumber(text, { integer: field.integer });
    if (v === null) {
      setBad(true);
      return;
    }
    setBad(false);
    if (v === value) return;
    const next: Nutrition = { ...food.nutrition, [field.key]: v };
    if (v === undefined) delete next[field.key];
    void foodRepo.setNutrition(food.id, Object.keys(next).length ? next : undefined, 'you');
  };
  return (
    <label className="flex min-w-0 flex-col">
      <span className="text-mid">{field.label}</span>
      <TextInput
        className={bad ? 'text-red' : ''}
        value={text}
        placeholder="--"
        inputMode={field.integer ? 'numeric' : 'decimal'}
        aria-label={`${food.name}, ${field.label}`}
        aria-invalid={bad}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

function NameField({ food }: { food: Food }) {
  const [name, setName] = useState(food.name);
  const [error, setError] = useState<string>();
  useEffect(() => setName(food.name), [food.name]);
  const commit = async () => {
    if (name.trim() === food.name) return;
    try {
      await foodRepo.rename(food.id, name);
      setError(undefined);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setName(food.name);
    }
  };
  return (
    <div className="flex flex-col">
      <TextInput className="font-serif" value={name} aria-label="Meal name" onChange={(e) => setName(e.target.value)} onBlur={() => void commit()} />
      {error ? <span className="text-red">{error}</span> : null}
    </div>
  );
}

/** /vault/meals: every saved meal with its usual portion. Numbers typed here are never replaced by Claude's. */
export function MealsLibraryScreen() {
  const foods = useFoods();
  const withNumbers = foods?.filter((f) => typeof f.nutrition?.kcal === 'number').length ?? 0;
  return (
    <VaultPage title="Meals" meta={foods ? plural(foods.length, 'saved meal') : undefined}>
      <SectionHeader title="Saved meals" note={foods?.length ? `${withNumbers} with calories` : undefined} />
      <Section className="gap-0">
        {foods === undefined ? null : foods.length === 0 ? (
          <Empty action={<ButtonLink to="/campfire">Open tonight's log</ButtonLink>}>Log a meal tonight and it is saved here, with its numbers after Opus replies.</Empty>
        ) : (
          foods.map((f) => (
            <div key={f.id} className="flex flex-col gap-1.5 border-b border-faint py-2.5 last:border-b-0" data-testid="saved-meal">
              <div className="flex items-baseline justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <NameField food={f} />
                </div>
                <span className="shrink-0 text-mid">{f.nutritionFrom === 'you' ? 'yours' : f.nutritionFrom === 'claude' ? 'from Opus' : 'no numbers yet'}</span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {FIELDS.map((field) => (
                  <Cell key={field.key} food={f} field={field} />
                ))}
              </div>
            </div>
          ))
        )}
      </Section>
    </VaultPage>
  );
}
