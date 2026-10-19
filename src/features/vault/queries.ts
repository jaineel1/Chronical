/** Read-only live queries used only by the Vault screens. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { promptRepo } from '@/data/repo';
import type { DayLog, Prompt, StarredAffirmation } from '@/data/types';

export function usePromptCount(): number | undefined {
  return useLiveQuery(() => db.prompts.count(), []);
}

/** Every prompt, newest first. */
export function usePromptsNewestFirst(limit = 500): Prompt[] | undefined {
  return useLiveQuery(() => promptRepo.recent(limit), [limit]);
}

export function usePrompt(id: string | undefined): Prompt | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.prompts.get(id)) ?? null) : null), [id]);
}

/** Every day log with a letter, newest first. */
export function useLetters(): DayLog[] | undefined {
  return useLiveQuery(
    () =>
      db.dayLogs
        .orderBy('date')
        .reverse()
        .filter((d) => !!d.briefMd)
        .toArray(),
    [],
  );
}

export function useKeptAffirmations(): StarredAffirmation[] | undefined {
  return useLiveQuery(() => db.affirmations.orderBy('date').reverse().toArray(), []);
}

/** Lower-cased names already in the game, so a re-run only suggests new things. */
export function useExistingNames(): { skills: Set<string>; routines: Set<string>; goals: Set<string> } | undefined {
  return useLiveQuery(async () => {
    const [skills, routines, goals] = await Promise.all([db.skills.toArray(), db.routines.filter((r) => !r.archived).toArray(), db.goals.toArray()]);
    return {
      skills: new Set(skills.map((s) => s.name.trim().toLowerCase())),
      routines: new Set(routines.map((r) => r.name.trim().toLowerCase())),
      goals: new Set(goals.map((g) => g.title.trim().toLowerCase())),
    };
  }, []);
}
