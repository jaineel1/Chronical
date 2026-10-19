/** Skill rules from the spec: 1-100, bands, +0.1 per logged hour between Claude assessments. */
import { clampSkillLevel } from '@/lib/parse/skill';

// One band table and one clamp, shared with the prompt and the parser.
export { skillBand, type SkillBand } from '@/lib/prompt/skill';
export { clampSkillLevel as clampLevel } from '@/lib/parse/skill';

export const LEVEL_PER_HOUR = 0.1;

/** Level after logging `hours`: +0.1 per hour, capped at 100, one decimal. */
export function levelAfterHours(level: number, hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return clampSkillLevel(level);
  return clampSkillLevel(level + hours * LEVEL_PER_HOUR);
}

export function formatSkillLevel(level: number): string {
  return String(Math.round(level));
}

/** "Running 62 to 70: a half marathon under 1:55" from the first skill that has a milestone. */
export function nextMilestoneLine(skills: readonly { name: string; milestones: string[] }[]): string | undefined {
  for (const s of skills) {
    const m = s.milestones.find((x) => x.trim());
    if (m) return `${s.name} ${m.trim()}`;
  }
  return undefined;
}
