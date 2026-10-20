import { useEffect, useState, type ReactNode } from 'react';
import { dayLogRepo } from '@/data/repo';
import type { DayLog } from '@/data/types';
import { sumNutrition } from '@/lib/nutrition';
import { Chip, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { Counter } from './NumbersSection';
import { LineInput } from './parts';
import type { MealView } from './queries';

/** "2.5" → 2.5, "" → undefined (clears), anything else → null (not saved). */
export function readNumber(text: string, opts: { integer?: boolean } = {}): number | undefined | null {
  const t = text.trim().replace(/,/g, opts.integer ? '' : '.');
  if (!t) return undefined;
  const ok = opts.integer ? /^\d+$/.test(t) : /^\d+(?:\.\d+)?$/.test(t);
  return ok ? Number(t) : null;
}

/** A small number box that saves when it loses focus. */
function NumberBox({ label, unit, value, integer, onSave }: { label: string; unit: string; value: number | undefined; integer?: boolean; onSave: (v: number | undefined) => unknown }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  const [bad, setBad] = useState(false);
  useEffect(() => setText(value === undefined ? '' : String(value)), [value]);
  const commit = () => {
    const v = readNumber(text, { integer });
    if (v === null) {
      setBad(true);
      return;
    }
    setBad(false);
    if (v !== value) void onSave(v);
  };
  return (
    <label className="flex items-baseline justify-between gap-3">
      <span>{label}</span>
      <span className="flex items-baseline gap-1.5">
        <TextInput
          className={`w-20 text-right ${bad ? 'text-red' : ''}`}
          inputMode={integer ? 'numeric' : 'decimal'}
          value={text}
          placeholder="--"
          aria-invalid={bad}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span className="w-10 text-mid">{unit}</span>
      </span>
    </label>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-mid">{title}</span>
      {children}
    </div>
  );
}

/** The points beyond the four numbers: body, intake, work and mind. All optional. */
export function ExtrasSection({ date, log, meals }: { date: string; log: DayLog | null; meals: MealView[] }) {
  const save = (changes: Partial<DayLog>) => dayLogRepo.update(date, changes);
  const { total, counted } = sumNutrition(meals.map((m) => m.meal.nutrition));
  const stress = log?.stress;
  return (
    <>
      <SectionHeader title="More of today" note="fill what you know" />
      <Section className="gap-4">
        <Group title="Body">
          <NumberBox label="Water" unit="L" value={log?.waterL} onSave={(v) => save({ waterL: v })} />
          <NumberBox label="Steps" unit="" integer value={log?.steps} onSave={(v) => save({ steps: v })} />
          <div className="flex items-baseline justify-between gap-3">
            <span className="shrink-0">Workout</span>
            <span className="flex min-w-0 items-baseline gap-1.5">
              <span className="min-w-0 flex-1">
                <LineInput id="workout-type" label="Workout type" value={log?.workoutType ?? ''} placeholder="Gym, run, yoga" onSave={(v) => save({ workoutType: v || undefined })} />
              </span>
            </span>
          </div>
          <NumberBox label="Duration" unit="min" integer value={log?.workoutMin} onSave={(v) => save({ workoutMin: v })} />
        </Group>

        <Group title="Intake">
          <Counter label="Caffeine, cups" value={log?.caffeineCups ?? 0} onChange={(v) => save({ caffeineCups: v || undefined })} />
          <Counter label="Alcohol, drinks" value={log?.alcoholDrinks ?? 0} onChange={(v) => save({ alcoholDrinks: v || undefined })} />
          <div className="flex items-baseline justify-between gap-3">
            <span>Protein</span>
            <span className="text-mid" data-testid="protein-total">
              {typeof total.proteinG === 'number' ? `${Math.round(total.proteinG)} g from ${counted} of ${meals.length} meals` : 'from your meals, once they have numbers'}
            </span>
          </div>
        </Group>

        <Group title="Work">
          <NumberBox label="Deep work" unit="h" value={log?.deepWorkHours} onSave={(v) => save({ deepWorkHours: v })} />
          <LineInput id="top-win" label="Top win" value={log?.topWin ?? ''} placeholder="The one thing you got done" onSave={(v) => save({ topWin: v || undefined })} />
        </Group>

        <Group title="Mind">
          <div className="flex items-center justify-between gap-3">
            <span>Stress</span>
            <span role="group" aria-label="Stress, 1 to 5" className="flex gap-1.5">
              {[1, 2, 3, 4, 5].map((n) => (
                <Chip key={n} active={stress === n} onClick={() => void save({ stress: stress === n ? undefined : n })}>
                  {n}
                </Chip>
              ))}
            </span>
          </div>
          <LineInput id="gratitude" label="Grateful for" value={log?.gratitude ?? ''} placeholder="One thing you are grateful for" onSave={(v) => save({ gratitude: v || undefined })} />
        </Group>
      </Section>
    </>
  );
}
