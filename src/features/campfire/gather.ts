/**
 * Reads everything the nightly, weekly and monthly prompts need. Read-only, so each gatherer can
 * run inside `useLiveQuery` and the Campfire prompt stays live while the player logs.
 */
import { db } from '@/data/db';
import {
  DEFAULT_SETTINGS,
  PILLARS,
  type Book,
  type DayLog,
  type Digest,
  type Food,
  type Goal,
  type Lesson,
  type Meal,
  type MealSlot,
  type Milestone,
  type Nutrition,
  type Person,
  type Profile,
  type Routine,
  type RoutineLog,
  type Skill,
} from '@/data/types';
import { addDays, daysBetween, formatLongDate, nowIso, weekdayOf } from '@/lib/dates';
import { dayNoFor, formatMonth, formatRange, monthBounds } from '@/lib/game/calendar';
import { computeRoutineStats, existedOn, isScheduled, pillarTotals } from '@/lib/game/daily';
import { planClose, streakFromLogs } from '@/lib/game/streaks';
import { isPeriodQuest, isPeriodWarning } from '@/lib/parse/weekly';
import { compressDayLog, shortRoutineName, tonightBlock, type TonightInput, type TonightRoutine, type WeekAverages } from '@/lib/prompt/dayLog';
import { sumNutrition } from '@/lib/nutrition';
import { photoProgressLine } from '@/lib/photos';
import { DEEP_DAYS } from '@/lib/prompt/deep';
import type { NightlyInput, PromptGoal } from '@/lib/prompt/nightly';
import { MONTHLY_DAYS, type MonthlyInput, type WeeklyInput } from '@/lib/prompt/weekly';
import { questionsFor } from './questions';

const SLOT_ORDER: Record<MealSlot, number> = { breakfast: 0, lunch: 1, dinner: 2, snack: 3 };
const MAX_QUIET_PEOPLE = 6;
const MAX_MONTH_DIGESTS = 6;

interface World {
  profile: Profile | undefined;
  rollover: number;
  startedAt: string;
  routines: Routine[];
  routineLogs: RoutineLog[];
  logsByDate: Map<string, RoutineLog[]>;
  logsByRoutine: Map<string, RoutineLog[]>;
  earliestLog: Map<string, string>;
  dayLogs: Map<string, DayLog>;
  meals: Map<string, Meal[]>;
  foods: Map<string, Food>;
  goals: Goal[];
  milestones: Milestone[];
  people: Person[];
  books: Book[];
  lessons: Lesson[];
  skills: Skill[];
  digests: Digest[];
}

function groupBy<T>(rows: T[], key: (row: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const k = key(row);
    const list = out.get(k);
    if (list) list.push(row);
    else out.set(k, [row]);
  }
  return out;
}

/** Day logs and meals from `from` to `to` (inclusive), everything else in full. */
async function loadWorld(from: string, to: string): Promise<World> {
  const profile = await db.profile.get('me');
  const settings = profile?.settings ?? DEFAULT_SETTINGS;
  const routines = (await db.routines.toArray()).filter((r) => !r.archived).sort((a, b) => a.sortOrder - b.sortOrder);
  const ids = routines.map((r) => r.id);
  const [routineLogs, dayLogs, meals, foods, goals, milestones, people, books, lessons, skills, digests] = await Promise.all([
    ids.length ? db.routineLogs.where('routineId').anyOf(ids).toArray() : Promise.resolve([] as RoutineLog[]),
    db.dayLogs.where('date').between(from, to, true, true).toArray(),
    db.meals.where('date').between(from, to, true, true).toArray(),
    db.foods.toArray(),
    db.goals.toArray(),
    db.milestones.toArray(),
    db.people.toArray(),
    db.books.toArray(),
    db.lessons.toArray(),
    db.skills.toArray(),
    db.digests.toArray(),
  ]);
  const earliestLog = new Map<string, string>();
  for (const l of routineLogs) {
    const e = earliestLog.get(l.routineId);
    if (!e || l.date < e) earliestLog.set(l.routineId, l.date);
  }
  return {
    profile,
    rollover: settings.rolloverHour,
    startedAt: profile?.startedAt ?? nowIso(),
    routines,
    routineLogs,
    logsByDate: groupBy(routineLogs, (l) => l.date),
    logsByRoutine: groupBy(routineLogs, (l) => l.routineId),
    earliestLog,
    dayLogs: new Map(dayLogs.map((d) => [d.date, d])),
    meals: groupBy(meals, (m) => m.date),
    foods: new Map(foods.map((f) => [f.id, f])),
    goals,
    milestones,
    people,
    books,
    lessons,
    skills: [...skills].sort((a, b) => a.sortOrder - b.sortOrder),
    digests,
  };
}

/* ------------------------------------------------------------------ */
/* Per-day pieces                                                      */
/* ------------------------------------------------------------------ */

function dayNo(world: World, date: string): number {
  return dayNoFor(world.startedAt, date, world.rollover);
}

function mealsOn(world: World, date: string): { slot: MealSlot; name: string; feltAfter?: number; nutrition?: Nutrition }[] {
  return [...(world.meals.get(date) ?? [])]
    .sort((a, b) => SLOT_ORDER[a.slot] - SLOT_ORDER[b.slot] || a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({ slot: m.slot, name: world.foods.get(m.foodId)?.name ?? 'something', feltAfter: m.feltAfter, nutrition: m.nutrition }));
}

function mean(values: (number | undefined)[]): number | undefined {
  const nums = values.filter((v): v is number => typeof v === 'number');
  return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : undefined;
}

/** Averages of the 7 days before `date`, over the days that logged each number. */
function weekBefore(world: World, date: string): WeekAverages {
  const days = datesBetween(addDays(date, -7), addDays(date, -1));
  const logs = days.map((d) => world.dayLogs.get(d));
  const kcal = days.map((d) => {
    const { total, counted } = sumNutrition(mealsOn(world, d).map((m) => m.nutrition));
    return counted ? total.kcal : undefined;
  });
  return {
    sleepHours: mean(logs.map((l) => l?.sleepHours)),
    weightKg: mean(logs.map((l) => l?.weightKg)),
    screenMin: mean(logs.map((l) => l?.screenMin)),
    mood: mean(logs.map((l) => l?.mood)),
    energy: mean(logs.map((l) => l?.energy)),
    kcal: mean(kcal),
  };
}

/** Done and skipped routine names for a past day, shield-covered skips marked. */
function routineDay(world: World, date: string): { done: string[]; skipped: string[] } {
  const logs = new Map((world.logsByDate.get(date) ?? []).map((l) => [l.routineId, l]));
  const weekday = weekdayOf(date);
  const done: string[] = [];
  const skipped: string[] = [];
  for (const r of world.routines) {
    const log = logs.get(r.id);
    if (log?.done) done.push(shortRoutineName(r.name));
    else if (isScheduled(r, weekday) && existedOn(r, date, world.rollover, world.earliestLog.get(r.id))) {
      skipped.push(`${shortRoutineName(r.name)}${log?.shielded ? ' (shield)' : ''}`);
    }
  }
  return { done, skipped };
}

function compressedLine(world: World, date: string): string | undefined {
  const n = dayNo(world, date);
  if (n < 1) return undefined;
  const { done, skipped } = routineDay(world, date);
  const meals = mealsOn(world, date);
  const { total, counted } = sumNutrition(meals.map((m) => m.nutrition));
  return compressDayLog(
    world.dayLogs.get(date) ?? { date },
    done,
    skipped,
    meals.map((m) => m.name),
    { dayNo: n, intake: counted ? total : undefined },
  );
}

/** The quests the most recent letter before `date` set for that day. */
function questsFor(world: World, date: string): { text: string; done: boolean }[] | undefined {
  const source = [...world.dayLogs.values()]
    .filter((d) => d.date < date && d.briefMd)
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  if (!source || daysBetween(source.date, date) > 1) return undefined;
  const quests = source.quests.filter((q) => !isPeriodQuest(q));
  return quests.length ? quests.map((q) => ({ text: q.text, done: q.done })) : undefined;
}

/** Tonight: what closing the night will do (shields included), so the prompt matches the close. */
function previewRoutines(world: World, date: string): { routines: TonightRoutine[]; score: TonightInput['routineScore'] } {
  const plan = planClose(world.routines, world.routineLogs, date, world.rollover);
  const routines: TonightRoutine[] = [];
  for (const o of plan.outcomes) {
    if (o.status === 'off') continue;
    routines.push({
      name: o.routine.name,
      pillar: o.routine.pillar,
      subStat: o.routine.subStat,
      weight: o.routine.weight,
      status: o.status === 'done' && !o.scheduled ? 'extra' : o.status,
      streak: o.streak,
      streakBefore: o.streakBefore,
      cost: o.routine.cost || undefined,
    });
  }
  return { routines, score: pillarTotals(plan.routineStats) };
}

/** A day already lived: exactly what its logs recorded, nothing simulated. */
function recordedRoutines(world: World, date: string): { routines: TonightRoutine[]; score: TonightInput['routineScore'] } {
  const weekday = weekdayOf(date);
  const logs = new Map((world.logsByDate.get(date) ?? []).map((l) => [l.routineId, l]));
  const routines: TonightRoutine[] = [];
  for (const r of world.routines) {
    const log = logs.get(r.id);
    const scheduled = isScheduled(r, weekday);
    if (!log && !existedOn(r, date, world.rollover, world.earliestLog.get(r.id))) continue;
    if (!log?.done && !scheduled) continue;
    const own = world.logsByRoutine.get(r.id) ?? [];
    routines.push({
      name: r.name,
      pillar: r.pillar,
      subStat: r.subStat,
      weight: r.weight,
      status: log?.done ? (scheduled ? 'done' : 'extra') : log?.shielded ? 'shielded' : 'missed',
      streak: streakFromLogs(r, own, date),
      streakBefore: streakFromLogs(r, own, addDays(date, -1)),
    });
  }
  return { routines, score: pillarTotals(computeRoutineStats(world.routines, world.logsByDate.get(date) ?? [], date, world.rollover)) };
}

function tonightFor(world: World, date: string, opts: { heading?: string; past?: boolean } = {}): TonightInput {
  const { routines, score } = opts.past ? recordedRoutines(world, date) : previewRoutines(world, date);
  const log = world.dayLogs.get(date);
  const yesterday = world.dayLogs.get(addDays(date, -1));
  const n = dayNo(world, date);
  return {
    date,
    dayNo: n,
    heading: opts.heading,
    past: opts.past,
    log: log ?? { date },
    yesterday: yesterday ? { weightKg: yesterday.weightKg, sleepHours: yesterday.sleepHours, screenMin: yesterday.screenMin } : undefined,
    routines,
    routineScore: score,
    meals: mealsOn(world, date),
    week: opts.past ? undefined : weekBefore(world, date),
    questions: questionsFor(n).map((q) => ({ text: q.text, answer: log?.answers?.[q.id] })),
    lessonBook: log?.lessonBookId ? world.books.find((b) => b.id === log.lessonBookId)?.title : undefined,
    questsToday: questsFor(world, date),
  };
}

function promptGoals(world: World): PromptGoal[] {
  return [...world.goals]
    .sort((a, b) => PILLARS.indexOf(a.pillar) - PILLARS.indexOf(b.pillar) || a.createdAt.localeCompare(b.createdAt))
    .map((g) => ({
      title: g.title,
      pillar: g.pillar,
      status: g.status,
      targetDate: g.targetDate,
      milestones: world.milestones
        .filter((m) => m.goalId === g.id)
        .map((m) => ({ title: m.title, current: m.current, target: m.target, unit: m.unit, done: !!m.doneAt })),
    }));
}

function quietPeople(world: World, date: string): NightlyInput['quietPeople'] {
  return world.people
    .filter((p) => p.lastContact && p.contactEveryDays > 0)
    .map((p) => ({ name: p.name, daysQuiet: Math.max(0, daysBetween(p.lastContact!.slice(0, 10), date)), everyDays: p.contactEveryDays, wantCloser: p.wantCloser }))
    .filter((p) => p.daysQuiet > p.everyDays)
    .sort((a, b) => b.daysQuiet / b.everyDays - a.daysQuiet / a.everyDays)
    .slice(0, MAX_QUIET_PEOPLE);
}

function warningsIn(world: World, dates: string[]): string[] {
  const out: string[] = [];
  for (const d of dates) {
    const log = world.dayLogs.get(d);
    if (!log) continue;
    out.push(...log.warnings.filter((w) => !isPeriodWarning(w)));
    if (log.closedAt) out.push(...planClose(world.routines, world.routineLogs, d, world.rollover).warnings);
  }
  return [...new Set(out)];
}

function datesBetween(start: string, end: string): string[] {
  const out: string[] = [];
  for (let d = start; d <= end && out.length < 400; d = addDays(d, 1)) out.push(d);
  return out;
}

/* ------------------------------------------------------------------ */
/* Gatherers                                                           */
/* ------------------------------------------------------------------ */

export async function gatherNightlyInput(date: string): Promise<NightlyInput> {
  const world = await loadWorld(addDays(date, -DEEP_DAYS - 1), date);
  const settings = world.profile?.settings ?? DEFAULT_SETTINGS;
  const pastDays = datesBetween(addDays(date, -DEEP_DAYS), addDays(date, -1))
    .map((d) => compressedLine(world, d))
    .filter((l): l is string => !!l);
  const monthDigests = world.digests
    .filter((d) => d.kind === 'monthly' && d.periodEnd < date)
    .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
    .slice(-MAX_MONTH_DIGESTS)
    .map((d) => ({ label: formatMonth(d.periodStart), md: d.md }));

  return {
    date,
    dayNo: dayNo(world, date),
    displayName: world.profile?.displayName ?? '',
    deepMode: settings.deepMode,
    excludeMoney: settings.excludeMoney,
    stateOfMeMd: world.profile?.stateOfMeMd,
    originSheetMd: world.profile?.originSheetMd,
    goals: promptGoals(world),
    quietPeople: quietPeople(world, date),
    reading: world.books
      .filter((b) => b.status === 'reading')
      .map((b) => ({ title: b.title, author: b.author, lessons: world.lessons.filter((l) => l.bookId === b.id).map((l) => l.text) })),
    skills: world.skills.map((s) => ({ name: s.name, level: s.level })),
    monthDigests,
    pastDays,
    tonight: tonightFor(world, date),
  };
}

/** The seven nights ending on `endDate`, in full. */
export async function gatherWeeklyInput(endDate: string): Promise<WeeklyInput> {
  const start = addDays(endDate, -6);
  const world = await loadWorld(addDays(start, -2), endDate);
  const dates = datesBetween(start, endDate).filter((d) => dayNo(world, d) >= 1);
  return {
    periodStart: start,
    periodEnd: endDate,
    dayNoStart: dayNo(world, start),
    dayNoEnd: dayNo(world, endDate),
    displayName: world.profile?.displayName ?? '',
    stateOfMeMd: world.profile?.stateOfMeMd,
    goals: promptGoals(world),
    warnings: warningsIn(world, dates),
    // Tonight may still be open; every earlier night is described as recorded.
    days: dates.map((d) =>
      tonightBlock(tonightFor(world, d, { heading: `### Day ${dayNo(world, d)}, ${formatLongDate(d)}`, past: d < endDate || !!world.dayLogs.get(d)?.closedAt })),
    ),
    excludeMoney: (world.profile?.settings ?? DEFAULT_SETTINGS).excludeMoney,
    photosLine: photoProgressLine(await db.photos.where('date').belowOrEqual(endDate).toArray()),
  };
}

/** The month a digest covers: the previous month on the 1st to 3rd, otherwise this month so far. */
export function monthPeriod(today: string): { start: string; end: string } {
  const bounds = monthBounds(today);
  if (Number(today.slice(8, 10)) <= 3) return monthBounds(addDays(bounds.start, -1));
  return { start: bounds.start, end: today };
}

export async function gatherMonthlyInput(today: string): Promise<MonthlyInput> {
  const { start, end } = monthPeriod(today);
  const world = await loadWorld(addDays(start, -1), end);
  const dates = datesBetween(start, end);
  return {
    periodStart: start,
    periodEnd: end,
    monthLabel: formatMonth(start),
    displayName: world.profile?.displayName ?? '',
    stateOfMeMd: world.profile?.stateOfMeMd,
    goals: promptGoals(world),
    warnings: warningsIn(world, dates),
    weeklyDigests: world.digests
      .filter((d) => d.kind === 'weekly' && d.periodEnd >= start && d.periodEnd <= end)
      .sort((a, b) => a.periodStart.localeCompare(b.periodStart))
      .map((d) => ({ label: formatRange(d.periodStart, d.periodEnd), md: d.md })),
    days: dates
      .map((d) => compressedLine(world, d))
      .filter((l): l is string => !!l)
      .slice(-MONTHLY_DAYS),
    excludeMoney: (world.profile?.settings ?? DEFAULT_SETTINGS).excludeMoney,
  };
}

/** Names from the player's own log, so affirmations that use them are not flagged as generic. */
export async function gatherKnownNouns(): Promise<string[]> {
  const [routines, goals, skills, people, books] = await Promise.all([
    db.routines.toArray(),
    db.goals.toArray(),
    db.skills.toArray(),
    db.people.toArray(),
    db.books.toArray(),
  ]);
  const nouns = new Set<string>();
  for (const r of routines) {
    if (r.archived) continue;
    nouns.add(r.name.trim());
    nouns.add(shortRoutineName(r.name));
  }
  for (const g of goals) nouns.add(g.title.trim());
  for (const s of skills) nouns.add(s.name.trim());
  for (const p of people) nouns.add(p.name.trim());
  for (const b of books) nouns.add(b.title.trim());
  return [...nouns].filter((n) => n.length >= 3);
}
