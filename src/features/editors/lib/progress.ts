/**
 * Goal progress, shared by the Map and the goal editor.
 *
 *  - a done milestone counts 1;
 *  - a metric milestone (a positive target) counts clamp(current / target, 0, 1);
 *  - anything else counts 0;
 *  - a goal is the mean of its milestones (0 without any), and 1 when the goal itself is done.
 *
 * The label is "48%", or "7 of 12" when the goal is a single metric milestone with a unit, or
 * "done" for a done goal.
 */
import type { Goal, Milestone } from '@/data/types';

type MilestoneLike = Pick<Milestone, 'doneAt' | 'target' | 'current' | 'unit'>;

export function isMetric(m: Pick<Milestone, 'target'>): boolean {
  return typeof m.target === 'number' && Number.isFinite(m.target) && m.target > 0;
}

export function milestoneProgress(m: MilestoneLike): number {
  if (m.doneAt) return 1;
  if (!isMetric(m)) return 0;
  const current = typeof m.current === 'number' && Number.isFinite(m.current) ? m.current : 0;
  return Math.max(0, Math.min(1, current / (m.target as number)));
}

export function goalProgress(milestones: readonly MilestoneLike[]): number {
  if (milestones.length === 0) return 0;
  return milestones.reduce((sum, m) => sum + milestoneProgress(m), 0) / milestones.length;
}

/** 7 → "7", 7.94 → "7.9", 1240 → "1240". */
export function formatAmount(n: number | undefined): string {
  if (n === undefined || !Number.isFinite(n)) return '0';
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 10) / 10);
}

export interface GoalProgress {
  /** 0-1, for the bar. */
  value: number;
  /** "48%", "7 of 12" or "done". */
  label: string;
  done: boolean;
}

export function goalProgressLabel(goal: Pick<Goal, 'status'>, milestones: readonly MilestoneLike[]): GoalProgress {
  if (goal.status === 'done') return { value: 1, label: 'done', done: true };
  const value = goalProgress(milestones);
  const only = milestones.length === 1 ? milestones[0] : undefined;
  if (only && isMetric(only) && only.unit?.trim()) {
    const current = only.doneAt ? Math.max(only.current ?? 0, only.target as number) : (only.current ?? 0);
    return { value, label: `${formatAmount(current)} of ${formatAmount(only.target)}`, done: false };
  }
  return { value, label: `${Math.round(value * 100)}%`, done: false };
}

/** The nearest not-done milestone due within `withinDays` (0 = today), for the map's hint line. */
export function nextDueMilestone<M extends Pick<Milestone, 'title' | 'dueDate' | 'doneAt'>>(
  milestones: readonly M[],
  today: string,
  daysUntil: (from: string, to: string) => number,
  withinDays = 30,
): { milestone: M; days: number } | undefined {
  let best: { milestone: M; days: number } | undefined;
  for (const m of milestones) {
    if (m.doneAt || !m.dueDate) continue;
    const days = daysUntil(today, m.dueDate);
    if (days < 0 || days > withinDays) continue;
    if (!best || days < best.days) best = { milestone: m, days };
  }
  return best;
}

export function dueHint(title: string, days: number): string {
  if (days === 0) return `${title} today.`;
  if (days === 1) return `${title} tomorrow.`;
  return `${title} in ${days} days.`;
}
