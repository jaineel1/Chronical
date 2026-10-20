/**
 * Weekly review and monthly digest prompts. Both ask for the same sections:
 *
 *   ## DIGEST       at most 150 words, what the period was (saved as a Digest)
 *   ## STATE_OF_ME  a full rewrite, at most 400 words, keeping its four sections
 *   ## QUESTS       three for the coming week (or month)
 *   ## WARNINGS
 *   ## INSIGHTS
 *
 * The weekly prompt carries the last seven nights in full; the monthly one carries the month's
 * weekly digests and up to 30 compressed days.
 */
import { formatLongDate } from '@/lib/dates';
import { goalsBlock, stateOfMeBlock, type PromptGoal } from './nightly';
import { GAME_MASTER_PREAMBLE, RULE, VOICE_RULES, joinBlocks, section, stripMoney } from './shared';

export interface WeeklyInput {
  periodStart: string;
  periodEnd: string;
  dayNoStart: number;
  dayNoEnd: number;
  displayName: string;
  stateOfMeMd?: string;
  goals: PromptGoal[];
  /** Warnings from the week's letters and closed nights. */
  warnings: string[];
  /** One full block per night, oldest first. */
  days: string[];
  excludeMoney: boolean;
  /** Newest progress photos against the previous ones (lib/photos.ts photoProgressLine). */
  photosLine?: string;
}

export interface MonthlyInput {
  periodStart: string;
  periodEnd: string;
  /** "October 2026". */
  monthLabel: string;
  displayName: string;
  stateOfMeMd?: string;
  goals: PromptGoal[];
  warnings: string[];
  weeklyDigests: { label: string; md: string }[];
  /** Compressed day lines, oldest first, up to 30. */
  days: string[];
  excludeMoney: boolean;
}

export const MONTHLY_DAYS = 30;

function replyFormat(period: 'week' | 'month'): string {
  const next = period === 'week' ? 'the coming week' : 'the coming month';
  return `## Reply format
Reply with these five sections, with these exact headers, in this order. Nothing before the first header and nothing after the last section.

## DIGEST
At most 150 words: what this ${period} was, in numbers, and what it set up. It is kept and shown to you in later prompts, so it must stand on its own.

## STATE_OF_ME
A full rewrite of the State of Me below, at most 400 words, in this exact shape:
# State of Me
One line on who they are now.
## Where I am
## Patterns the game master has noticed
## People
## Voice
Keep what is still true, change what moved this ${period}, drop what no longer holds. Use their own names for routines, goals and people.

## QUESTS
- [Pillar] quest text | reward: real-life reward
Exactly three quests for ${next}. Pillar is one of Body, Skin, Mind, Work, Dopamine.

## WARNINGS
- What is heading the wrong way. Write "- None" if nothing is.

## INSIGHTS
- The patterns across the ${period}, with the numbers that show them.`;
}

function warningsBlock(title: string, warnings: string[]): string | undefined {
  if (!warnings.length) return undefined;
  return section(title, [...new Set(warnings)].map((w) => `- ${w}`).join('\n'));
}

export function buildWeeklyPrompt(input: WeeklyInput): string {
  const name = input.displayName.trim() || 'the player';
  const task = section(
    "This week's task",
    `This is the weekly review for Days ${input.dayNoStart} to ${input.dayNoEnd}, ${formatLongDate(input.periodStart)} to ${formatLongDate(input.periodEnd)}. Read the seven nights below, then write the week's digest, rewrite ${name}'s State of Me so next week's letters start from the truth, and set three quests for the coming week.`,
  );
  const instructions = joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, task, replyFormat('week'));
  const data = joinBlocks(
    stateOfMeBlock(input.stateOfMeMd),
    goalsBlock(input.goals),
    warningsBlock("This week's warnings", input.warnings),
    input.photosLine ? section('Progress photos', input.photosLine) : undefined,
    section('The week, night by night', input.days.length ? input.days.join('\n\n') : 'Nothing was logged this week.'),
  );
  return joinBlocks(instructions, RULE, input.excludeMoney ? stripMoney(data) : data);
}

export function buildMonthlyPrompt(input: MonthlyInput): string {
  const name = input.displayName.trim() || 'the player';
  const task = section(
    "This month's task",
    `This is the monthly digest for ${input.monthLabel}, ${formatLongDate(input.periodStart)} to ${formatLongDate(input.periodEnd)}. Read the weekly digests and the daily lines below, then write the month's digest, rewrite ${name}'s State of Me, and set three quests for the coming month.`,
  );
  const instructions = joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, task, replyFormat('month'));
  const digests = input.weeklyDigests.length
    ? input.weeklyDigests.map((d) => `### ${d.label}\n${d.md.trim()}`).join('\n\n')
    : 'No weekly reviews this month.';
  const data = joinBlocks(
    stateOfMeBlock(input.stateOfMeMd),
    goalsBlock(input.goals),
    section('Weekly digests', digests),
    warningsBlock("This month's warnings", input.warnings),
    section(`The month, day by day (${input.days.length})`, input.days.length ? input.days.slice(-MONTHLY_DAYS).join('\n') : 'Nothing was logged this month.'),
  );
  return joinBlocks(instructions, RULE, input.excludeMoney ? stripMoney(data) : data);
}
