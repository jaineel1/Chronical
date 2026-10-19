import { useMemo, useState } from 'react';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { useDayLog, useLatestBrief, usePillars, useProfile } from '@/data/hooks';
import { PILLARS, PILLAR_LABEL, type DayLog, type Pillar, type PillarState, type Profile } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, addDays, formatLongDate, todayKey } from '@/lib/dates';
import { dayNoFor, mondayOf } from '@/lib/game/calendar';
import { pillarTotals } from '@/lib/game/daily';
import { displayLevel } from '@/lib/game/level';
import { isShieldNote, planClose, summariseNightWarnings } from '@/lib/game/streaks';
import { playerSummary, weekGrid, type PlayerSummary } from '@/lib/game/xp';
import { isPeriodQuest } from '@/lib/parse/weekly';
import { Empty, Section, SectionHeader, StatRow } from '@/ui/primitives';
import { ButtonLink, useIsDesktop, useNow } from '@/features/campfire/parts';
import { useKnownNouns, useRoutineLogs } from '@/features/campfire/queries';
import { AffirmationRow } from './AffirmationRow';
import { Letter } from './Letter';
import { firstSentences, lessonLine, lowerFirst, wordCount } from './letterText';
import { useActiveRoutines, useKeptAffirmations, usePeriodQuests, type PeriodQuests } from './queries';
import { QuestList } from './QuestList';
import { WeekGridSection } from './WeekGrid';
import { XpScene } from './XpScene';

/** `/`: the letter written last night, the pillars it moved, today's quests, and on desktop the week. */
export function MorningScreen() {
  const profile = useProfile();
  const now = useNow(60_000);
  const rollover = profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
  const today = todayKey(rollover, now);
  const pillars = usePillars();
  const summary = useMemo(() => (pillars ? playerSummary(pillars) : undefined), [pillars]);
  const dayNo = profile ? dayNoFor(profile.startedAt, today, rollover) : undefined;
  const meta = dayNo === undefined ? undefined : summary ? `Day ${dayNo}, level ${Math.floor(summary.level)}` : `Day ${dayNo}`;
  useShellBar(formatLongDate(today), meta);

  const source = useLatestBrief();
  const routines = useActiveRoutines();
  const logs = useRoutineLogs();
  const nouns = useKnownNouns();
  const kept = useKeptAffirmations(source?.date);
  const period = usePeriodQuests(today);
  const tonight = useDayLog(today);
  const desktop = useIsDesktop();

  if (!profile || source === undefined || !routines || !logs || !nouns || !kept || !period || tonight === undefined) return <Page>{null}</Page>;

  const nightNotes = source?.closedAt ? summariseNightWarnings(planClose(routines, logs, source.date, rollover).warnings) : [];
  const view: MorningView = {
    profile,
    today,
    rollover,
    source,
    summary,
    pillars,
    warnings: [...new Set([...(source?.warnings ?? []), ...nightNotes])],
    nouns,
    kept,
    period,
  };

  if (desktop) {
    const grid = weekGrid(routines, logs, mondayOf(today), rollover);
    return (
      <Page wide>
        <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10">
          <div className="flex min-w-0 flex-col gap-3.5">
            <LetterBlock view={view} desktop />
            {source ? <AffirmationBlock view={view} /> : null}
            <Notes view={view} desktop />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <XpScene summary={summary} />
            <PillarsBlock view={view} desktop />
            <QuestsBlock view={view} desktop />
            <WeekGridSection grid={grid} today={today} todayClosed={!!tonight?.closedAt} />
            <div className="mt-auto flex items-center justify-between gap-3 pt-2">
              <span className="text-mid">Written by Claude. Nothing left this device except what you pasted.</span>
              <ButtonLink to="/campfire">Open tonight's log</ButtonLink>
            </div>
          </div>
        </div>
      </Page>
    );
  }

  return (
    <Page>
      <XpScene summary={summary} />
      <PillarsBlock view={view} />
      <LetterBlock view={view} />
      <QuestsBlock view={view} />
      {source ? <AffirmationBlock view={view} /> : null}
      <Notes view={view} />
    </Page>
  );
}

interface MorningView {
  profile: Profile;
  today: string;
  rollover: number;
  source: DayLog | null;
  summary: PlayerSummary | undefined;
  pillars: Record<Pillar, PillarState> | undefined;
  warnings: string[];
  nouns: string[];
  kept: Set<string>;
  period: PeriodQuests[];
}

function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10;
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(1);
  return r > 0 ? `+${s}` : r < 0 ? `-${s}` : '0';
}

function PillarsBlock({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const { source, pillars } = view;
  const deltas = source ? pillarTotals([...(source.routineStats ?? []), ...source.stats]) : undefined;
  const levels = PILLARS.map((p) => displayLevel(pillars?.[p]?.points ?? 0));
  const max = Math.max(10, Math.ceil(Math.max(...levels) / 10) * 10);
  const wide = deltas ? PILLARS.some((p) => !Number.isInteger(Math.round(deltas[p] * 10) / 10)) : false;
  return (
    <>
      <SectionHeader title="Pillars" note={source ? 'since last night' : undefined} />
      <Section>
        <div className={`flex flex-col ${desktop ? 'gap-2' : 'gap-1.5'}`}>
          {PILLARS.map((p, i) => {
            const d = deltas?.[p];
            return (
              <div key={p} data-testid={`pillar-${p}`}>
                <StatRow
                  name={PILLAR_LABEL[p]}
                  value={levels[i]!}
                  max={max}
                  nameWidth={desktop ? 84 : 76}
                  trailing={
                    d === undefined ? null : (
                      <span className={`${wide ? 'w-9' : 'w-7'} shrink-0 text-right ${d < 0 ? 'text-red' : 'text-mid'}`}>{fmtDelta(d)}</span>
                    )
                  }
                />
              </div>
            );
          })}
        </div>
      </Section>
    </>
  );
}

function LetterBlock({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { source, today, profile, rollover } = view;
  if (!source?.briefMd) {
    return (
      <>
        <SectionHeader title="This morning's letter" />
        <Section>
          <Empty action={<ButtonLink to="/campfire">Open tonight's log</ButtonLink>}>No letter yet. Tonight's Campfire writes the first one.</Empty>
        </Section>
      </>
    );
  }
  const words = wordCount(source.briefMd);
  const yesterday = addDays(today, -1);
  const when = source.date === today ? 'Written tonight' : source.date === yesterday ? 'Written last night' : undefined;
  const note = desktop && when ? `${when}, ${words} words.` : `${words} words`;
  const older = source.date < yesterday;
  const collapsed = !desktop && !expanded ? firstSentences(source.briefMd, 2) : undefined;
  return (
    <>
      <SectionHeader title="This morning's letter" note={note} />
      <Section>
        <div className={`flex flex-col ${desktop ? 'gap-3.5' : 'gap-1.5'}`}>
          {older ? <span className="text-mid">From Night {dayNoFor(profile.startedAt, source.date, rollover)}</span> : null}
          <Letter md={source.briefMd} paragraphs={collapsed ? [collapsed.text] : undefined} large={desktop} />
          {collapsed?.more ? (
            <button type="button" className="cursor-pointer self-start border-0 bg-transparent p-0 text-mid" onClick={() => setExpanded(true)}>
              Read the whole letter
            </button>
          ) : null}
        </div>
      </Section>
    </>
  );
}

function QuestsBlock({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const { source, period } = view;
  const today = source ? source.quests.filter((q) => !isPeriodQuest(q)) : [];
  return (
    <>
      {source && today.length ? (
        <>
          <SectionHeader title="Today's quests" note={`${today.filter((q) => !q.done).length} of ${today.length} open`} />
          <Section>
            <QuestList date={source.date} quests={today} desktop={desktop} testId="quests" />
          </Section>
        </>
      ) : null}
      {period.map((p) => (
        <div key={p.kind} className="flex flex-col gap-2">
          <SectionHeader title={p.kind === 'weekly' ? 'Quests for the week' : 'Quests for the month'} note={`${p.quests.filter((q) => !q.done).length} of ${p.quests.length} open`} />
          <Section>
            <QuestList date={p.log.date} quests={p.quests} desktop={desktop} />
          </Section>
        </div>
      ))}
    </>
  );
}

function AffirmationBlock({ view }: { view: MorningView }) {
  const { source, kept, nouns } = view;
  if (!source?.affirmations.length) return null;
  return <AffirmationRow date={source.date} affirmations={source.affirmations} kept={kept} knownNouns={nouns} />;
}

function Notes({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const { source, warnings, nouns } = view;
  const insights = (source?.insights ?? []).map((i) => `Pattern noticed: ${lowerFirst(i, nouns)}`);
  const lesson = source?.lessonMd ? lessonLine(source.lessonMd) : undefined;
  if (!warnings.length && !insights.length && !lesson) return null;
  // A used shield is the game working, so it reads in mid; Claude's warnings and broken streaks are red.
  const warningLines = warnings.map((w) => (
    <span key={`w-${w}`} className={isShieldNote(w) ? 'text-mid' : 'text-red'}>
      {w}
    </span>
  ));
  const quiet = [
    ...insights.map((i) => (
      <span key={`i-${i}`} className="text-mid">
        {i}
      </span>
    )),
    lesson ? (
      <span key="lesson" className="text-mid">
        {lesson}
      </span>
    ) : null,
  ];
  if (desktop) {
    return (
      <div className="mt-auto flex flex-col gap-1.5 border-t border-faint pt-3.5" data-testid="notes">
        {quiet}
        {warningLines}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1.5 px-2.5 pt-1" data-testid="notes">
      {warningLines}
      {quiet}
    </div>
  );
}
