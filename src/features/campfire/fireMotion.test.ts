import { describe, expect, it } from 'vitest';
import { MAX_SPARKS, SPARK_PATHS, isEmbers, sparkCount } from './fireMotion';
import { EMBER_FRAMES, FIRE_FRAMES } from './fireSprites';
import { FIRE_MAP } from '@/ui/sprites';

describe('sparkCount', () => {
  it('throws nothing when the count stays or drops', () => {
    expect(sparkCount(3, 3)).toBe(0);
    expect(sparkCount(3, 2)).toBe(0);
  });
  it('throws three for one new item and more for several, capped', () => {
    expect(sparkCount(0, 1)).toBe(3);
    expect(sparkCount(2, 4)).toBe(4);
    expect(sparkCount(0, 20)).toBe(MAX_SPARKS);
  });
  it('has a path for every spark', () => {
    expect(SPARK_PATHS.length).toBeGreaterThanOrEqual(MAX_SPARKS);
  });
});

describe('isEmbers', () => {
  it('shows embers only when nothing is logged', () => {
    expect(isEmbers(0)).toBe(true);
    expect(isEmbers(1)).toBe(false);
  });
});

describe('fire frames', () => {
  it('starts with the mockup fire and keeps every frame the same size', () => {
    expect(FIRE_FRAMES[0]).toBe(FIRE_MAP);
    for (const frames of [FIRE_FRAMES, EMBER_FRAMES]) {
      const first = frames[0]!;
      for (const f of frames) {
        expect(f.length).toBe(first.length);
        for (const row of f) expect(row.length).toBe(first[0]!.length);
      }
    }
  });
  it('only uses letters the fire palette knows', () => {
    for (const f of [...FIRE_FRAMES, ...EMBER_FRAMES]) for (const row of f) expect(row).toMatch(/^[.yorw]+$/);
  });
});
