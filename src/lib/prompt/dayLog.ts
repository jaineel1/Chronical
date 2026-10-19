/**
 * Day logs as prompt text: one compressed line per past day, and the full detail for tonight.
 * Plain text, no emoji, numbers first.
 */
import { PILLARS, PILLAR_LABEL, type DayLog, type MealSlot, type Pillar } from '@/data/types';
import { formatLongDate } from '@/lib/dates';
import { shortWeekday } from '@/lib/game/calendar';

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
  if (mealNames.length) parts.push(`meals: ${mealNames.join('; ')}`);
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
  log?: LoggedDay;
  yesterday?: { weightKg?: number; sleepHours?: number; screenMin?: number };
  routines: TonightRoutine[];
  /** What the app's routine scoring gives each pillar tonight. */
  routineScore: Partial<Record<Pillar, number>>;
  meals: { slot: MealSlot; name: string; feltAfter?: number }[];
  questions: { text: string; answer?: string }[];
  lessonBook?: string;
  /** Quests the last letter set for today, with whether they were done. */
  questsToday?: { text: string; done: boolean }[];
}

export function formatRoutineScore(score: Partial<Record<Pillar, number>>): string {
  return PILLARS.map((p) => `${PILLAR_LABEL[p]} ${signed(score[p] ?? 0)}`).join(' · ');
}

function routineLine(r: TonightRoutine): string {
  const where = `${PILLAR_LABEL[r.pillar]}/${r.subStat}, weight ${r.weight}`;
  switch (r.status) {
    case 'done':
      return `- done: ${r.name} (${where}), streak ${r.streak}`;
    case 'extra':
      return `- done on a day off: ${r.name} (${where})`;
    case 'shielded':
      return `- skipped: ${r.name} (${where}). This week's shield covers it${r.streakBefore > 0 ? `, so the ${r.streakBefore}-day streak holds` : ''}; no shield left this week.${r.cost ? ` Cost of missing: ${r.cost}` : ''}`;
    case 'missed':
      return `- skipped: ${r.name} (${where}). No shield left this week${r.streakBefore > 0 ? `; the ${r.streakBefore}-day streak ends` : ''}.${r.cost ? ` Cost of missing: ${r.cost}` : ''}`;
  }
}

/** Everything logged tonight, in full. */
export function tonightBlock(t: TonightInput): string {
  const log = t.log ?? { date: t.date };
  const lines: string[] = [`## Tonight, Day ${t.dayNo}, ${formatLongDate(t.date)}`];

  if (t.routines.length) {
    lines.push(`Routines. The app has already scored them: ${formatRoutineScore(t.routineScore)}.`);
    lines.push(...t.routines.map(routineLine));
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

  if (t.meals.length) {
    lines.push(`Meals: ${t.meals.map((m) => `${m.slot} ${m.name}${m.feltAfter ? ` (felt ${m.feltAfter} of 5 after)` : ''}`).join(' · ')}`);
  } else {
    lines.push('Meals: none logged.');
  }

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
