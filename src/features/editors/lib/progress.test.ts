import { describe, expect, it } from 'vitest';
import { daysBetween } from '@/lib/dates';
import { dueHint, formatAmount, goalProgress, goalProgressLabel, milestoneProgress, nextDueMilestone } from './progress';

describe('milestone progress', () => {
  it('counts a done milestone as 1 whatever its numbers say', () => {
    expect(milestoneProgress({ doneAt: '2026-10-01T10:00:00Z', target: 10, current: 2 })).toBe(1);
    expect(milestoneProgress({ doneAt: '2026-10-01T10:00:00Z' })).toBe(1);
  });
  it('divides current by target and clamps to 0-1', () => {
    expect(milestoneProgress({ target: 30, current: 22 })).toBeCloseTo(22 / 30, 10);
    expect(milestoneProgress({ target: 115, current: 121 })).toBe(1);
    expect(milestoneProgress({ target: 10, current: -3 })).toBe(0);
    expect(milestoneProgress({ target: 10 })).toBe(0);
  });
  it('counts a milestone without a usable target as 0', () => {
    expect(milestoneProgress({})).toBe(0);
    expect(milestoneProgress({ target: 0, current: 5 })).toBe(0);
    expect(milestoneProgress({ target: Number.NaN, current: 5 })).toBe(0);
  });
});

describe('goal progress', () => {
  it('is the mean over milestones', () => {
    // Invoicing module: two done, 6 of 10 tasks.
    expect(goalProgress([{ doneAt: 'x' }, { doneAt: 'y' }, { target: 10, current: 6 }])).toBeCloseTo((1 + 1 + 0.6) / 3, 10);
  });
  it('is 0 without milestones', () => {
    expect(goalProgress([])).toBe(0);
    expect(goalProgressLabel({ status: 'active' }, [])).toEqual({ value: 0, label: '0%', done: false });
  });
  it('labels a percentage, rounded', () => {
    const p = goalProgressLabel({ status: 'active' }, [{ target: 7, current: 1, unit: 'evenings' }, { target: 7, current: 2, unit: 'days' }]);
    expect(p.label).toBe('21%');
    expect(p.value).toBeCloseTo(3 / 14, 10);
  });
  it('labels "7 of 12" for a single metric milestone with a unit', () => {
    expect(goalProgressLabel({ status: 'active' }, [{ target: 12, current: 7, unit: 'books' }])).toEqual({ value: 7 / 12, label: '7 of 12', done: false });
  });
  it('falls back to a percentage for a single metric milestone without a unit', () => {
    expect(goalProgressLabel({ status: 'active' }, [{ target: 8.5, current: 7.9 }]).label).toBe('93%');
    expect(goalProgressLabel({ status: 'active' }, [{ target: 8.5, current: 7.9, unit: '  ' }]).label).toBe('93%');
  });
  it('shows "done" for a done goal with a full bar', () => {
    expect(goalProgressLabel({ status: 'done' }, [{ target: 10, current: 2 }])).toEqual({ value: 1, label: 'done', done: true });
  });
  it('shows the target as reached for a single done metric milestone', () => {
    expect(goalProgressLabel({ status: 'active' }, [{ target: 30, current: 28, unit: 'km', doneAt: 'x' }]).label).toBe('30 of 30');
  });
  it('formats amounts with at most one decimal', () => {
    expect(formatAmount(7)).toBe('7');
    expect(formatAmount(7.94)).toBe('7.9');
    expect(formatAmount(undefined)).toBe('0');
  });
});

describe('next due milestone', () => {
  const ms = [
    { title: 'Dermatologist follow-up', dueDate: '2026-11-08' },
    { title: 'Progress photo', dueDate: '2026-10-22' },
    { title: 'Old', dueDate: '2026-10-01' },
    { title: 'Far', dueDate: '2027-02-01' },
    { title: 'Done', dueDate: '2026-10-20', doneAt: 'x' },
  ];
  it('picks the soonest open milestone within 30 days', () => {
    expect(nextDueMilestone(ms, '2026-10-19', daysBetween)).toEqual({ milestone: ms[1], days: 3 });
    expect(nextDueMilestone([ms[0]!], '2026-10-19', daysBetween)?.days).toBe(20);
  });
  it('ignores past, far and done milestones', () => {
    expect(nextDueMilestone([ms[2]!, ms[3]!, ms[4]!], '2026-10-19', daysBetween)).toBeUndefined();
  });
  it('writes the hint', () => {
    expect(dueHint('Dermatologist follow-up', 20)).toBe('Dermatologist follow-up in 20 days.');
    expect(dueHint('Photo', 1)).toBe('Photo tomorrow.');
    expect(dueHint('Photo', 0)).toBe('Photo today.');
  });
});
