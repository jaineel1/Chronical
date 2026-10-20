import { describe, expect, it } from 'vitest';
import { fitWithin, photoPath, photoProgressLine } from './photos';

describe('photoPath', () => {
  it('sorts by date in the repo and is unique per photo', () => {
    expect(photoPath('2026-10-20', 'front', 'k3x9')).toBe('photos/2026-10-20-front-k3x9.jpg');
  });
});

describe('fitWithin', () => {
  it('shrinks the long edge to the limit and keeps the shape', () => {
    expect(fitWithin(3000, 4000, 1600)).toEqual({ width: 1200, height: 1600 });
    expect(fitWithin(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200 });
  });

  it('never enlarges a small image', () => {
    expect(fitWithin(800, 600, 1600)).toEqual({ width: 800, height: 600 });
  });
});

describe('photoProgressLine', () => {
  it('is empty without photos', () => {
    expect(photoProgressLine([])).toBeUndefined();
  });

  it('compares the newest photo day with the one before', () => {
    const line = photoProgressLine([
      { date: '2026-10-06', angle: 'front', weightKg: 73.5 },
      { date: '2026-10-20', angle: 'side' },
      { date: '2026-10-20', angle: 'front', weightKg: 72.4 },
    ]);
    expect(line).toBe(
      'Newest progress photos 20 Oct (front, side) at 72.4 kg. Previous 6 Oct at 73.5 kg, 14 days earlier: -1.1 kg. 2 photo days in all. The player sees the photos; you only get these numbers.',
    );
  });

  it('says when these are the first photos', () => {
    expect(photoProgressLine([{ date: '2026-10-20', angle: 'back' }])).toContain('(back). The first photos so far. 1 photo day in all.');
  });
});
