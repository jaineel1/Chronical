import { describe, expect, it } from 'vitest';
import { clampLevel, levelAfterHours, nextMilestoneLine, skillBand } from './skills';

describe('skill rules', () => {
  it('maps levels to the six bands at their edges', () => {
    expect([1, 19, 20, 39, 40, 59, 60, 79, 80, 94, 95, 100].map(skillBand)).toEqual([
      'Beginner', 'Beginner', 'Capable', 'Capable', 'Solid', 'Solid', 'Advanced', 'Advanced', 'Expert', 'Expert', 'Elite', 'Elite',
    ]);
  });
  it('uses the rounded level so number and band agree', () => {
    expect(skillBand(19.5)).toBe('Capable');
    expect(skillBand(19.4)).toBe('Beginner');
  });
  it('adds 0.1 per logged hour, capped at 100', () => {
    expect(levelAfterHours(62, 2)).toBe(62.2);
    expect(levelAfterHours(62, 0.5)).toBe(62.1);
    expect(levelAfterHours(99.9, 5)).toBe(100);
    expect(levelAfterHours(62, -3)).toBe(62);
  });
  it('clamps to 1-100', () => {
    expect(clampLevel(0)).toBe(1);
    expect(clampLevel(140)).toBe(100);
    expect(clampLevel(Number.NaN)).toBe(1);
  });
  it('builds the next-milestone line from the first skill that has one', () => {
    expect(nextMilestoneLine([{ name: 'Cooking', milestones: [] }, { name: 'Running', milestones: ['62 to 70: a half marathon under 1:55'] }])).toBe(
      'Running 62 to 70: a half marathon under 1:55',
    );
    expect(nextMilestoneLine([])).toBeUndefined();
  });
});
