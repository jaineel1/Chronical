import { describe, expect, it } from 'vitest';
import { displayLevel, levelFromPoints, pillarPoints, pointsForLevel, progressToNextLevel } from './level';

describe('level curve', () => {
  it('starts at zero and has no cap', () => {
    expect(levelFromPoints(0)).toBe(0);
    expect(levelFromPoints(50)).toBeCloseTo(10, 5);
    expect(levelFromPoints(150)).toBeCloseTo(20, 5);
    expect(levelFromPoints(1_000_000)).toBeGreaterThan(100);
  });
  it('inverts cleanly', () => {
    for (const lvl of [0, 1.5, 7.4, 12, 33.3]) expect(levelFromPoints(pointsForLevel(lvl))).toBeCloseTo(lvl, 6);
  });
  it('never goes negative', () => {
    expect(levelFromPoints(-20)).toBe(0);
    expect(displayLevel(-1)).toBe(0);
  });
  it('reports progress to the next whole level', () => {
    const p = progressToNextLevel(pointsForLevel(7.4));
    expect(p.nextLevel).toBe(8);
    expect(p.current).toBeGreaterThan(0);
    expect(p.current).toBeLessThan(p.span);
  });
  it('pillar is the mean of its sub-stats', () => {
    expect(pillarPoints([10, 20, 30, 40])).toBe(25);
    expect(pillarPoints([])).toBe(0);
  });
});
