import { dayLogRepo } from '@/data/repo';
import { PILLAR_LABEL, type Quest } from '@/data/types';
import { LiveCheck } from '@/features/campfire/parts';
import { TickPop, pulseClass } from '@/ui/fx/TickPop';
import { useDataEdges } from '@/ui/fx/useDataEdges';

/** Persist one quest's done flag on the DayLog that holds it (read fresh, so two quick taps never clash). */
export async function setQuestDone(date: string, questId: string, done: boolean): Promise<void> {
  const log = await dayLogRepo.get(date);
  if (!log) return;
  await dayLogRepo.update(date, { quests: log.quests.map((q) => (q.id === questId ? { ...q, done } : q)) });
}

/**
 * Quest rows. Phone: the reward sits under the quest in mid. Desktop: the reward sits on the right,
 * and on wide screens (2xl) where the column has room, the pillar shows as a small [Work] prefix.
 */
export function QuestList({ date, quests, desktop, testId }: { date: string; quests: Quest[]; desktop: boolean; testId?: string }) {
  // A quest that the database now holds as done, after showing it open, pops once.
  const ticked = useDataEdges(
    quests.map((q) => [q.id, q.done] as const),
    (was, now) => !was && now,
    (was, now) => was && !now,
  );
  return (
    <div className={`flex flex-col ${desktop ? 'gap-2.5' : 'gap-2'}`} data-testid={testId}>
      {quests.map((q) => (
        <label key={q.id} className={`relative flex cursor-pointer gap-3 ${desktop ? 'items-center' : 'items-start'}`}>
          {q.pillar ? <TickPop nonce={ticked.get(q.id)} text={PILLAR_LABEL[q.pillar]} className="right-0" /> : null}
          <LiveCheck
            className={`h-3.5 w-3.5 shrink-0 accent-ink ${desktop ? 'm-0' : 'mx-0 mt-[3px] mb-0'} ${pulseClass(ticked.get(q.id))}`}
            checked={q.done}
            aria-label={q.text}
            onCheckedChange={(next) => setQuestDone(date, q.id, next)}
          />
          {desktop ? (
            <>
              <span className={`min-w-0 flex-1 ${q.done ? 'text-mid line-through decoration-faint' : ''}`}>
                {q.pillar ? <span className="hidden text-mid 2xl:inline">[{PILLAR_LABEL[q.pillar]}] </span> : null}
                {q.text}
              </span>
              {q.reward ? <span className="max-w-[45%] shrink-0 text-right text-mid">{q.reward}</span> : null}
            </>
          ) : (
            <span className="flex min-w-0 flex-col">
              <span className={q.done ? 'text-mid line-through decoration-faint' : ''}>{q.text}</span>
              {q.reward ? <span className="text-mid">{q.reward}</span> : null}
            </span>
          )}
        </label>
      ))}
    </div>
  );
}
