/**
 * The nightly prompt: rules, the task, the exact reply format, then `---` and the data
 * (State of Me, goals, quiet people, books, skills, month digests, the last 14 days compressed,
 * tonight in full). Deep mode adds the Origin Sheet and up to 90 days.
 *
 * Pure: `gatherNightlyInput` (src/features/campfire/gather.ts) reads the store and builds the input.
 */
import { PILLARS, PILLAR_LABEL, SUBSTATS, type GoalStatus, type Pillar } from '@/data/types';
import { formatLongDate } from '@/lib/dates';
import { DEEP_DAYS, buildDeepBlock } from './deep';
import { formatRoutineScore, glanceBlock, tonightBlock, type TonightInput } from './dayLog';
import { GAME_MASTER_PREAMBLE, RULE, VOICE_RULES, estimateTokens, joinBlocks, section, stripMoney } from './shared';

export const RECENT_DAYS = 14;
export const NIGHTLY_TOKEN_BUDGET = 10_000;
export const DEEP_TOKEN_BUDGET = 35_000;

export interface PromptMilestone {
  title: string;
  current?: number;
  target?: number;
  unit?: string;
  done: boolean;
}

export interface PromptGoal {
  title: string;
  pillar: Pillar;
  status: GoalStatus;
  targetDate?: string;
  milestones: PromptMilestone[];
}

export interface NightlyInput {
  date: string;
  dayNo: number;
  displayName: string;
  deepMode: boolean;
  excludeMoney: boolean;
  stateOfMeMd?: string;
  originSheetMd?: string;
  goals: PromptGoal[];
  quietPeople: { name: string; daysQuiet: number; everyDays: number; wantCloser: boolean }[];
  reading: { title: string; author?: string; lessons: string[] }[];
  skills: { name: string; level: number }[];
  monthDigests: { label: string; md: string }[];
  /** Compressed lines for the days before tonight, oldest first (up to 90). */
  pastDays: string[];
  tonight: TonightInput;
}

/* ------------------------------------------------------------------ */
/* Shared blocks (the weekly and monthly prompts use these too)        */
/* ------------------------------------------------------------------ */

function n1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function milestoneText(m: PromptMilestone): string {
  if (m.done) return `${m.title} (done)`;
  if (typeof m.current === 'number' && typeof m.target === 'number') return `${m.title} (${n1(m.current)} of ${n1(m.target)}${m.unit ? ` ${m.unit}` : ''})`;
  return m.title;
}

/** One line per active goal with its milestones. */
export function goalsBlock(goals: PromptGoal[]): string {
  const active = goals.filter((g) => g.status === 'active');
  if (!active.length) return section('Goals', 'No goals yet.');
  const lines = active.map((g) => {
    const by = g.targetDate ? `, by ${formatLongDate(g.targetDate)}` : '';
    const ms = g.milestones.length ? `: ${g.milestones.map(milestoneText).join('; ')}` : '';
    return `- [${PILLAR_LABEL[g.pillar]}] ${g.title}${by}${ms}`;
  });
  return section('Goals', lines.join('\n'));
}

export function stateOfMeBlock(md: string | undefined): string {
  const body = md?.trim();
  if (!body) return '# State of Me\nNot written yet. The first weekly review writes it; until then, read the log and the Origin Sheet.';
  return /^#\s/.test(body) ? body : `# State of Me\n${body}`;
}

function subStatList(): string {
  return PILLARS.map((p) => `${PILLAR_LABEL[p]}: ${SUBSTATS[p].join(', ')}`).join('. ') + '.';
}

/* ------------------------------------------------------------------ */
/* Instructions                                                        */
/* ------------------------------------------------------------------ */

function nightlyTask(input: NightlyInput): string {
  const name = input.displayName.trim() || 'the player';
  const deep = input.deepMode
    ? '\n\nTonight is a deep night: you also have the Origin Sheet and up to 90 days of logs. Look for the longer patterns, and say which ones you see.'
    : '';
  return section(
    "Tonight's task",
    `It is the end of Day ${input.dayNo}, ${formatLongDate(input.date)}. Write ${name}'s letter for tomorrow morning and set up the day: three quests, your stat adjustments, warnings, one pattern, one lesson, the numbers for each meal, a short recap, and a routine only if one is clearly missing.

Read "Today at a glance" first: it has tonight against the last 7 days. The full log for tonight is at the end, after the history.

The app has already scored tonight's routines (a done routine earns its weight, a scheduled skip costs half of it, one shield a week covers a miss, and a pillar never loses more than 5 in a night): ${formatRoutineScore(input.tonight.routineScore)}. Do not score the routines again. Your STATS are judgment calls on top of that: effort beyond the routines, honesty in the log, numbers trending the right or the wrong way.${deep}`,
  );
}

function replyFormat(input: NightlyInput): string {
  const books = input.reading.map((b) => b.title);
  const lesson = books.length
    ? `One sentence that applies a lesson from a book they are reading (${books.join(', ')}) to tomorrow, starting "From <book title>:".`
    : 'One sentence that applies a lesson to tomorrow, from a book they have read or from their own log, starting "From <source>:".';
  const skills = input.skills.length ? input.skills.map((s) => `${s.name} ${n1(s.level)}`).join(', ') : 'none yet';
  return `## Reply format
Reply with these ten sections, with these exact headers, in this order. Nothing before the first header and nothing after the last section.

## BRIEF
The morning letter, 150 to 400 words, in plain paragraphs (no lists, no headers). Start with what happened today, use the numbers from tonight's log, say what it builds or what it costs, and end on what tomorrow is for.

## AFFIRMATIONS
- Exactly two lines. Each must contain a number or a name from the log (a routine, goal, skill, person or book). Nothing that could be said to anyone.

## QUESTS
- [Pillar] quest text | reward: real-life reward
Exactly three lines in that shape. Pillar is one of Body, Skin, Mind, Work, Dopamine. Each quest fits in tomorrow. The reward is what it buys in real life (a date that holds, a person who hears from them), not points.

## STATS
Body +2
One line per pillar you adjust, from -3 to +3, on top of the routine scores. You may add sub-stat lines such as Body/Endurance +1. Rank a skill only when tonight earned it, as Name A -> B, for example Running 62 -> 63. Leave out anything that does not move.

## WARNINGS
- Streaks at risk, numbers heading the wrong way, a person going quiet. Write "- None" if nothing is at risk.

## INSIGHTS
- One pattern across the last two weeks, with the numbers that show it.

## LESSON
${lesson}

## MEALS
- Breakfast | Oats with banana | 250 g | 380 kcal | P 12 g | C 60 g | F 8 g
One line per meal in tonight's log, in that shape, with the meal name exactly as logged. Where a meal says "known", copy those numbers; otherwise estimate a typical portion for that meal. Write "- None" if no meals were logged.

## SUMMARY
Two or three plain sentences recapping today in numbers: what was done, what slipped, the intake. No advice.

## ROUTINE
- Name | Pillar | SubStat | weight 1-5 | days | window | upside | cost
At most one new routine, and only when the last two weeks show a clear need that no current routine covers; otherwise write "- None". SubStat is one of that pillar's sub-stats below. weight: 1 takes two minutes, 3 is a real block of time, 5 is the hardest thing in their week. days: daily, weekdays, or a list such as Mon,Wed,Fri. window: HH:MM-HH:MM in 24-hour time, or none. Start small: something they can keep in a bad week.

Sub-stats you can use in STATS: ${subStatList()}
Skills you can rank (1 to 100): ${skills}.`;
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

function peopleBlock(people: NightlyInput['quietPeople']): string | undefined {
  if (!people.length) return undefined;
  const lines = people.map(
    (p) => `- ${p.name}: ${p.daysQuiet} ${p.daysQuiet === 1 ? 'day' : 'days'} quiet (usually every ${p.everyDays})${p.wantCloser ? ', wants to be closer' : ''}`,
  );
  return section('People going quiet', lines.join('\n'));
}

function readingBlock(reading: NightlyInput['reading']): string | undefined {
  if (!reading.length) return undefined;
  const lines = reading.map((b) => {
    const by = b.author ? ` by ${b.author}` : '';
    const lessons = b.lessons.length ? ` Lessons so far: ${b.lessons.join(' / ')}` : '';
    return `- ${b.title}${by}.${lessons}`;
  });
  return section('Reading now', lines.join('\n'));
}

function skillsBlock(skills: NightlyInput['skills']): string | undefined {
  if (!skills.length) return undefined;
  return section('Skills, 1 to 100', skills.map((s) => `${s.name} ${n1(s.level)}`).join(' · '));
}

function digestsBlock(digests: NightlyInput['monthDigests']): string | undefined {
  if (!digests.length) return undefined;
  return section('Month digests', digests.map((d) => `### ${d.label}\n${d.md.trim()}`).join('\n\n'));
}

interface DataParts {
  recent: string[];
  older: string[];
  origin?: string;
}

function dataHalf(input: NightlyInput, parts: DataParts): string {
  return joinBlocks(
    glanceBlock(input.tonight),
    stateOfMeBlock(input.stateOfMeMd),
    goalsBlock(input.goals),
    peopleBlock(input.quietPeople),
    readingBlock(input.reading),
    skillsBlock(input.skills),
    digestsBlock(input.monthDigests),
    parts.origin || parts.older.length ? buildDeepBlock({ originSheetMd: parts.origin, olderDays: parts.older }) : undefined,
    section(`Last ${parts.recent.length} ${parts.recent.length === 1 ? 'day' : 'days'}, oldest first`, parts.recent.length ? parts.recent.join('\n') : 'No earlier days logged yet.'),
    tonightBlock(input.tonight),
  );
}

/**
 * Build the nightly prompt. Stays under ~10k tokens (~35k in deep mode): the oldest compressed
 * days go first, then the Origin Sheet is shortened, and only then do the last 14 days shrink.
 */
export function buildNightlyPrompt(input: NightlyInput): string {
  const budget = input.deepMode ? DEEP_TOKEN_BUDGET : NIGHTLY_TOKEN_BUDGET;
  const instructions = joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, nightlyTask(input), replyFormat(input));
  const window = input.pastDays.slice(-(input.deepMode ? DEEP_DAYS : RECENT_DAYS));
  // Without a State of Me yet, the Origin Sheet is the only picture of the player, so it comes along.
  const wantsOrigin = input.deepMode || !input.stateOfMeMd?.trim();
  const parts: DataParts = {
    recent: window.slice(-RECENT_DAYS),
    older: window.slice(0, Math.max(0, window.length - RECENT_DAYS)),
    origin: wantsOrigin ? input.originSheetMd?.trim() || undefined : undefined,
  };

  const build = () => {
    const data = dataHalf(input, parts);
    return joinBlocks(instructions, RULE, input.excludeMoney ? stripMoney(data) : data);
  };

  let md = build();
  const over = () => estimateTokens(md) > budget;
  while (over() && parts.older.length) {
    parts.older = parts.older.slice(1);
    md = build();
  }
  if (over() && parts.origin) {
    const overChars = (estimateTokens(md) - budget) * 4 + 200;
    const kept = parts.origin.slice(0, Math.max(0, parts.origin.length - overChars)).trim();
    parts.origin = kept ? `${kept}\n\n(The rest of the Origin Sheet was left out to keep this prompt short.)` : undefined;
    md = build();
  }
  while (over() && parts.recent.length) {
    parts.recent = parts.recent.slice(1);
    md = build();
  }
  return md;
}
