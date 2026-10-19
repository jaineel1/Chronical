/**
 * Lore prompt: the player writes freely about one skill, person, goal or book; Claude extracts
 * what the game should remember. The reply is parsed by `parseLoreReply`.
 */
import { formatShortDate, toDayKey } from '@/lib/dates';
import { GAME_MASTER_PREAMBLE, RULE, VOICE_RULES, joinBlocks } from './shared';

export type LoreSubjectType = 'skill' | 'person' | 'goal' | 'book';

export interface LoreSubject {
  type: LoreSubjectType;
  name: string;
  /** What the game already knows, one fact per line, e.g. "Level 62 of 100 (Advanced)". */
  summaryLines: string[];
}

export interface LoreUpdateField {
  key: string;
  hint: string;
}

/** The only fields an `## UPDATES` line may change, per item type. The app ignores anything else. */
export const LORE_UPDATE_FIELDS: Record<LoreSubjectType, readonly LoreUpdateField[]> = {
  skill: [
    { key: 'level', hint: 'a number from 1 to 100, only when the note clearly shows the current level is wrong' },
    { key: 'goal', hint: 'one line, what the skill is for' },
  ],
  person: [
    { key: 'closeness', hint: 'a number from 1 (distant) to 5 (closest)' },
    { key: 'contactEveryDays', hint: 'how often the player wants to be in touch, in days' },
    { key: 'wantCloser', hint: 'yes or no, whether the player wants to grow closer' },
    { key: 'notes', hint: 'one line the player will read before reaching out next time' },
  ],
  goal: [
    { key: 'why', hint: 'one line, why the goal matters to the player' },
    { key: 'targetDate', hint: 'YYYY-MM-DD' },
  ],
  book: [
    { key: 'status', hint: 'reading, done or wishlist' },
    { key: 'author', hint: "the author's name" },
  ],
};

const TYPE_NOUN: Record<LoreSubjectType, string> = { skill: 'skill', person: 'person', goal: 'goal', book: 'book' };

const ACHIEVEMENT_GUIDE: Record<LoreSubjectType, string> = {
  skill: 'One line per concrete result the note describes: a time, a weight, a thing shipped, a performance. Use the date if the note gives or implies one, else none.',
  person: 'Write none. Achievements belong to skills.',
  goal: 'Write none. Achievements belong to skills.',
  book: 'Write none. Achievements belong to skills.',
};

const LESSON_GUIDE: Record<LoreSubjectType, string> = {
  skill: 'Write none. Lessons belong to books.',
  person: 'Write none. Lessons belong to books.',
  goal: 'Write none. Lessons belong to books.',
  book: '- One bullet per lesson the player took from the book, phrased as something to do tomorrow.',
};

export function loreReplyFormat(type: LoreSubjectType): string {
  const fields = LORE_UPDATE_FIELDS[type].map((f) => `- ${f.key}: ${f.hint}`).join('\n');
  return `# Reply format

Reply ONLY with these five sections, with these exact headers, in this order.

## FACTS
- One bullet per fact the game should remember. Short, specific, in the player's own words where possible.

## ACHIEVEMENTS
YYYY-MM-DD or none | what they did | value unit or none
${ACHIEVEMENT_GUIDE[type]}

## LESSONS
${LESSON_GUIDE[type]}

## UPDATES
field: value
Only these fields, and only when the note clearly says so. Otherwise write none.
${fields}

## REPLY
Two to four sentences to the player, in character as the game master: what you will remember and why it matters.`;
}

export function buildLorePrompt(item: LoreSubject, freeText: string, opts: { today?: string } = {}): string {
  const today = opts.today ?? toDayKey(new Date());
  const noun = TYPE_NOUN[item.type];
  const pronoun = item.type === 'person' ? 'them' : 'it';
  const task = `# Task: remember this ${noun}

The player wrote the note below about one ${noun} in their game: ${item.name}. Read it and extract what the game should remember about ${pronoun}. Use only what the note and the summary say; never invent. If the note mentions a day ("last Sunday", "yesterday"), turn it into a date using today's date.`;
  const summary = item.summaryLines.length ? item.summaryLines.map((l) => `- ${l}`).join('\n') : '- Nothing yet.';
  const data = joinBlocks(
    `# The ${noun}: ${item.name}\n${summary}`,
    `# What the player wrote\n${freeText.trim() || '(Nothing yet.)'}`,
    `Today is ${today} (${formatShortDate(today)}).`,
  );
  return joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, task, loreReplyFormat(item.type), RULE, data);
}
