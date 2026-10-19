import { describe, expect, it } from 'vitest';
import { cleanDays, daysText, normalizeWindow, shieldsText, toggleDay } from './routines';

describe('routine days', () => {
  it('reads an empty mask and all seven days as daily', () => {
    expect(daysText([])).toBe('daily');
    expect(daysText([0, 1, 2, 3, 4, 5, 6])).toBe('daily');
    expect(cleanDays([6, 5, 4, 3, 2, 1, 0])).toEqual([]);
  });
  it('reads a run Monday first and lists the rest', () => {
    expect(daysText([1, 2, 3, 4, 5, 6])).toBe('Mon to Sat');
    expect(daysText([0, 1, 3, 5])).toBe('Mon, Wed, Fri, Sun');
    expect(daysText([6, 0])).toBe('Sat, Sun');
    expect(daysText([5, 6, 0])).toBe('Fri to Sun');
  });
  it('toggles days and keeps the mask clean', () => {
    expect(toggleDay([], 1)).toEqual([1]);
    expect(toggleDay([1, 3], 3)).toEqual([1]);
    expect(toggleDay([0, 1, 2, 3, 4, 5], 6)).toEqual([]);
    expect(cleanDays([3, 3, 9, -1, 1])).toEqual([1, 3]);
  });
});

describe('routine window', () => {
  it('normalizes readable windows', () => {
    expect(normalizeWindow('06:00-07:30')).toBe('06:00-07:30');
    expect(normalizeWindow('6:00 - 7:30')).toBe('06:00-07:30');
    expect(normalizeWindow('22.00 to 23.00')).toBe('22:00-23:00');
    expect(normalizeWindow('  ')).toBe('');
  });
  it('rejects anything else', () => {
    expect(normalizeWindow('morning')).toBeNull();
    expect(normalizeWindow('25:00-26:00')).toBeNull();
    expect(normalizeWindow('06:00')).toBeNull();
  });
  it('writes shields', () => {
    expect(shieldsText(0)).toBe('no shield left');
    expect(shieldsText(1)).toBe('1 shield');
  });
});
