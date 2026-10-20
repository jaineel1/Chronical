import { useEffect, useMemo, useRef, useState } from 'react';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { useProfile } from '@/data/hooks';
import { dayLogRepo } from '@/data/repo';
import { addDays, DEFAULT_ROLLOVER_HOUR, formatLongDate, formatShortDate, todayKey } from '@/lib/dates';
import { formatMinute, gameMinute, layoutLanes, nowAndNext, type TimelineBlock } from '@/lib/schedule/schedule';
import { Button, Section, SectionHeader } from '@/ui/primitives';
import { ButtonLink, useNow } from '@/features/campfire/parts';
import { HATCH, KIND_CLASS, KIND_NAME } from './blockStyle';
import { useDaySchedule } from './useDaySchedule';

/** Pixels per minute of the timeline: 84px an hour. */
const PPM = 1.4;
/** The shortest a block is drawn, in pixels, so a ten-minute break still reads. */
const MIN_BLOCK_PX = 20;
const DEFAULT_FIRST_HOUR = 6;
const DEFAULT_LAST_HOUR = 23;
const GUTTER = 48;

function relativeLabel(date: string, today: string): string {
  if (date === today) return 'Today';
  if (date === addDays(today, -1)) return 'Yesterday';
  if (date === addDays(today, 1)) return 'Tomorrow';
  return formatShortDate(date);
}

function hourRange(timeline: readonly TimelineBlock[]): { first: number; last: number } {
  let first = DEFAULT_FIRST_HOUR;
  let last = DEFAULT_LAST_HOUR;
  for (const b of timeline) {
    first = Math.min(first, Math.floor(b.startMin / 60));
    last = Math.max(last, Math.ceil(b.endMin / 60));
  }
  return { first, last: Math.min(24, last) };
}

function Block({ block, top, height, lane, lanes, current, onToggle }: {
  block: TimelineBlock;
  top: number;
  height: number;
  lane: number;
  lanes: number;
  current: boolean;
  onToggle: (block: TimelineBlock) => void;
}) {
  const tight = height < 34;
  const style = {
    top,
    height,
    left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${lane} / ${lanes})`,
    width: `calc((100% - ${GUTTER}px) / ${lanes} - 2px)`,
    ...(block.kind === 'break' ? HATCH : {}),
  };
  const cls = `absolute box-border overflow-hidden border border-faint px-1.5 text-left ${KIND_CLASS[block.kind]} ${current ? 'outline outline-1 outline-ink' : ''}`;
  const done = block.done === true;
  const narrow = lanes > 1;
  const when = block.kind === 'plan' && done ? 'done' : `${block.start}-${block.end}`;
  const body = narrow ? (
    // Side by side with another block: no room for title and time on one line, so stack them and let the title wrap.
    <>
      <span className={`block ${tight ? 'truncate text-[12px] leading-[14px]' : 'break-words'} ${done ? 'text-mid line-through' : ''}`}>{block.title}</span>
      {!tight ? <span className="block text-mid">{when}</span> : null}
      {!tight && block.sub ? <span className="block break-words text-mid">{block.sub}</span> : null}
    </>
  ) : (
    <>
      <span className={`flex items-baseline justify-between gap-2 ${tight ? 'text-[12px] leading-[14px]' : ''}`}>
        <span className={`min-w-0 truncate ${done ? 'text-mid line-through' : ''}`}>{block.title}</span>
        <span className="shrink-0 text-mid">{when}</span>
      </span>
      {!tight && block.sub ? <span className="block truncate text-mid">{block.sub}</span> : null}
    </>
  );

  if (block.kind === 'plan') {
    return (
      <button
        type="button"
        aria-pressed={done}
        aria-label={`${block.title}, ${block.start} to ${block.end}, ${done ? 'done' : 'not done'}`}
        className={`${cls} cursor-pointer`}
        style={style}
        onClick={() => onToggle(block)}
        data-testid="plan-block"
      >
        {body}
      </button>
    );
  }
  return (
    <div className={cls} style={style} data-testid="timeline-block" data-kind={block.kind} aria-label={`${KIND_NAME[block.kind]}: ${block.title}, ${block.start} to ${block.end}`}>
      {body}
    </div>
  );
}

/** /now: the whole day as a vertical timeline with a rule at the current minute. */
export function NowScreen() {
  const now = useNow(15_000);
  const profile = useProfile();
  const rollover = profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
  const today = todayKey(rollover, now);
  const [picked, setPicked] = useState<string | null>(null);
  const date = picked ?? today;
  const isToday = date === today;
  const schedule = useDaySchedule(date);
  const [error, setError] = useState<string>();
  const nowRef = useRef<HTMLDivElement>(null);

  useShellBar('Now', formatLongDate(today));

  const timeline = useMemo(() => schedule?.timeline ?? [], [schedule]);
  const { first, last } = hourRange(timeline);
  const lanes = useMemo(() => layoutLanes(timeline, MIN_BLOCK_PX / PPM), [timeline]);
  const minute = gameMinute(now, rollover);
  const { now: current, freeUntil } = nowAndNext(timeline, minute);
  const ruleTop = (minute - first * 60) * PPM;
  const showRule = isToday && minute >= first * 60 && minute <= last * 60;

  const scrolled = useRef(false);
  useEffect(() => {
    if (!isToday || scrolled.current || !schedule || typeof nowRef.current?.scrollIntoView !== 'function') return;
    scrolled.current = true;
    nowRef.current.scrollIntoView({ block: 'center' });
  }, [isToday, schedule]);

  const toggle = (block: TimelineBlock) => {
    setError(undefined);
    dayLogRepo
      .ensure(date)
      .then((log) => dayLogRepo.update(date, { plan: (log.plan ?? []).map((p) => (p.id === block.planId ? { ...p, done: !p.done } : p)) }))
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  };

  const hours = Array.from({ length: last - first + 1 }, (_, i) => first + i);
  const status = !isToday ? null : current ? `Now: ${current.title}, until ${current.end}` : freeUntil ? `Free until ${freeUntil}` : null;

  return (
    <Page wide>
      <div className="flex items-center justify-between gap-3 lg:max-w-[760px]">
        <Button variant="outline" onClick={() => setPicked(addDays(date, -1))}>
          {relativeLabel(addDays(date, -1), today)}
        </Button>
        {isToday ? null : (
          <Button variant="text" onClick={() => setPicked(null)}>
            Back to today
          </Button>
        )}
        <Button variant="outline" onClick={() => setPicked(addDays(date, 1))}>
          {relativeLabel(addDays(date, 1), today)}
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-x-10 lg:grid-cols-[minmax(0,720px)_minmax(240px,340px)]">
      <div className="flex min-w-0 flex-col gap-2">
      <SectionHeader title={formatLongDate(date)} note={isToday ? formatMinute(now.getHours() * 60 + now.getMinutes()) : relativeLabel(date, today)} />
      <Section>
        {status ? <span>{status}</span> : null}
        {error ? <span className="text-red" role="alert">{error}</span> : null}

        {schedule === undefined ? null : timeline.length === 0 ? (
          <div className="flex flex-col items-start gap-3 border border-dashed border-faint p-4 text-mid">
            <span>{schedule.entries.length === 0 ? 'Nothing here yet. Add your timetable and the day fills in.' : 'Nothing scheduled this day.'}</span>
            {schedule.entries.length === 0 ? <ButtonLink to="/vault/timetable">Add a timetable</ButtonLink> : null}
          </div>
        ) : (
          <div className="relative mt-2" style={{ height: (last - first) * 60 * PPM + 1 }} data-testid="timeline">
            {hours.map((h) => (
              <div key={h} className="absolute left-0 right-0" style={{ top: (h - first) * 60 * PPM }} aria-hidden="true">
                <div className="hairline" />
                <span className="absolute left-0 top-0 -translate-y-1/2 bg-paper pr-1 text-mid">{formatMinute(h * 60)}</span>
              </div>
            ))}
            {timeline.map((b) => {
              const l = lanes.get(b.id) ?? { lane: 0, lanes: 1 };
              return (
                <Block
                  key={b.id}
                  block={b}
                  top={(b.startMin - first * 60) * PPM}
                  height={Math.max(MIN_BLOCK_PX, (b.endMin - b.startMin) * PPM)}
                  lane={l.lane}
                  lanes={l.lanes}
                  current={isToday && current?.id === b.id}
                  onToggle={toggle}
                />
              );
            })}
            {showRule ? (
              <div ref={nowRef} className="pointer-events-none absolute left-0 right-0 z-10 h-[2px] bg-ink" style={{ top: ruleTop }} data-testid="now-rule">
                <span className="absolute -top-2.5 left-0 bg-ink px-1 text-[12px] leading-[16px] text-bar-text">{formatMinute(minute % 1440)}</span>
              </div>
            ) : null}
          </div>
        )}

        {timeline.length > 0 ? (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-mid" aria-label="Key">
            <span>Ink: class</span>
            <span>Mid: lab</span>
            <span>Walnut: routine</span>
            <span>Red: Claude's plan</span>
          </div>
        ) : null}
      </Section>
      </div>
      {timeline.length > 0 ? (
        <div className="hidden min-w-0 flex-col gap-2 lg:flex" data-testid="agenda">
          <SectionHeader title="The day in order" note={`${timeline.length} blocks`} />
          <Section>
            {timeline.map((b) => (
              <div key={b.id} className={`flex items-baseline justify-between gap-3 border-b border-faint py-1 last:border-b-0 ${b.kind === 'break' ? 'text-mid' : ''}`}>
                <span className="min-w-0">
                  <span className={b.done ? 'text-mid line-through' : ''}>{b.title}</span>
                  {b.sub ? <span className="block text-mid">{b.sub}</span> : null}
                </span>
                <span className="shrink-0 text-mid">{b.start}</span>
              </div>
            ))}
          </Section>
        </div>
      ) : null}
      </div>
    </Page>
  );
}
