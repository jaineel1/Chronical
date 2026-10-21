import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { useDayLog, useLatestBrief, usePillars, useProfile } from '@/data/hooks';
import { PILLARS, PILLAR_LABEL, type DayLog, type Pillar, type PillarState, type Profile, type Quest, type Routine, type RoutineLog } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, addDays, formatLongDate, todayKey } from '@/lib/dates';
import { dayNoFor, mondayOf } from '@/lib/game/calendar';
import { pillarTotals } from '@/lib/game/daily';
import { displayLevel } from '@/lib/game/level';
import { nightMoves, type PillarMove } from '@/lib/game/rewards';
import { planClose, summariseNightWarnings } from '@/lib/game/streaks';
import { playerSummary, weekGrid, type PlayerSummary } from '@/lib/game/xp';
import { PERIOD_QUEST_PREFIX, isPeriodQuest } from '@/lib/parse/weekly';
import { Empty, Section, SectionHeader } from '@/ui/primitives';
import { dayLogRepo } from '@/data/repo';
import { FillStatRow } from '@/ui/fx/FillStatRow';
import { LevelUpBanner } from '@/ui/fx/LevelUpBanner';
import { claimNight } from '@/ui/fx/nightOnce';
import { ButtonLink, useIsDesktop, useNow } from '@/features/campfire/parts';
import { useKnownNouns, useRoutineLogs } from '@/features/campfire/queries';
import { AffirmationRow } from './AffirmationRow';
import { Letter } from './Letter';
import { firstSentences, wordCount } from './letterText';
import { useActiveRoutines, useKeptAffirmations, useNameTargets, usePeriodQuests, type PeriodQuests } from './queries';
import { EditableSection } from './edit/EditableSection';
import { ProseEditor } from './edit/ProseEditor';
import { QuestEditor } from './edit/QuestEditor';
import { EditLinksRow, NotesArea } from './NotesArea';
import type { NameTarget } from './linkNames';
import { BossCard } from './BossCard';
import { NowStrip } from '@/features/now/NowStrip';
import { QuickCapture } from '@/features/campfire/QuickCapture';
import { QuestList } from './QuestList';
import { ReviewBlock } from './ReviewBlock';
import { RoutineSuggestion } from './RoutineSuggestion';
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
  const targets = useNameTargets();
  const desktop = useIsDesktop();

  if (!profile || source === undefined || !routines || !logs || !nouns || !kept || !period || !targets || tonight === undefined) return <Page>{null}</Page>;

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
    targets,
    routines,
    logs,
  };

  if (desktop) {
    const grid = weekGrid(routines, logs, mondayOf(today), rollover);
    return (
      <Page wide>
        <NowStrip />
        <div className="grid grid-cols-[minmax(0,7fr)_minmax(0,5fr)] gap-10">
          <div className="flex min-w-0 flex-col gap-3.5">
            <LetterBlock view={view} desktop />
            <ReviewBlock source={source} today={tonight} />
            {source ? <AffirmationBlock view={view} /> : null}
            <Notes view={view} desktop />
            <EditLinksRow />
          </div>
          <div className="flex min-w-0 flex-col gap-4">
            <XpScene summary={summary} />
            <PillarsBlock view={view} desktop />
            <QuestsBlock view={view} desktop />
            <BossCard />
            {source ? <RoutineSuggestion log={source} rolloverHour={rollover} /> : null}
            <QuickCapture />
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
      <NowStrip />
      <XpScene summary={summary} />
      <PillarsBlock view={view} />
      <LetterBlock view={view} />
      <ReviewBlock source={source} today={tonight} />
      <QuestsBlock view={view} />
      <BossCard />
      {source ? <RoutineSuggestion log={source} rolloverHour={rollover} /> : null}
      <QuickCapture />
      {source ? <AffirmationBlock view={view} /> : null}
      <Notes view={view} />
      <EditLinksRow />
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
  targets: NameTarget[];
  routines: Routine[];
  logs: RoutineLog[];
}

function fmtDelta(n: number): string {
  const r = Math.round(n * 10) / 10;
  const s = Number.isInteger(r) ? String(Math.abs(r)) : Math.abs(r).toFixed(1);
  return r > 0 ? `+${s}` : r < 0 ? `-${s}` : '0';
}

interface NightFx {
  date: string;
  /** Bars fill from where the night found them, and the deltas pop in. */
  fill: boolean;
  /** Pillars that crossed a whole level that night, each shown as a banner. */
  levelUps: Pillar[];
}

/**
 * The first time this device shows a night's letter, the bars fill from before the night and every
 * pillar that crossed a whole level gets a banner. Decided before paint, once per night on this
 * mount, so nothing jumps after the screen appears. Waits until the night's stats are applied.
 */
function useNightFx(source: DayLog | null, moves: Record<Pillar, PillarMove> | undefined): NightFx | undefined {
  const [fx, setFx] = useState<NightFx>();
  const decided = useRef<string | undefined>(undefined);
  useLayoutEffect(() => {
    if (!source?.statsAppliedAt || !moves || decided.current === source.date) return;
    decided.current = source.date;
    const fill = claimNight('pillars', source.date);
    const levelUps = PILLARS.filter((p) => moves[p].levelUp !== undefined && claimNight(`levelup.${p}`, source.date));
    setFx({ date: source.date, fill, levelUps });
  }, [source, moves]);
  return fx && fx.date === source?.date ? fx : undefined;
}

function PillarsBlock({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const { source, pillars, today, profile, rollover } = view;
  const deltas = source ? pillarTotals([...(source.routineStats ?? []), ...source.stats]) : undefined;
  const older = source ? source.date < addDays(today, -1) : false;
  const note = !source ? undefined : older ? `since Night ${dayNoFor(profile.startedAt, source.date, rollover)}` : 'since last night';
  const levels = PILLARS.map((p) => displayLevel(pillars?.[p]?.points ?? 0));
  const max = Math.max(10, Math.ceil(Math.max(...levels) / 10) * 10);
  const wide = deltas ? PILLARS.some((p) => !Number.isInteger(Math.round(deltas[p] * 10) / 10)) : false;
  const moves = useMemo(() => {
    if (!source || !pillars) return undefined;
    const now = Object.fromEntries(PILLARS.map((p) => [p, pillars[p].points])) as Record<Pillar, number>;
    return nightMoves(source, now);
  }, [source, pillars]);
  const fx = useNightFx(source, moves);
  return (
    <>
      <SectionHeader title="Pillars" note={note} />
      <Section>
        <div className={`flex flex-col ${desktop ? 'gap-2' : 'gap-1.5'}`}>
          {PILLARS.map((p, i) => {
            const d = deltas?.[p];
            return (
              <div key={p} data-testid={`pillar-${p}`}>
                <FillStatRow
                  name={PILLAR_LABEL[p]}
                  value={levels[i]!}
                  from={fx?.fill ? moves?.[p].beforeLevel : undefined}
                  max={max}
                  nameWidth={desktop ? 84 : 76}
                  trailing={
                    d === undefined ? null : (
                      <span className={`${wide ? 'w-9' : 'w-7'} shrink-0 text-right ${d < 0 ? 'text-red' : 'text-mid'}`}>
                        {fx?.fill && d !== 0 ? <span className="rw-pop">{fmtDelta(d)}</span> : fmtDelta(d)}
                      </span>
                    )
                  }
                />
              </div>
            );
          })}
          {fx?.levelUps.map((p) => {
            const level = moves?.[p].levelUp;
            return level === undefined ? null : <LevelUpBanner key={p} text={`${PILLAR_LABEL[p]} reached level ${level}`} />;
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
    <EditableSection
      title="This morning's letter"
      note={note}
      label="the letter"
      edit={(close) => (
        <ProseEditor
          label="The letter"
          initial={source.briefMd ?? ''}
          rows={14}
          onSave={async (briefMd) => {
            if (!briefMd) throw new Error('The letter cannot be empty.');
            await dayLogRepo.update(source.date, { briefMd });
            close();
          }}
          onCancel={close}
        />
      )}
    >
      <div className={`flex flex-col ${desktop ? 'gap-3.5' : 'gap-1.5'}`}>
        {older ? <span className="text-mid">From Night {dayNoFor(profile.startedAt, source.date, rollover)}</span> : null}
        <Letter md={source.briefMd} paragraphs={collapsed ? [collapsed.text] : undefined} large={desktop} />
        {collapsed?.more ? (
          <button type="button" className="cursor-pointer self-start border-0 bg-transparent p-0 text-mid" onClick={() => setExpanded(true)}>
            Read the whole letter
          </button>
        ) : null}
      </div>
    </EditableSection>
  );
}

/** Replace the quests the editor opened with its result, leaving the day's other quests alone. */
async function saveQuests(date: string, openedIds: ReadonlySet<string>, next: Quest[]): Promise<void> {
  const log = await dayLogRepo.get(date);
  if (!log) throw new Error('That day is no longer saved.');
  await dayLogRepo.update(date, { quests: [...next, ...log.quests.filter((q) => !openedIds.has(q.id))] });
}

function QuestsBlock({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const { source, period } = view;
  const today = source ? source.quests.filter((q) => !isPeriodQuest(q)) : [];
  return (
    <>
      {source && today.length ? (
        <EditableSection
          title="Today's quests"
          note={`${today.filter((q) => !q.done).length} of ${today.length} open`}
          label="today's quests"
          edit={(close) => (
            <QuestEditor
              initial={today}
              onSave={async (next) => {
                await saveQuests(source.date, new Set(today.map((q) => q.id)), next);
                close();
              }}
              onCancel={close}
            />
          )}
        >
          <QuestList date={source.date} quests={today} desktop={desktop} testId="quests" />
        </EditableSection>
      ) : null}
      {period.map((p) => {
        const title = p.kind === 'weekly' ? 'Quests for the week' : 'Quests for the month';
        return (
          <EditableSection
            key={p.kind}
            title={title}
            note={`${p.quests.filter((q) => !q.done).length} of ${p.quests.length} open`}
            label={title.toLowerCase()}
            edit={(close) => (
              <QuestEditor
                initial={p.quests}
                idPrefix={PERIOD_QUEST_PREFIX[p.kind]}
                onSave={async (next) => {
                  await saveQuests(p.log.date, new Set(p.quests.map((q) => q.id)), next);
                  close();
                }}
                onCancel={close}
              />
            )}
          >
            <QuestList date={p.log.date} quests={p.quests} desktop={desktop} />
          </EditableSection>
        );
      })}
    </>
  );
}

function AffirmationBlock({ view }: { view: MorningView }) {
  const { source, kept, nouns } = view;
  if (!source?.affirmations.length) return null;
  return <AffirmationRow date={source.date} affirmations={source.affirmations} kept={kept} knownNouns={nouns} />;
}

function Notes({ view, desktop = false }: { view: MorningView; desktop?: boolean }) {
  const { source, warnings, routines, logs, targets } = view;
  return <NotesArea source={source} warnings={warnings} routines={routines} logs={logs} targets={targets} desktop={desktop} />;
}
