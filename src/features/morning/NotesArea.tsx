import { Fragment, useMemo } from 'react';
import { Link } from 'react-router';
import { dayLogRepo } from '@/data/repo';
import type { DayLog, Routine, RoutineLog } from '@/data/types';
import { weekdayOf } from '@/lib/dates';
import { isShieldNote } from '@/lib/game/streaks';
import { sumNutrition } from '@/lib/nutrition';
import { useMeals } from '@/features/campfire/queries';
import { SHIELD_MAP } from '@/features/map/mapSprites';
import { PixelSprite } from '@/ui/PixelSprite';
import { NumberTile, SectionHeader, Section } from '@/ui/primitives';
import { BOOK_MAP, MID_PALETTE, PAPER } from '@/ui/sprites';
import { dayTiles } from './dayTiles';
import { EditableSection } from './edit/EditableSection';
import { LineListEditor } from './edit/LineListEditor';
import { ProseEditor } from './edit/ProseEditor';
import { shieldNames, splitByNames, type NameTarget } from './linkNames';
import { BANG_MAP, EYE_MAP } from './notesSprites';

const RED_PALETTE = { x: PAPER.red } as const;
const SHIELD_PALETTE = { o: PAPER.mid, x: PAPER.faint } as const;

/** A line of text where the player's own routines, goals, skills, people and books link to their editors. */
function LinkedText({ text, targets }: { text: string; targets: readonly NameTarget[] }) {
  const parts = useMemo(() => splitByNames(text, targets), [text, targets]);
  return (
    <>
      {parts.map((p, i) =>
        p.to ? (
          <Link key={i} to={p.to} className="text-walnut no-underline">
            {p.text}
          </Link>
        ) : (
          <Fragment key={i}>{p.text}</Fragment>
        ),
      )}
    </>
  );
}

/** Rows with a small pixel marker on the left and hairlines between them. */
function MarkedRows({ rows, marker }: { rows: { key: string; body: React.ReactNode; aside?: React.ReactNode }[]; marker: React.ReactNode }) {
  return (
    <ul className="m-0 flex list-none flex-col p-0">
      {rows.map((r, i) => (
        <li key={r.key} className={`flex items-start gap-3 py-1.5 ${i > 0 ? 'border-t border-faint' : ''}`}>
          <span className="mt-[5px] flex w-[14px] shrink-0 justify-center">{marker}</span>
          <span className="min-w-0 flex-1 break-words">{r.body}</span>
          {r.aside ? <span className="shrink-0 text-mid">{r.aside}</span> : null}
        </li>
      ))}
    </ul>
  );
}

function DayNumbers({ source, routines, logs, desktop }: { source: DayLog; routines: Routine[]; logs: RoutineLog[]; desktop: boolean }) {
  const meals = useMeals(source.date);
  if (!meals) return null;
  const weekday = weekdayOf(source.date);
  const scheduled = routines.filter((r) => r.days.length === 0 || r.days.includes(weekday)).length;
  const done = logs.filter((l) => l.date === source.date && l.done).length;
  const { total } = sumNutrition(meals.map((m) => m.meal.nutrition));
  const tiles = dayTiles(source, { done, scheduled, closed: !!source.closedAt }, total);
  if (!tiles.length && !source.summaryMd) return null;
  return (
    <EditableSection
      title="The day in numbers"
      label="the day in numbers"
      testId="day-numbers"
      edit={(close) => (
        <ProseEditor
          label="The day in numbers"
          initial={source.summaryMd ?? ''}
          rows={4}
          onSave={async (summaryMd) => {
            await dayLogRepo.update(source.date, { summaryMd: summaryMd || undefined });
            close();
          }}
          onCancel={close}
        />
      )}
    >
      {tiles.length ? (
        <div className={`grid gap-x-4 gap-y-3.5 ${desktop ? 'grid-cols-3' : 'grid-cols-2'}`}>
          {tiles.map((t) => (
            <NumberTile key={t.label} label={t.label} value={t.value} unit={t.unit} />
          ))}
        </div>
      ) : null}
      {source.summaryMd ? (
        <p className={`m-0 text-mid ${tiles.length ? 'border-t border-faint pt-2' : ''}`} data-testid="morning-summary">
          {source.summaryMd}
        </p>
      ) : null}
    </EditableSection>
  );
}

function WatchOut({ source, warnings, targets }: { source: DayLog; warnings: string[]; targets: readonly NameTarget[] }) {
  const alerts = warnings.filter((w) => !isShieldNote(w));
  const shieldNotes = warnings.filter(isShieldNote);
  const names = shieldNames(shieldNotes);
  const shieldRows = names.length ? names : shieldNotes;
  return (
    <>
      {alerts.length || source.warnings.length ? (
        <EditableSection
          title="Watch out"
          note={`${alerts.length} ${alerts.length === 1 ? 'warning' : 'warnings'}`}
          label="the warnings"
          testId="warnings"
          edit={(close) => (
            <LineListEditor
              label="Warning"
              initial={source.warnings}
              onSave={async (lines) => {
                await dayLogRepo.update(source.date, { warnings: lines });
                close();
              }}
              onCancel={close}
            />
          )}
        >
          <MarkedRows
            marker={<PixelSprite map={BANG_MAP} palette={RED_PALETTE} scale={2} />}
            rows={alerts.map((w) => ({ key: w, body: <LinkedText text={w} targets={targets} /> }))}
          />
        </EditableSection>
      ) : null}
      {shieldRows.length ? (
        <div className="flex flex-col gap-1.5" data-testid="shields">
          <SectionHeader title="Shields" note="none left this week" />
          <Section>
            <MarkedRows
              marker={<PixelSprite map={SHIELD_MAP} palette={SHIELD_PALETTE} scale={2} />}
              rows={shieldRows.map((n) => ({ key: n, body: names.length ? <LinkedText text={n} targets={targets} /> : n, aside: names.length ? 'used this week' : undefined }))}
            />
          </Section>
        </div>
      ) : null}
    </>
  );
}

function Patterns({ source, targets }: { source: DayLog; targets: readonly NameTarget[] }) {
  if (!source.insights.length) return null;
  return (
    <EditableSection
      title="Patterns"
      label="the patterns"
      testId="patterns"
      edit={(close) => (
        <LineListEditor
          label="Pattern"
          initial={source.insights}
          onSave={async (lines) => {
            await dayLogRepo.update(source.date, { insights: lines });
            close();
          }}
          onCancel={close}
        />
      )}
    >
      <MarkedRows
        marker={<PixelSprite map={EYE_MAP} palette={MID_PALETTE} scale={2} />}
        rows={source.insights.map((t, i) => ({ key: `${i}-${t}`, body: <LinkedText text={t} targets={targets} /> }))}
      />
    </EditableSection>
  );
}

function Lesson({ source }: { source: DayLog }) {
  const lesson = source.lessonMd?.trim();
  if (!lesson) return null;
  return (
    <EditableSection
      title="Lesson"
      label="the lesson"
      testId="lesson"
      edit={(close) => (
        <ProseEditor
          label="Lesson"
          initial={lesson}
          rows={3}
          onSave={async (lessonMd) => {
            await dayLogRepo.update(source.date, { lessonMd: lessonMd || undefined });
            close();
          }}
          onCancel={close}
        />
      )}
    >
      <MarkedRows marker={<PixelSprite map={BOOK_MAP} palette={MID_PALETTE} scale={2} />} rows={[{ key: 'lesson', body: lesson }]} />
    </EditableSection>
  );
}

/** The notes under the letter: the day in numbers, warnings, shields, patterns and the lesson. */
export function NotesArea({
  source,
  warnings,
  routines,
  logs,
  targets,
  desktop = false,
}: {
  source: DayLog | null;
  warnings: string[];
  routines: Routine[];
  logs: RoutineLog[];
  targets: readonly NameTarget[];
  desktop?: boolean;
}) {
  if (!source) return null;
  return (
    <div className="flex flex-col gap-3.5" data-testid="notes">
      <DayNumbers source={source} routines={routines} logs={logs} desktop={desktop} />
      <WatchOut source={source} warnings={warnings} targets={targets} />
      <Patterns source={source} targets={targets} />
      <Lesson source={source} />
    </div>
  );
}

const EDIT_LINKS = [
  ['Routines', '/edit/routines'],
  ['Goals', '/edit/goals'],
  ['Skills', '/edit/skills'],
  ['People', '/edit/people'],
  ['Books', '/edit/books'],
  ['Past days', '/edit/days'],
] as const;

/** The quiet last row of Morning: every editor for the player's own things. */
export function EditLinksRow() {
  return (
    <nav aria-label="Editors" className="flex flex-wrap items-baseline gap-x-2 gap-y-1 px-2.5 text-mid" data-testid="edit-links">
      <span>Edit:</span>
      {EDIT_LINKS.map(([label, to], i) => (
        <Fragment key={to}>
          {i > 0 ? <span aria-hidden="true">·</span> : null}
          <Link to={to} className="text-walnut no-underline">
            {label}
          </Link>
        </Fragment>
      ))}
    </nav>
  );
}
