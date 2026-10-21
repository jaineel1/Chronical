/** Read-only live queries for the Morning screen. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { routineRepo } from '@/data/repo';
import type { DayLog, Quest, Routine } from '@/data/types';
import type { NameTarget } from './linkNames';
import { addDays } from '@/lib/dates';
import { PERIOD_QUEST_PREFIX } from '@/lib/parse/weekly';

export function useActiveRoutines(): Routine[] | undefined {
  return useLiveQuery(() => routineRepo.listActive(), []);
}

/** Texts of the affirmations kept from one day's letter. */
export function useKeptAffirmations(date: string | undefined): Set<string> | undefined {
  return useLiveQuery(async () => {
    if (!date) return new Set<string>();
    const rows = await db.affirmations.where('date').equals(date).toArray();
    return new Set(rows.map((r) => r.text));
  }, [date]);
}

export interface PeriodQuests {
  kind: 'weekly' | 'monthly';
  log: DayLog;
  quests: Quest[];
}

/**
 * Quests from the latest weekly review (if it was in the last 7 days) and the latest monthly digest
 * (last 31 days). They live on the DayLog of the day the review was pasted.
 */
export function usePeriodQuests(today: string): PeriodQuests[] | undefined {
  return useLiveQuery(async () => {
    const logs = await db.dayLogs
      .where('date')
      .between(addDays(today, -31), today, true, true)
      .filter((d) => d.quests.some((q) => q.id.startsWith(PERIOD_QUEST_PREFIX.weekly) || q.id.startsWith(PERIOD_QUEST_PREFIX.monthly)))
      .toArray();
    logs.sort((a, b) => b.date.localeCompare(a.date));
    const out: PeriodQuests[] = [];
    for (const kind of ['weekly', 'monthly'] as const) {
      const prefix = PERIOD_QUEST_PREFIX[kind];
      const since = addDays(today, kind === 'weekly' ? -7 : -31);
      const log = logs.find((d) => d.date >= since && d.quests.some((q) => q.id.startsWith(prefix)));
      if (log) out.push({ kind, log, quests: log.quests.filter((q) => q.id.startsWith(prefix)) });
    }
    return out;
  }, [today]);
}

/** The player's active routines, goals, skills, people and books, each with the route of its editor. */
export function useNameTargets(): NameTarget[] | undefined {
  return useLiveQuery(async () => {
    const [routines, goals, skills, people, books] = await Promise.all([
      routineRepo.listActive(),
      db.goals.where('status').equals('active').toArray(),
      db.skills.toArray(),
      db.people.toArray(),
      db.books.toArray(),
    ]);
    return [
      ...routines.map((r) => ({ name: r.name, to: `/edit/routines/${r.id}` })),
      ...goals.map((g) => ({ name: g.title, to: `/edit/goals/${g.id}` })),
      ...skills.map((s) => ({ name: s.name, to: `/edit/skills/${s.id}` })),
      ...people.map((p) => ({ name: p.name, to: `/edit/people/${p.id}` })),
      ...books.map((b) => ({ name: b.title, to: `/edit/books/${b.id}` })),
    ];
  }, []);
}
