import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { useProfile } from '@/data/hooks';
import { DEFAULT_ROLLOVER_HOUR, dayNumber, todayKey } from '@/lib/dates';
import { formatMinute, gameMinute, nowAndNext, type TimelineBlock } from '@/lib/schedule/schedule';
import { PixelSprite } from '@/ui/PixelSprite';
import { useNow } from '@/features/campfire/parts';
import { CLOCK_MAP, NOW_PALETTE } from './nowSprites';
import { useDaySchedule } from './useDaySchedule';

function describe(b: TimelineBlock): string {
  return b.room ? `${b.title}, ${b.room}` : b.title;
}

/** The clock and what is on: sits at the top of Morning. Ink on paper-2, no box. */
export function NowStrip() {
  const now = useNow(15_000);
  const profile = useProfile();
  const rollover = profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
  const date = todayKey(rollover, now);
  const schedule = useDaySchedule(date);

  const clock = formatMinute(now.getHours() * 60 + now.getMinutes());
  const minute = gameMinute(now, rollover);
  const { now: current, next, freeUntil } = schedule ? nowAndNext(schedule.timeline, minute) : {};

  let nowLine: ReactNode = null;
  let nextLine: ReactNode = null;
  if (schedule) {
    if (schedule.timeline.length === 0) {
      nowLine =
        schedule.entries.length === 0 ? (
          <span>
            Nothing scheduled.{' '}
            <Link to="/vault/timetable" className="text-walnut">
              Add a timetable
            </Link>
          </span>
        ) : (
          <span>Nothing scheduled today.</span>
        );
    } else if (current) {
      nowLine = <span>{`Now: ${describe(current)}, until ${current.end}`}</span>;
    } else if (freeUntil) {
      nowLine = <span>{`Free until ${freeUntil}`}</span>;
    } else {
      nowLine = <span>Done for today.</span>;
    }
    if (next) nextLine = <span className="text-mid">{`Next: ${describe(next)}, ${next.start}`}</span>;
  }

  return (
    <div className="flex flex-col gap-1 bg-paper-2 px-2.5 py-2 text-ink" data-testid="now-strip">
      <div className="flex items-center gap-2">
        <PixelSprite map={CLOCK_MAP} palette={NOW_PALETTE} scale={2} />
        <span className="text-[18px] leading-none" data-testid="now-clock">
          {clock}
        </span>
        {profile ? <span className="text-mid">{`Day ${dayNumber(profile.startedAt, rollover, now)}`}</span> : null}
        <Link to="/now" className="ml-auto text-walnut no-underline">
          See the day
        </Link>
      </div>
      {nowLine ? <div>{nowLine}</div> : null}
      {nextLine ? <div>{nextLine}</div> : null}
    </div>
  );
}
