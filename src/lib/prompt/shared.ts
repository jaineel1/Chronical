/**
 * Text every prompt shares: who Claude is in this game, how it should write, and small helpers
 * for assembling markdown. Prompt builders (nightly, origin, weekly, deep, skill rank, lore) import
 * from here so the game master sounds like one person everywhere.
 */

export const GAME_MASTER_PREAMBLE = `You are the game master of Chronicle, a real-life RPG played by one person. Their life is the game: five pillars (Body, Skin, Mind, Work, Dopamine), each with four sub-stats, routines with real upsides and real costs, goals on a map, a tree of people, skills ranked 1 to 100, and books whose lessons they try to apply.

You write from what they log. You never invent events. You use their numbers. You are direct and warm, never cheerful for its own sake. No exclamation marks. No emoji. No headers other than the ones asked for. Short paragraphs. Second person. Numbers over adjectives. When something slipped, say so plainly and say what it costs; when something held, say what it is building. One lesson at a time, never a lecture.`;

export const VOICE_RULES = `Voice: plain, specific, kind. British or Indian English spellings are both fine; keep whichever the player uses. Refer to the player as "you". Use the player's own names for routines, goals, people and skills exactly as written.`;

/** Wrap a block under a markdown header. */
export function section(title: string, body: string): string {
  return `## ${title}\n${body.trim()}\n`;
}

/** Join blocks with blank lines, skipping empties. */
export function joinBlocks(...blocks: (string | undefined | null | false)[]): string {
  return blocks.filter((b): b is string => typeof b === 'string' && b.trim().length > 0).map((b) => b.trim()).join('\n\n') + '\n';
}

/** Horizontal rule between the instructions and the data. */
export const RULE = '---';

/**
 * Remove money figures when the player has asked for that. Strips currency amounts and whole
 * lines that are clearly about income, debt or balances. Conservative on purpose: it is better
 * to leave a stray "2 lakh" than to delete a line about a 2 km run.
 */
export function stripMoney(md: string): string {
  const moneyLine = /(₹|\$|€|£|\bINR\b|\bUSD\b|\brupees?\b|\bsalary\b|\bincome\b|\bnet ?worth\b|\bsavings\b|\bdebt\b|\bloan\b|\bemi\b|\binvoice[sd]?\b|\brevenue\b|\bbalance\b)/i;
  return md
    .split('\n')
    .filter((line) => !moneyLine.test(line))
    .join('\n')
    .replace(/(₹|\$|€|£)\s?\d[\d,]*(?:\.\d+)?\s*(?:k|lakh|lakhs|crore|cr|m|million)?/gi, '[amount]');
}

/** ~4 characters per token for English markdown. Good enough for a "About 9,200 tokens" line. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export function formatTokens(n: number): string {
  if (n < 1000) return `${n}`;
  return `${(Math.round(n / 100) / 10).toLocaleString('en-IN', { maximumFractionDigits: 1 })}k`;
}

/** Human model names shown next to "Copy prompt". */
export const MODEL_LABEL = {
  nightly: 'Haiku',
  weekly: 'Sonnet',
  monthly: 'Sonnet',
  deep: 'Sonnet',
  origin: 'Sonnet',
  skill_rank: 'Sonnet',
  lore: 'Haiku',
} as const;
