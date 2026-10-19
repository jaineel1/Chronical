/**
 * Small calendar helpers the game loop needs on top of `@/lib/dates`: day numbers for any day key,
 * Monday-based weeks, and short labels for prompts and the week grid.
 */
import { DEFAULT_ROLLOVER_HOUR, addDays, daysBetween, fromDayKey, todayKey, weekdayOf } from '@/lib/dates';

export const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const;
const MONTH_LONG = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

/** The game day a timestamp belongs to (a 1 AM timestamp belongs to the evening before). */
export function gameDayOf(iso: string, rolloverHour = DEFAULT_ROLLOVER_HOUR): string {
  return todayKey(rolloverHour, new Date(iso));
}

/** Day number of `date` in a game that started at `startedAtIso`. Day 1 is the start day. */
export function dayNoFor(startedAtIso: string, date: string, rolloverHour = DEFAULT_ROLLOVER_HOUR): number {
  return daysBetween(gameDayOf(startedAtIso, rolloverHour), date) + 1;
}

/** Monday of the week that contains `date`. */
export function mondayOf(date: string): string {
  return addDays(date, -((weekdayOf(date) + 6) % 7));
}

/** The seven day keys of the week starting at `monday`. */
export function weekDates(monday: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
}

/** 'Sat' */
export function shortWeekday(date: string): string {
  return WEEKDAY_SHORT[weekdayOf(date)] ?? '';
}

/** '12 to 18 Oct', or '28 Sep to 4 Oct' across a month boundary. */
export function formatRange(start: string, end: string): string {
  const a = fromDayKey(start);
  const b = fromDayKey(end);
  const sameMonth = a.getMonth() === b.getMonth() && a.getFullYear() === b.getFullYear();
  const left = sameMonth ? `${a.getDate()}` : `${a.getDate()} ${MONTH_SHORT[a.getMonth()]}`;
  return `${left} to ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
}

/** 'October 2026' */
export function formatMonth(date: string): string {
  const d = fromDayKey(date);
  return `${MONTH_LONG[d.getMonth()]} ${d.getFullYear()}`;
}

/** First and last day key of the month containing `date`. */
export function monthBounds(date: string): { start: string; end: string } {
  const d = fromDayKey(date);
  const start = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
  const next = new Date(d.getFullYear(), d.getMonth() + 1, 1, 12);
  next.setDate(next.getDate() - 1);
  return { start, end: addDays(start, next.getDate() - 1) };
}

/** Hours and minutes of a Date as '22:14'. */
export function clockTime(now: Date = new Date()): string {
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}
