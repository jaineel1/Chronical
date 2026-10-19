import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Assessment, Skill } from '@/data/types';
import type { SkillForRank } from '@/lib/prompt/skill';

/** Skills in the player's order. */
export function useSkills(): Skill[] | undefined {
  return useLiveQuery(() => db.skills.orderBy('sortOrder').toArray(), []);
}

/** Every skill with its achievements and latest assessment, for the ranking prompt. */
export function useSkillsForRank(): SkillForRank[] | undefined {
  return useLiveQuery(async () => {
    const [skills, achievements, assessments] = await Promise.all([db.skills.orderBy('sortOrder').toArray(), db.achievements.toArray(), db.assessments.toArray()]);
    const latest = new Map<string, Assessment>();
    for (const a of assessments) {
      const cur = latest.get(a.skillId);
      if (!cur || a.createdAt > cur.createdAt) latest.set(a.skillId, a);
    }
    return skills.map((s) => ({
      ...s,
      achievements: achievements.filter((a) => a.skillId === s.id),
      lastAssessment: latest.get(s.id),
    }));
  }, []);
}
