/** Skill rules from the spec: 1-100, bands, +0.1 per logged hour between Claude assessments. */

export type SkillBand = 'Beginner' | 'Capable' | 'Solid' | 'Advanced' | 'Expert' | 'Elite';

export const LEVEL_PER_HOUR = 0.1;

/** Bands use the displayed (rounded) level so the number and the word always agree. */
export function skillBand(level: number): SkillBand {
  const l = Math.round(level);
  if (l >= 95) return 'Elite';
  if (l >= 80) return 'Expert';
  if (l >= 60) return 'Advanced';
  if (l >= 40) return 'Solid';
  if (l >= 20) return 'Capable';
  return 'Beginner';
}

export function clampLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.round(n * 10) / 10));
}

/** Level after logging `hours`: +0.1 per hour, capped at 100, one decimal. */
export function levelAfterHours(level: number, hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return clampLevel(level);
  return clampLevel(level + hours * LEVEL_PER_HOUR);
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
