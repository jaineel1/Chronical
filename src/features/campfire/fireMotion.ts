/** Pure helpers for the campfire's motion. */

/** Most sparks in one burst. */
export const MAX_SPARKS = 6;

/**
 * Sparks thrown when the logged count moves from `prev` to `next`: none unless it went up,
 * three for one new item and one more per extra item, up to MAX_SPARKS.
 */
export function sparkCount(prev: number, next: number): number {
  const gained = next - prev;
  if (gained <= 0) return 0;
  return Math.min(MAX_SPARKS, 2 + gained);
}

/** Where each spark flies, in sprite pixels (multiply by the fire's scale). Up is negative y. */
export const SPARK_PATHS: readonly { dx: number; dy: number }[] = [
  { dx: -2, dy: -6 },
  { dx: 2, dy: -7 },
  { dx: 0, dy: -8 },
  { dx: -3, dy: -4 },
  { dx: 3, dy: -5 },
  { dx: 1, dy: -6 },
];

/** True when the fire should be low embers rather than flames. */
export function isEmbers(logged: number): boolean {
  return logged <= 0;
}
