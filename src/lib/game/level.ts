/**
 * Level curve shared by pillars, sub-stats and the player.
 *
 *   level = 10 × log2(1 + points / 50)
 *
 * No cap. Doubling your points adds the same amount of level whether you are at 10 or at 60,
 * so early days feel fast and later days still move.
 */

export const LEVEL_SCALE = 50;

export function levelFromPoints(points: number): number {
  return 10 * Math.log2(1 + Math.max(0, points) / LEVEL_SCALE);
}

/** Inverse of levelFromPoints. Used by seeds and by "N points to next level". */
export function pointsForLevel(level: number): number {
  return LEVEL_SCALE * (2 ** (Math.max(0, level) / 10) - 1);
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Display level with one decimal, e.g. 7.4. */
export function displayLevel(points: number): number {
  return round1(levelFromPoints(points));
}

/** Points still needed to reach the next whole level, plus the span of that level. */
export function progressToNextLevel(points: number): { current: number; span: number; nextLevel: number } {
  const level = levelFromPoints(points);
  const nextLevel = Math.floor(level) + 1;
  const floorPoints = pointsForLevel(Math.floor(level));
  const nextPoints = pointsForLevel(nextLevel);
  return { current: points - floorPoints, span: nextPoints - floorPoints, nextLevel };
}

/** A pillar's points are the mean of its sub-stats. */
export function pillarPoints(subStatPoints: number[]): number {
  if (subStatPoints.length === 0) return 0;
  return subStatPoints.reduce((a, b) => a + b, 0) / subStatPoints.length;
}

/** The player's overall points are the mean of the five pillars; the level uses the same curve. */
export function playerPoints(pillarPointsList: number[]): number {
  return pillarPoints(pillarPointsList);
}
