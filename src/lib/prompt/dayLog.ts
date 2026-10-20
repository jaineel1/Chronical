/**
 * Day logs as prompt text: one compressed line per past day, and the full detail for tonight.
 * Plain text, no emoji, numbers first.
 */
import { PILLARS, PILLAR_LABEL, type DayLog, type MealSlot, type Nutrition, type Pillar } from '@/data/types';
import { formatLongDate } from '@/lib/dates';
import { shortWeekday } from '@/lib/game/calendar';
import { formatNutrition, sumNutrition } from '@/lib/nutrition';

/** 130 → "2:10". */
export function formatScreen(min: number): string {
  const m = Math.max(0, Math.round(min));
  return `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}`;
}

/** "Run, 8 km at 5:52" → "Run". Commas would break the comma-separated lists. */
export function shortRoutineName(name: string): string {
  return (name.split(',')[0] ?? name).trim() || name.trim();
}

function n1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function signed(n: number): string {
  const r = Math.round(n * 10) / 10;
  return r > 0 ? `+${n1(r)}` : r < 0 ? `-${n1(Math.abs(r))}` : '0';
}

export type LoggedDay = Partial<Omit<DayLog, 'date'>> & { date: string };

export interface CompressOptions {
  /** Game day number; the line starts "D22 Sat". Without it the line starts with the date. */
  dayNo?: number;
  /** The day's meals added up, when any meal had numbers. */
  intake?: Nutrition;
}

/** The "more of today" fields in short form, shared by past-day lines and tonight. */
function extrasParts(log: LoggedDay): string[] {
  const parts: string[] = [];
  if (typeof log.waterL === 'number') parts.push(`water ${n1(log.waterL)} L`);
  if (typeof log.steps === 'number') parts.push(`${log.steps.toLocaleString('en-IN')} steps`);
  const workout = log.workoutType?.trim();
  if (workout || typeof log.workoutMin === 'number') parts.push(`workout ${[workout, typeof log.workoutMin === 'number' ? `${log.workoutMin} min` : ''].filter(Boolean).join(' ')}`);
  if (typeof log.caffeineCups === 'number') parts.push(`caffeine ${log.caffeineCups}`);
  if (typeof log.alcoholDrinks === 'number') parts.push(`alcohol ${log.alcoholDrinks}`);
  if (typeof log.deepWorkHours === 'number') parts.push(`deep work ${n1(log.deepWorkHours)} h`);
  if (typeof log.stress === 'number') parts.push(`stress ${log.stress}`);
  return parts;
}

function intakeText(n: Nutrition): string {
  return formatNutrition(n, { grams: false }).replace(/ · P /, ' · protein ').replace(/ · C /, ' · carbs ').replace(/ · F /, ' · fat ');
}

/**
 * One line for a past day:
 * `D22 Sat · done: Gym, Run · skipped: Deep work · 72.4 kg · slept 6.5 h · mood 4 · energy 3 · screen 2:10 · felt: Tired but steady.`
 */
export function compressDayLog(log: LoggedDay, done: string[], skipped: string[], mealNames: string[], opts: CompressOptions = {}): string {
  const parts: string[] = [opts.dayNo ? `D${opts.dayNo} ${shortWeekday(log.date)}` : `${log.date} ${shortWeekday(log.date)}`];
  if (done.length) parts.push(`done: ${done.map(shortRoutineName).join(', ')}`);
  if (skipped.length) parts.push(`skipped: ${skipped.map(shortRoutineName).join(', ')}`);
  if (typeof log.weightKg === 'number') parts.push(`${n1(log.weightKg)} kg`);
  if (typeof log.sleepHours === 'number') parts.push(`slept ${n1(log.sleepHours)} h`);
  if (typeof log.mood === 'number') parts.push(`mood ${log.mood}`);
  if (typeof log.energy === 'number') parts.push(`energy ${log.energy}`);
  if (typeof log.screenMin === 'number') parts.push(`screen ${formatScreen(log.screenMin)}`);
  if (log.urgesResisted) parts.push(`urges resisted ${log.urgesResisted}`);
  if (log.scrollSessions) parts.push(`scrolls ${log.scrollSessions}`);
  if (log.phoneFreeEvening) parts.push('phone-free evening');
  parts.push(...extrasParts(log));
  if (mealNames.length) parts.push(`meals: ${mealNames.join('; ')}`);
  if (opts.intake && typeof opts.intake.kcal === 'number') parts.push(intakeText(opts.intake));
  const win = log.topWin?.trim();
  if (win) parts.push(`win: ${win}`);
  const felt = log.feltLine?.trim();
  if (felt) parts.push(`felt: ${felt}`);
  if (parts.length === 1) parts.push('nothing logged');
  return parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* Tonight                                                             */
/* ------------------------------------------------------------------ */

export type TonightRoutineStatus = 'done' | 'shielded' | 'missed' | 'extra';

export interface TonightRoutine {
  name: string;
  pillar: Pillar;
  subStat: string;
  weight: number;
  /** done; shielded (skipped, the week's shield covers it); missed (skipped, no shield); extra (done on a day off). */
  status: TonightRoutineStatus;
  /** Streak after tonight. */
  streak: number;
  /** Streak before tonight. */
  streakBefore: number;
  cost?: string;
}

export interface TonightInput {
  date: string;
  dayNo: number;
  /** Replaces the "## Tonight, Day N, …" heading (the weekly prompt uses "### Day N, …"). */
  heading?: string;
  /** A day already lived (weekly review): routines read as what the logs recorded, in the past tense. */
  past?: boolean;
  log?: LoggedDay;
  yesterday?: { weightKg?: number; sleepHours?: number; screenMin?: number };
  routines: TonightRoutine[];
  /** What the app's routine scoring gives each pillar tonight. */
  routineScore: Partial<Record<Pillar, number>>;
  meals: { slot: MealSlot; name: string; feltAfter?: number; nutrition?: Nutrition }[];
  /** Averages of the 7 days before tonight, for "Today at a glance". */
  week?: WeekAverages;
  questions: { text: string; answer?: string }[];
  lessonBook?: string;
  /** Quests the last letter set for today, with whether they were done. */
  questsToday?: { text: string; done: boolean }[];
}

export interface WeekAverages {
  sleepHours?: number;
  weightKg?: number;
  screenMin?: number;
  mood?: number;
  energy?: number;
  kcal?: number;
}

export function formatRoutineScore(score: Partial<Record<Pillar, number>>): string {
  return PILLARS.map((p) => `${PILLAR_LABEL[p]} ${signed(score[p] ?? 0)}`).join(' · ');
}

function sentence(text: string): string {
  const t = text.trim();
  return /[.?!]$/.test(t) ? t : `${t}.`;
}

function routineLine(r: TonightRoutine, past: boolean): string {
  const where = `${PILLAR_LABEL[r.pillar]}/${r.subStat}, weight ${r.weight}`;
  const cost = !past && r.cost ? ` Cost of missing: ${sentence(r.cost)}` : '';
  const run = r.streakBefore > 0 ? `${r.streakBefore}-day streak` : '';
  switch (r.status) {
    case 'done':
      return `- done: ${r.name} (${where}), streak ${r.streak}`;
    case 'extra':
      return `- done on a day off: ${r.name} (${where})`;
    case 'shielded':
      return past
        ? `- skipped: ${r.name} (${where}). A shield covered it${run ? `; the ${run} held` : ''}.`
        : `- skipped: ${r.name} (${where}). The week's shield covers it${run ? `, so the ${run} holds` : ''}, and no shield is left this week.${cost}`;
    case 'missed':
      return past
        ? `- skipped: ${r.name} (${where})${run ? `; the ${run} ended` : ''}.`
        : `- skipped: ${r.name} (${where}). No shield left this week${run ? `, so the ${run} ends` : ''}.${cost}`;
  }
}

function vsAvg(value: number, avg: number | undefined, fmt: (v: number) => string): string {
  return avg === undefined ? fmt(value) : `${fmt(value)} (7-day avg ${fmt(avg)})`;
}

/**
 * The headline of tonight in a few lines, against the last 7 days, so the reader sees what changed
 * before the detail. Sits first in the data; the full log is still at the end.
 */
export function glanceBlock(t: TonightInput): string {
  const log = t.log ?? { date: t.date };
  const w = t.week ?? {};
  const lines: string[] = [`## Today at a glance, Day ${t.dayNo}`];

  const scheduled = t.routines.filter((r) => r.status !== 'extra');
  if (scheduled.length) {
    const done = scheduled.filter((r) => r.status === 'done').length;
    const missed = t.routines.filter((r) => r.status === 'missed').map((r) => shortRoutineName(r.name));
    const shielded = t.routines.filter((r) => r.status === 'shielded').map((r) => shortRoutineName(r.name));
    lines.push(
      `Routines ${done} of ${scheduled.length} done${missed.length ? ` · missed: ${missed.join(', ')}` : ''}${shielded.length ? ` · shield used: ${shielded.join(', ')}` : ''}`,
    );
  }

  const body: string[] = [];
  if (typeof log.sleepHours === 'number') body.push(`sleep ${vsAvg(log.sleepHours, w.sleepHours, (v) => `${n1(v)} h`)}`);
  if (typeof log.weightKg === 'number') body.push(`weight ${vsAvg(log.weightKg, w.weightKg, (v) => `${n1(v)} kg`)}`);
  if (typeof log.mood === 'number') body.push(`mood ${vsAvg(log.mood, w.mood, n1)}`);
  if (typeof log.energy === 'number') body.push(`energy ${vsAvg(log.energy, w.energy, n1)}`);
  if (typeof log.screenMin === 'number') body.push(`screen ${vsAvg(log.screenMin, w.screenMin, formatScreen)}`);
  if (body.length) lines.push(body.join(' · '));

  const extras = extrasParts(log);
  if (extras.length) lines.push(extras.join(' · '));

  const { total, counted } = sumNutrition(t.meals.map((m) => m.nutrition));
  if (t.meals.length) {
    const kcal = counted ? `, ${intakeText(total)} known for ${counted} of ${t.meals.length}` : ', no numbers yet';
    const avg = w.kcal !== undefined ? ` (7-day avg ${Math.round(w.kcal).toLocaleString('en-IN')} kcal)` : '';
    lines.push(`Meals ${t.meals.length}${kcal}${avg}`);
  }

  const win = log.topWin?.trim();
  if (win) lines.push(`Top win: ${win}`);
  return lines.length > 1 ? lines.join('\n') : `${lines[0]}\nNothing logged yet tonight.`;
}

/** Everything logged tonight, in full. */
export function tonightBlock(t: TonightInput): string {
  const log = t.log ?? { date: t.date };
  const lines: string[] = [t.heading ?? `## Tonight, Day ${t.dayNo}, ${formatLongDate(t.date)}`];

  if (t.routines.length) {
    lines.push(
      t.past
        ? `Routines, app score: ${formatRoutineScore(t.routineScore)}.`
        : `Routines. The app has already scored them: ${formatRoutineScore(t.routineScore)}.`,
    );
    lines.push(...t.routines.map((r) => routineLine(r, !!t.past)));
  } else {
    lines.push('No routines yet.');
  }

  const numbers: string[] = [];
  if (typeof log.weightKg === 'number') {
    const y = t.yesterday?.weightKg;
    numbers.push(`weight ${n1(log.weightKg)} kg${typeof y === 'number' ? ` (${n1(y)} yesterday)` : ''}`);
  }
  if (typeof log.sleepHours === 'number') numbers.push(`slept ${n1(log.sleepHours)} h`);
  if (typeof log.mood === 'number') numbers.push(`mood ${log.mood} of 5`);
  if (typeof log.energy === 'number') numbers.push(`energy ${log.energy} of 5`);
  if (typeof log.screenMin === 'number') {
    const y = t.yesterday?.screenMin;
    const diff = typeof y === 'number' ? log.screenMin - y : undefined;
    const vs = diff === undefined ? '' : diff === 0 ? ' (same as yesterday)' : ` (${diff > 0 ? '+' : '-'}${Math.abs(diff)} min on yesterday)`;
    numbers.push(`screen ${formatScreen(log.screenMin)}${vs}`);
  }
  lines.push(numbers.length ? `Numbers: ${numbers.join(' · ')}` : 'Numbers: none logged tonight.');
  lines.push(
    `Urges resisted ${log.urgesResisted ?? 0} · scroll sessions ${log.scrollSessions ?? 0} · phone-free evening: ${log.phoneFreeEvening ? 'yes' : 'no'}`,
  );

  const extras = extrasParts(log);
  if (extras.length) lines.push(`More of today: ${extras.join(' · ')}`);

  if (t.meals.length) {
    lines.push(
      `Meals: ${t.meals
        .map((m) => {
          const known = formatNutrition(m.nutrition);
          const notes = [m.feltAfter ? `felt ${m.feltAfter} of 5 after` : '', known ? `known: ${known}` : ''].filter(Boolean);
          return `${m.slot} ${m.name}${notes.length ? ` (${notes.join('; ')})` : ''}`;
        })
        .join(' · ')}`,
    );
  } else {
    lines.push('Meals: none logged.');
  }

  const win = log.topWin?.trim();
  if (win) lines.push(`Top win today: ${win}`);
  const thanks = log.gratitude?.trim();
  if (thanks) lines.push(`Grateful for: ${thanks}`);

  const felt = log.feltLine?.trim();
  lines.push(felt ? `How today felt: ${felt}` : 'How today felt: not written.');

  const lesson = log.lessonApplied?.trim();
  if (lesson) lines.push(`Lesson applied${t.lessonBook ? `, from ${t.lessonBook}` : ''}: ${lesson}`);

  if (t.questsToday?.length) {
    const done = t.questsToday.filter((q) => q.done).map((q) => q.text);
    const open = t.questsToday.filter((q) => !q.done).map((q) => q.text);
    lines.push(
      `Today's quests from the last letter, ${done.length} of ${t.questsToday.length} done.${done.length ? ` Done: ${done.join('; ')}.` : ''}${open.length ? ` Not done: ${open.join('; ')}.` : ''}`,
    );
  }

  const answered = t.questions.filter((q) => q.answer?.trim());
  if (answered.length) {
    lines.push('Tonight\'s questions:');
    lines.push(...answered.map((q) => `- ${q.text} ${q.answer!.trim()}`));
  }
  return lines.join('\n');
}
