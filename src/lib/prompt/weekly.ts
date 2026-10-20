/**
 * Weekly review and monthly digest prompts. Both ask for the same sections:
 *
 *   ## DIGEST       at most 150 words, what the period was (saved as a Digest)
 *   ## STATE_OF_ME  a full rewrite, at most 400 words, keeping its four sections
 *   ## QUESTS       three for the coming week (or month)
 *   ## WARNINGS
 *   ## INSIGHTS
 *   ## BOSS         weekly only, when the player has routines: one boss for the coming week
 *
 * The weekly prompt carries the last seven nights in full; the monthly one carries the month's
 * weekly digests and up to 30 compressed days.
 */
import { PILLAR_LABEL, type Pillar, type WebEdge, type WebNode } from '@/data/types';
import { formatLongDate } from '@/lib/dates';
import { BOSS_HP_SHARE } from '@/lib/game/boss';
import { webExcerpt } from '@/lib/web/excerpt';
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
  /** Asks for a ## BOSS for the coming week. Left out (or no routines) → no boss section. */
  boss?: WeeklyBossInput;
  /** The mind web; the prompt shows a short excerpt of it. */
  web?: { nodes: WebNode[]; edges: WebEdge[] };
  /** How many rant and life notes the week has. */
  notesCount?: { rant: number; life: number };
}

/** The weekly prompt's web excerpt is smaller than the nightly one. */
export const WEEKLY_WEB_TOKENS = 1_200;

export interface BossPromptRoutine {
  name: string;
  pillar: Pillar;
  weight: number;
  /** Days it is scheduled in the boss's week. */
  scheduledDays: number;
}

export interface WeeklyBossInput {
  /** The boss's week: the seven days after the period (lib/game/boss.ts bossWeek). */
  start: string;
  end: string;
  routines: BossPromptRoutine[];
  /** Current pillar levels, any order. */
  pillarLevels: { pillar: Pillar; level: number }[];
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

function replyFormat(period: 'week' | 'month', boss = false): string {
  const next = period === 'week' ? 'the coming week' : 'the coming month';
  return `## Reply format
Reply with these ${boss ? 'six' : 'five'} sections, with these exact headers, in this order. Nothing before the first header and nothing after the last section.

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
- The patterns across the ${period}, with the numbers that show them.${boss ? `\n\n${BOSS_FORMAT}` : ''}`;
}

const BOSS_PCT = Math.round(BOSS_HP_SHARE * 100);

const BOSS_FORMAT = `## BOSS
Name: the boss's name, like "The Late-Night Scroll"
Pillar: one of Body, Skin, Mind, Work, Dopamine
HP: a whole number
Weak to: routine names, comma-separated
Reward: a real-life reward, like the quests use
Taunt: one line in your voice
One boss for the coming week, built from their real data: their weakest pillar or a pattern from this week's nights. Weak to: one to three routines from "Routines that can hit the boss", their exact names. Each time a weak-to routine is logged done during the boss's week it deals its weight in damage. HP: about ${BOSS_PCT}% of the full-week damage of the weak-to routines added together, rounded, so a good week beats it and a lazy one does not.`;

function bossBlock(boss: WeeklyBossInput): string {
  const levels = [...boss.pillarLevels].sort((a, b) => a.level - b.level);
  const weakest = levels[0];
  const pillarLines = levels.map((p) => `- ${PILLAR_LABEL[p.pillar]} level ${p.level.toFixed(1)}${p === weakest ? ' (weakest)' : ''}`);
  const routineLines = boss.routines.map((r) => {
    const days = r.scheduledDays === 1 ? '1 day' : `${r.scheduledDays} days`;
    return `- ${r.name} (${PILLAR_LABEL[r.pillar]}): weight ${r.weight}, scheduled ${days}, full-week damage ${r.weight * r.scheduledDays}`;
  });
  return joinBlocks(
    section(
      `The boss's week, ${formatLongDate(boss.start)} to ${formatLongDate(boss.end)}`,
      levels.length ? `Pillar levels now:\n${pillarLines.join('\n')}` : 'No pillar levels yet.',
    ),
    section('Routines that can hit the boss', routineLines.join('\n')),
  );
}

function warningsBlock(title: string, warnings: string[]): string | undefined {
  if (!warnings.length) return undefined;
  return section(title, [...new Set(warnings)].map((w) => `- ${w}`).join('\n'));
}

function notesCountLine({ rant, life }: { rant: number; life: number }): string {
  const total = rant + life;
  if (!total) return 'No notes written this week.';
  return `${total} ${total === 1 ? 'note' : 'notes'} written during the days: ${rant} ${rant === 1 ? 'rant' : 'rants'}, ${life} ${life === 1 ? 'life line' : 'life lines'}.`;
}

export function buildWeeklyPrompt(input: WeeklyInput): string {
  const name = input.displayName.trim() || 'the player';
  const boss = input.boss && input.boss.routines.length ? input.boss : undefined;
  const task = section(
    "This week's task",
    `This is the weekly review for Days ${input.dayNoStart} to ${input.dayNoEnd}, ${formatLongDate(input.periodStart)} to ${formatLongDate(input.periodEnd)}. Read the seven nights below, then write the week's digest, rewrite ${name}'s State of Me so next week's letters start from the truth, and set three quests${boss ? ' and one boss' : ''} for the coming week.`,
  );
  const instructions = joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, task, replyFormat('week', !!boss));
  const data = joinBlocks(
    stateOfMeBlock(input.stateOfMeMd),
    goalsBlock(input.goals),
    warningsBlock("This week's warnings", input.warnings),
    input.photosLine ? section('Progress photos', input.photosLine) : undefined,
    input.notesCount ? section('Notes this week', notesCountLine(input.notesCount)) : undefined,
    input.web ? webExcerpt(input.web.nodes, input.web.edges, { maxTokens: WEEKLY_WEB_TOKENS }) : undefined,
    boss ? bossBlock(boss) : undefined,
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
