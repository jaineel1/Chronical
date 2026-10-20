import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { useProfile } from '@/data/hooks';
import { dayLogRepo } from '@/data/repo';
import type { DayLog } from '@/data/types';
import { QUESTION_BANK } from '@/features/campfire/questions';
import { daysBetween, DEFAULT_ROLLOVER_HOUR, formatLongDate, todayKey } from '@/lib/dates';
import { formatScreen } from '@/lib/prompt/dayLog';
import { Check, Section, SectionHeader } from '@/ui/primitives';
import { Missing } from '../lib/Missing';
import { ErrorText, Select, TextLink } from '../lib/ui';
import { DayMeals } from './DayMeals';
import { DayNotes } from './DayNotes';
import { Group, NumberField, RatingField, SaveProvider, TextField, type RunSave } from './fields';
import { isDayKey, readDecimal, readInteger, readScreenTime } from './parse';
import { useDayBundle } from './queries';

export function DayEditor() {
  const { date } = useParams();
  if (!isDayKey(date)) return <Missing what="day" back="/edit/days" />;
  return <DayEditorView key={date} date={date} />;
}

function DayEditorView({ date }: { date: string }) {
  const profile = useProfile();
  const bundle = useDayBundle(date);

  let night: number | null = null;
  if (profile?.startedAt) {
    const start = todayKey(profile.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR, new Date(profile.startedAt));
    const n = daysBetween(start, date) + 1;
    if (n >= 1) night = n;
  }
  useShellBar('Edit day', `${night ? `Night ${night}, ` : ''}${formatLongDate(date)}`);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const run: RunSave = useCallback(async (save) => {
    try {
      await save();
      setError(null);
      setSaved(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setSaved(false), 2000);
    } catch (e) {
      setSaved(false);
      setError(e instanceof Error ? e.message : 'That did not save.');
    }
  }, []);

  if (!bundle) return <Page>{null}</Page>;
  const { log, books } = bundle;
  const save = (changes: Partial<DayLog>) => dayLogRepo.update(date, changes);

  return (
    <Page>
      <SaveProvider value={run}>
        <div className="flex items-center justify-between gap-3 px-2.5 pb-2">
          <TextLink to="/edit/days">All past days</TextLink>
          <span role="status" aria-live="polite" className="text-mid">
            {saved ? 'Saved' : ''}
          </span>
        </div>
        {error ? (
          <div role="alert" className="px-2.5 pb-2">
            <ErrorText>{error}</ErrorText>
          </div>
        ) : null}
        <p className="m-0 px-2.5 pb-3 text-mid">Letter, quests and stats come from the reply; re-paste it at the Campfire to change them.</p>

        <SectionHeader title="The numbers" note="saves when you leave a box" />
        <Section className="gap-4">
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Weight, kg" value={log?.weightKg} read={readDecimal} min={20} max={300} hint="A weight in kg, like 72.4." onSave={(v) => save({ weightKg: v })} />
            <NumberField label="Sleep, hours" value={log?.sleepHours} read={readDecimal} min={0} max={24} hint="Hours of sleep, like 6.5." onSave={(v) => save({ sleepHours: v })} />
            <NumberField label="Mood, 1 to 5" value={log?.mood} read={readInteger} min={1} max={5} inputMode="numeric" hint="A mood from 1 to 5." onSave={(v) => save({ mood: v })} />
            <NumberField
              label="Screen, h:mm"
              value={log?.screenMin}
              read={readScreenTime}
              min={0}
              max={1440}
              inputMode="text"
              format={formatScreen}
              hint="Screen time as h:mm, like 2:10."
              onSave={(v) => save({ screenMin: v })}
            />
          </div>
          <RatingField label="Energy" value={log?.energy} onSave={(v) => save({ energy: v })} />
          <div className="grid grid-cols-2 gap-4">
            <NumberField label="Urges resisted" value={log?.urgesResisted ?? 0} read={readInteger} inputMode="numeric" hint="A whole number." onSave={(v) => save({ urgesResisted: v ?? 0 })} />
            <NumberField label="Scroll sessions" value={log?.scrollSessions ?? 0} read={readInteger} inputMode="numeric" hint="A whole number." onSave={(v) => save({ scrollSessions: v ?? 0 })} />
          </div>
          <label className="flex cursor-pointer items-center gap-3">
            <Check checked={!!log?.phoneFreeEvening} onChange={(e) => void run(() => save({ phoneFreeEvening: e.target.checked }))} />
            <span>Phone-free evening</span>
          </label>
        </Section>

        <SectionHeader title="More of the day" note="fill what you know" />
        <Section className="gap-5">
          <Group title="Body">
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Water, L" value={log?.waterL} read={readDecimal} hint="Litres, like 2.5." onSave={(v) => save({ waterL: v })} />
              <NumberField label="Steps" value={log?.steps} read={readInteger} inputMode="numeric" hint="A whole number." onSave={(v) => save({ steps: v })} />
              <TextField label="Workout type" value={log?.workoutType ?? ''} placeholder="Gym, run, yoga" onSave={(v) => save({ workoutType: v || undefined })} />
              <NumberField label="Workout, min" value={log?.workoutMin} read={readInteger} inputMode="numeric" hint="Minutes, a whole number." onSave={(v) => save({ workoutMin: v })} />
            </div>
          </Group>
          <Group title="Intake">
            <div className="grid grid-cols-2 gap-4">
              <NumberField label="Caffeine, cups" value={log?.caffeineCups} read={readInteger} inputMode="numeric" hint="A whole number." onSave={(v) => save({ caffeineCups: v || undefined })} />
              <NumberField label="Alcohol, drinks" value={log?.alcoholDrinks} read={readInteger} inputMode="numeric" hint="A whole number." onSave={(v) => save({ alcoholDrinks: v || undefined })} />
            </div>
          </Group>
          <Group title="Work">
            <NumberField label="Deep work, hours" value={log?.deepWorkHours} read={readDecimal} hint="Hours, like 2.5." onSave={(v) => save({ deepWorkHours: v })} />
            <TextField label="Top win" value={log?.topWin ?? ''} placeholder="The one thing you got done" onSave={(v) => save({ topWin: v || undefined })} />
          </Group>
          <Group title="Mind">
            <RatingField label="Stress" value={log?.stress} onSave={(v) => save({ stress: v })} />
            <TextField label="Grateful for" value={log?.gratitude ?? ''} placeholder="One thing you are grateful for" onSave={(v) => save({ gratitude: v || undefined })} />
          </Group>
        </Section>

        <SectionHeader title="In your words" />
        <Section className="gap-4">
          <TextField label="Felt line" value={log?.feltLine ?? ''} placeholder="One line on how the day felt" onSave={(v) => save({ feltLine: v || undefined })} />
          <label className="flex flex-col gap-1">
            <span className="text-mid">Lesson from a book</span>
            <Select
              value={log?.lessonBookId ?? ''}
              onChange={(e) => {
                const id = e.target.value;
                void run(() => save({ lessonBookId: id || undefined }));
              }}
            >
              <option value="">No book</option>
              {log?.lessonBookId && !books.some((b) => b.id === log.lessonBookId) ? <option value={log.lessonBookId}>A book that was removed</option> : null}
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </Select>
          </label>
          <TextField label="Lesson applied" value={log?.lessonApplied ?? ''} placeholder="What you did with it" onSave={(v) => save({ lessonApplied: v || undefined })} />
        </Section>

        <Answers date={date} answers={log?.answers} />

        <DayMeals date={date} meals={bundle.meals} />
        <DayNotes notes={bundle.notes} />
      </SaveProvider>
    </Page>
  );
}

function Answers({ date, answers }: { date: string; answers: Record<string, string> | undefined }) {
  // Keep a box on screen after it is emptied (which deletes its key), so it can be filled again.
  const seen = useRef(new Set<string>());
  for (const k of Object.keys(answers ?? {})) seen.current.add(k);
  const keys = [...seen.current];
  if (!keys.length) return null;
  return (
    <>
      <SectionHeader title="The night's questions" />
      <Section className="gap-4">
        {keys.map((key) => (
          <TextField
            key={key}
            label={QUESTION_BANK.find((q) => q.id === key)?.text ?? key}
            value={answers?.[key] ?? ''}
            onSave={async (v) => {
              const next = { ...((await dayLogRepo.get(date))?.answers ?? {}) };
              if (v) next[key] = v;
              else delete next[key];
              await dayLogRepo.update(date, { answers: next });
            }}
          />
        ))}
      </Section>
    </>
  );
}
