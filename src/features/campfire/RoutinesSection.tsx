import { useState } from 'react';
import type { RoutineWithLog } from '@/data/hooks';
import { routineLogRepo } from '@/data/repo';
import type { RoutineLog } from '@/data/types';
import { formatGain } from '@/lib/game/rewards';
import { formatStreak, isShieldNote, streakFromLogs } from '@/lib/game/streaks';
import { TickPop, pulseClass } from '@/ui/fx/TickPop';
import { useDataEdges } from '@/ui/fx/useDataEdges';
import { Empty, Section, SectionHeader } from '@/ui/primitives';
import { rescoreNight } from './nightFlow';
import { LiveCheck, TextButton, TextLink } from './parts';

interface Props {
  date: string;
  routines: RoutineWithLog[];
  logs: RoutineLog[];
  /** The night was sent: a change re-scores it, and an unticked routine no longer waits. */
  closed: boolean;
  /** Close-of-night notes (shields used, streaks broken), already summarised. */
  notes: string[];
}

export function RoutinesSection({ date, routines, logs, closed, notes }: Props) {
  const [showRest, setShowRest] = useState(false);
  const scheduled = routines.filter((r) => r.scheduledToday);
  const rest = routines.filter((r) => !r.scheduledToday);
  const done = scheduled.filter((r) => r.log?.done).length;
  const streaks = new Map(routines.map(({ routine }) => [routine.id, streakFromLogs(routine, logs, date, { todayPending: !closed })]));
  // Both come from the database: a log saved as done pops "+weight", a streak that grew rolls in.
  const ticked = useDataEdges(
    routines.map(({ routine, log }) => [routine.id, !!log?.done] as const),
    (was, now) => !was && now,
    (was, now) => was && !now,
  );
  const grew = useDataEdges(
    routines.map(({ routine }) => [routine.id, streaks.get(routine.id) ?? 0] as const),
    (was, now) => now > was,
    (was, now) => now < was,
  );

  async function toggle(routineId: string, next: boolean) {
    await routineLogRepo.set(routineId, date, next);
    if (closed) await rescoreNight(date);
  }

  const row = ({ routine, log, scheduledToday }: RoutineWithLog) => {
    const streak = streaks.get(routine.id) ?? 0;
    const tick = ticked.get(routine.id);
    const roll = grew.get(routine.id);
    return (
      <label key={routine.id} className="flex cursor-pointer items-center gap-3">
        <LiveCheck className={pulseClass(tick)} checked={!!log?.done} onCheckedChange={(next) => toggle(routine.id, next)} aria-label={routine.name} />
        <span className="relative min-w-0 flex-1">
          {routine.name}
          {routine.weight > 0 ? <TickPop nonce={tick} text={formatGain(routine.weight)} className="right-1" /> : null}
        </span>
        <span className="shrink-0 overflow-hidden text-mid">
          {scheduledToday ? (
            <span key={roll ?? 'still'} className={`block ${roll === undefined ? '' : 'rw-tick'}`}>
              {formatStreak(streak)}
            </span>
          ) : (
            'not today'
          )}
        </span>
      </label>
    );
  };

  return (
    <>
      <SectionHeader title="Routines" note={scheduled.length ? `${done} of ${scheduled.length} done` : undefined} />
      <Section>
        {routines.length === 0 ? (
          <Empty action={<TextLink to="/edit/routines/new">Add a routine</TextLink>}>Add your first routine. The night log starts there.</Empty>
        ) : (
          <>
            {scheduled.length ? (
              <div className="flex flex-col gap-1.5" data-testid="routines">
                {scheduled.map(row)}
              </div>
            ) : (
              <span className="text-mid">Nothing is scheduled tonight.</span>
            )}
            {notes.map((n) => (
              <span key={n} className={isShieldNote(n) ? 'text-mid' : 'text-red'}>
                {n}
              </span>
            ))}
            {rest.length ? (
              <>
                <TextButton className="self-start" onClick={() => setShowRest((v) => !v)} aria-expanded={showRest}>
                  {showRest ? 'Hide the rest' : 'Show the rest'}
                </TextButton>
                {showRest ? <div className="flex flex-col gap-1.5">{rest.map(row)}</div> : null}
              </>
            ) : null}
          </>
        )}
      </Section>
    </>
  );
}
