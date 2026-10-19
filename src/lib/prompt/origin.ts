/**
 * The Day 0 prompt: Claude reads the whole Origin Sheet and sets up the game. Its reply is read
 * by `parseOriginReply` (src/lib/parse/origin.ts); the headers and line formats here are that
 * parser's contract, so change them together.
 */
import { PILLARS, PILLAR_LABEL, SUBSTATS } from '@/data/types';
import { formatSheetDate } from '@/lib/compile/originSheet';
import { GAME_MASTER_PREAMBLE, RULE, VOICE_RULES, joinBlocks, stripMoney } from './shared';

export interface OriginPromptInput {
  displayName: string;
  originSheetMd: string;
  /** Day key 'YYYY-MM-DD' of the day the sheet was finished. */
  today: string;
  /** settings.excludeMoney: strip amounts from the sheet and keep money out of the reply. */
  excludeMoney?: boolean;
}

/** The six reply headers, in the order Claude is asked to write them. */
export const ORIGIN_REPLY_HEADERS = ['STATE_OF_ME', 'SKILLS', 'ROUTINES', 'GOALS', 'BRIEF', 'AFFIRMATIONS'] as const;

/** "- Body: Strength, Endurance, Recovery, Nutrition", one line per pillar. */
export function subStatVocabulary(): string {
  return PILLARS.map((p) => `  - ${PILLAR_LABEL[p]}: ${SUBSTATS[p].join(', ')}`).join('\n');
}

export function buildOriginPrompt({ displayName, originSheetMd, today, excludeMoney = false }: OriginPromptInput): string {
  const name = displayName.trim() || 'The player';
  const pillars = PILLARS.map((p) => PILLAR_LABEL[p]).join(', ');
  const sheet = excludeMoney ? stripMoney(originSheetMd) : originSheetMd;

  const task = `## Your task
${name} has just finished the Origin Sheet below the line: up to 118 questions in ten parts, answered in their own words. Questions they skipped are left out. Today is ${formatSheetDate(today)} (${today}). Tomorrow is Day 1 of the game.

Read the whole sheet before you write anything. Then set up the game from it: a State of Me that will be read back to you every night, the skills they already have, the routines that would move them, the goals they named, and the first morning letter.

Rules:
- Use only what the sheet says. Never invent a number, a person or an event. Where a number would help and the sheet has none, say what to measure instead.
- Pillars are exactly: ${pillars}.
- Sub-stats are exactly these, under their pillar:
${subStatVocabulary()}
- Use their own names for people, projects, routines and books, spelled the way they wrote them.${
    excludeMoney ? '\n- The player keeps money out of this game. Do not mention earnings, spending, savings or debts anywhere in the reply.' : ''
  }`;

  const format = `## Reply format
Reply with exactly these six sections, with these exact headers, in this order. Nothing before the first header and nothing after the last line.

## STATE_OF_ME
At most 400 words: the notes the game master keeps about the player, written plainly. First line: **Name**, age, city, what they do. Then these four sub-headings, each on its own line starting with ###:
### Where I am
- One line per pillar (${pillars}), with the sheet's numbers.
### Patterns the game master has noticed
- On Day 0 this is usually empty: write "- None yet." unless the sheet states a pattern outright.
### People
- Who matters and how often they talk, who is fading, who they want closer.
### Voice
- How the letters should talk to them, taken from their own answers.

## SKILLS
5 to 8 lines, one skill per line, fields separated by |:
Name | Pillar | Level 1-100 | one line why
Rank against everyone who tries the skill: 20 is a capable beginner, 50 is solid, 80 is rare. Put the sheet's evidence in the why.
Format example, not their data: Running | Body | 34 | 5 km in 29:10, three runs a week

## ROUTINES
6 to 10 lines across at least four pillars, one routine per line:
Name | Pillar | SubStat | weight 1-5 | days | window | upside | cost
- SubStat: one of that pillar's sub-stats, spelled as above.
- weight: 1 takes two minutes, 3 is a real block of time, 5 is the hardest thing in their week.
- days: daily, weekdays, or a list such as Mon,Wed,Fri.
- window: HH:MM-HH:MM in 24-hour time, or none.
- upside: what it builds, with a number when the sheet has one.
- cost: what a miss costs, in plain terms.
Start small: routines they can keep in a bad week, built on what they already do.
Format example, not their data: Evening skincare | Skin | Routine | 2 | daily | 22:00-22:30 | clear skin by January stays possible | two misses a week push January to March

## GOALS
4 to 8 lines taken from the goals they wrote, one per line:
Title | Pillar | why | target date YYYY-MM-DD or none
Format example, not their data: Sub-4 marathon | Body | proof they can hold a 22-week plan | 2027-02-14

## BRIEF
The first morning letter, Day 1, 200 to 350 words. Begin with "Day 1." Second person. Say plainly what the sheet shows, which two routines matter most this week and why, and what to log at tonight's first Campfire. No headers or lists inside the letter.

## AFFIRMATIONS
- Two lines. Each must contain a number or a name taken from the sheet.`;

  return joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, task, format, RULE, sheet);
}
