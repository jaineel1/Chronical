import { PILLARS, PILLAR_LABEL } from '@/data/types';
import type { WeekGrid as Grid } from '@/lib/game/xp';
import { formatShortDate } from '@/lib/dates';
import { Section, SectionHeader } from '@/ui/primitives';

const LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

/** 16px cells on an 8px gap, right-aligned so they sit under the day letters in the header. */
function Letters() {
  return (
    <span className="flex gap-2" aria-hidden="true">
      {LETTERS.map((l, i) => (
        <span key={i} className="w-4 text-center">
          {l}
        </span>
      ))}
    </span>
  );
}

/**
 * "This week": five pillars × Monday to Sunday. Filled when every routine of that pillar scheduled
 * that day was done; faint when it was not (or nothing was scheduled); outlined for the days still
 * ahead, and for today until tonight's log is sent.
 */
export function WeekGridSection({ grid, today, todayClosed }: { grid: Grid; today: string; todayClosed: boolean }) {
  return (
    <>
      <SectionHeader title="This week" note={<Letters />} />
      <Section>
        <div className="flex flex-col gap-2.5" data-testid="week-grid">
          {PILLARS.map((p) => (
            <div key={p} className="flex items-center gap-2">
              <span className="min-w-0 flex-1">{PILLAR_LABEL[p]}</span>
              <span className="flex gap-2">
                {grid.days.map((day, i) => {
                  const done = grid.done[p][i];
                  const ahead = !done && (day > today || (day === today && !todayClosed));
                  const cls = done ? 'bg-mid' : ahead ? 'border border-mid' : 'bg-faint';
                  const state = done ? 'all done' : ahead ? 'still open' : 'not all done';
                  return <span key={day} className={`block h-4 w-4 ${cls}`} title={`${PILLAR_LABEL[p]}, ${formatShortDate(day)}: ${state}`} />;
                })}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </>
  );
}
