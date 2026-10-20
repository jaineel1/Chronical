import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { useDayLog, useProfile, useRoutinesForDate, type RoutineWithLog } from '@/data/hooks';
import { dayLogRepo } from '@/data/repo';
import type { Book, DayLog, Profile } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, addDays, todayKey, weekdayOf } from '@/lib/dates';
import { clockTime, dayNoFor } from '@/lib/game/calendar';
import { planClose, summariseNightWarnings } from '@/lib/game/streaks';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import { PromptHandoff } from '@/ui/PromptHandoff';
import { ExtrasSection } from './ExtrasSection';
import { Section, SectionHeader } from '@/ui/primitives';
import { FireScene } from './FireScene';
import { IntakeSection } from './IntakeSection';
import { LifeFeed } from './LifeFeed';
import { MealsSection } from './MealsSection';
import { acceptReply, sendNight, type SendContext } from './nightFlow';
import { NumbersSection } from './NumbersSection';
import { LineInput, TextButton, TextLink, useNow } from './parts';
import { useFoods, useKnownNouns, useMeals, useNightlyPrompt, useReadingBooks, useRoutineLogs } from './queries';
import { questionsFor } from './questions';
import { RantSection } from './RantSection';
import { ReviewPanel } from './ReviewPanel';
import { RoutinesSection } from './RoutinesSection';

/** /campfire: tonight's log, the hand-off to Claude, and the weekly and monthly reviews (?view=weekly|monthly). */
export function CampfireScreen() {
  const profile = useProfile();
  const now = useNow();
  const [params, setParams] = useSearchParams();
  const view = params.get('view');
  const review = view === 'weekly' || view === 'monthly' ? view : null;
  const rollover = profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
  const date = todayKey(rollover, now);
  const night = profile ? dayNoFor(profile.startedAt, date, rollover) : undefined;
  const title = review === 'weekly' ? 'Weekly review' : review === 'monthly' ? 'Monthly digest' : 'Campfire';
  useShellBar(title, night !== undefined ? `Night ${night}, ${clockTime(now)}` : undefined);

  if (!profile || night === undefined) return <Page>{null}</Page>;
  // Keyed so a new night (4 AM rollover) or a different review starts with fresh state.
  if (review) return <ReviewPanel key={`${review}-${date}`} kind={review} date={date} onBack={() => setParams({})} />;
  return <NightLog key={date} date={date} night={night} profile={profile} onReview={(kind) => setParams({ view: kind })} />;
}

/** Items the fire counts: each scheduled routine, the four numbers, a meal, the felt line, the lesson. */
export function countLogged(scheduled: RoutineWithLog[], log: DayLog | null, meals: number): { logged: number; total: number } {
  const items = [
    ...scheduled.map((r) => !!r.log?.done),
    typeof log?.weightKg === 'number',
    typeof log?.sleepHours === 'number',
    typeof log?.mood === 'number',
    typeof log?.screenMin === 'number',
    meals > 0,
    !!log?.feltLine?.trim(),
    !!log?.lessonApplied?.trim(),
  ];
  return { logged: items.filter(Boolean).length, total: items.length };
}

function NightLog({ date, night, profile, onReview }: { date: string; night: number; profile: Profile; onReview: (kind: 'weekly' | 'monthly') => void }) {
  const log = useDayLog(date);
  const yesterday = useDayLog(addDays(date, -1));
  const routines = useRoutinesForDate(date);
  const logs = useRoutineLogs();
  const meals = useMeals(date);
  const foods = useFoods();
  const books = useReadingBooks();
  const promptMd = useNightlyPrompt(date);
  const nouns = useKnownNouns();
  // Open the form unless the letter is already in when the screen opens; a paste made here keeps it open.
  const [editing, setEditing] = useState<boolean | null>(null);
  const [sendError, setSendError] = useState<string>();
  useEffect(() => {
    if (editing === null && log !== undefined) setEditing(!log?.briefMd);
  }, [editing, log]);

  const closed = !!log?.closedAt;
  const notes = useMemo(() => {
    if (!closed || !routines || !logs) return [];
    const plan = planClose(
      routines.map((r) => r.routine),
      logs,
      date,
      profile.settings.rolloverHour,
    );
    return summariseNightWarnings(plan.warnings);
  }, [closed, routines, logs, date, profile.settings.rolloverHour]);

  if (log === undefined || yesterday === undefined || !routines || !logs || !meals || !foods || !books || editing === null) return <Page>{null}</Page>;

  const scheduled = routines.filter((r) => r.scheduledToday);
  const { logged, total } = countLogged(scheduled, log, meals.length);
  const deep = profile.settings.deepMode;
  const ctx: SendContext = { promptMd: promptMd ?? '', model: deep ? MODEL_LABEL.deep : MODEL_LABEL.nightly, kind: deep ? 'deep' : 'nightly' };

  return (
    <Page>
      <FireScene logged={logged} total={total} />
      {log?.briefMd ? <LetterIn editing={editing} summary={log.summaryMd} rantReply={editing ? undefined : log.rantReplyMd} onEdit={() => setEditing(true)} /> : null}
      {editing ? (
        <>
          <RoutinesSection date={date} routines={routines} logs={logs} closed={closed} notes={notes} />
          <NumbersSection date={date} log={log} yesterday={yesterday} />
          <MealsSection date={date} meals={meals} foods={foods} />
          <IntakeSection log={log} meals={meals} targets={profile.settings.targets} />
          <ExtrasSection date={date} log={log} meals={meals} />
          <Section>
            <LessonField date={date} log={log} books={books} />
            <div className="flex flex-col gap-1">
              <label htmlFor="felt-line" className="text-mid">
                How did today feel
              </label>
              <LineInput id="felt-line" value={log?.feltLine ?? ''} placeholder="One line" onSave={(v) => dayLogRepo.update(date, { feltLine: v || undefined })} />
            </div>
          </Section>
          <Questions date={date} night={night} log={log} />
          <RantSection date={date} log={log} />
          <LifeFeed date={date} />
          {promptMd !== undefined ? (
            <PromptHandoff
              promptMd={promptMd}
              model={ctx.model}
              copyLabel="Send tonight's log"
              onCopied={async () => {
                setSendError(undefined);
                try {
                  await sendNight(date, ctx);
                } catch (e) {
                  setSendError(e instanceof Error ? e.message : 'unknown error');
                }
              }}
              onReply={(md) => acceptReply(date, md, { ...ctx, knownNouns: nouns ?? [] })}
              initialReply={log?.rawDraft ?? ''}
              pastePlaceholder="Paste Claude's reply here."
            >
              {sendError ? <span className="text-red">The night could not be closed ({sendError}). Copy it again to retry.</span> : null}
            </PromptHandoff>
          ) : null}
        </>
      ) : null}
      <ReviewLinks date={date} onReview={onReview} />
    </Page>
  );
}

function LetterIn({ editing, summary, rantReply, onEdit }: { editing: boolean; summary?: string; rantReply?: string; onEdit: () => void }) {
  return (
    <div className="flex flex-col gap-1 px-2.5 pb-1" data-testid="letter-in">
      <span>Tonight's letter is in.</span>
      {rantReply ? (
        <p className="m-0 text-mid">
          <span className="text-ink">On your rant: </span>
          {rantReply}
        </p>
      ) : null}
      {summary ? (
        <p className="m-0 text-mid" data-testid="night-summary">
          {summary}
        </p>
      ) : null}
      <span className="flex gap-6">
        <TextLink to="/">Read it</TextLink>
        {!editing ? <TextButton onClick={onEdit}>Edit the log</TextButton> : null}
      </span>
    </div>
  );
}

function LessonField({ date, log, books }: { date: string; log: DayLog | null; books: Book[] }) {
  const chosen = books.find((b) => b.id === log?.lessonBookId) ?? books[0];
  return (
    <div className="flex flex-col gap-1">
      <div className="text-mid">
        <label htmlFor="lesson-line">One lesson you used today</label>
        {books.length === 1 ? `, from ${books[0]!.title}` : null}
        {books.length > 1 ? (
          <>
            {', from '}
            <select
              aria-label="Book"
              className="cursor-pointer border-0 border-b border-faint bg-transparent p-0 text-mid outline-none focus:border-ink"
              value={chosen?.id}
              onChange={(e) => void dayLogRepo.update(date, { lessonBookId: e.target.value })}
            >
              {books.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.title}
                </option>
              ))}
            </select>
          </>
        ) : null}
      </div>
      <LineInput
        id="lesson-line"
        value={log?.lessonApplied ?? ''}
        placeholder="Write a line"
        onSave={(v) => dayLogRepo.update(date, { lessonApplied: v || undefined, lessonBookId: v ? chosen?.id : log?.lessonBookId })}
      />
    </div>
  );
}

function Questions({ date, night, log }: { date: string; night: number; log: DayLog | null }) {
  const questions = questionsFor(night);
  return (
    <>
      <SectionHeader title="Three questions" note="answer any" />
      <Section>
        {questions.map((q) => (
          <div key={q.id} className="flex flex-col gap-1">
            <label htmlFor={`q-${q.id}`} className="text-mid">
              {q.text}
            </label>
            <LineInput
              id={`q-${q.id}`}
              value={log?.answers?.[q.id] ?? ''}
              placeholder="A line is enough"
              onSave={async (v) => {
                const current = (await dayLogRepo.get(date))?.answers ?? {};
                const answers = { ...current };
                if (v) answers[q.id] = v;
                else delete answers[q.id];
                await dayLogRepo.update(date, { answers });
              }}
            />
          </div>
        ))}
      </Section>
    </>
  );
}

function ReviewLinks({ date, onReview }: { date: string; onReview: (kind: 'weekly' | 'monthly') => void }) {
  const isSunday = weekdayOf(date) === 0;
  const monthDue = Number(date.slice(8, 10)) <= 3;
  return (
    <div className="flex flex-col gap-1.5 border-t border-faint px-2.5 pt-2.5" data-testid="review-links">
      <div className="flex items-baseline justify-between gap-3">
        <TextButton onClick={() => onReview('weekly')}>Weekly review</TextButton>
        <span className="text-mid">{isSunday ? 'tonight' : 'Sundays'}</span>
      </div>
      <div className="flex items-baseline justify-between gap-3">
        <TextButton onClick={() => onReview('monthly')}>Monthly digest</TextButton>
        <span className="text-mid">{monthDue ? 'due now' : '1st to 3rd'}</span>
      </div>
    </div>
  );
}
