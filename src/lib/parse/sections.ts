/**
 * Shared helpers for reading Claude's tagged-markdown replies. Every parser (nightly, origin,
 * weekly, skill rank, lore) splits on `## HEADER` lines with these, so a reply that uses `#`,
 * `###`, `**BRIEF**` or `BRIEF:` on its own line still parses.
 */

export interface MdSection {
  /** Normalised header: upper case, single spaces, underscores kept ("STATE_OF_ME"). */
  title: string;
  /** Header exactly as written, without the hashes. */
  rawTitle: string;
  /** Body text between this header and the next, trimmed. */
  body: string;
}

const HEADER_RE = /^\s{0,3}(?:#{1,6}\s*(.+?)\s*#*|\*\*([A-Z][A-Z _/&-]{1,40})\*\*:?|([A-Z][A-Z _/&-]{1,40}):)\s*$/;

/** "**State of me:**" → "STATE OF ME". Underscores and hyphens become spaces; `canonical` joins with "_". */
export function normalizeHeader(raw: string): string {
  return raw
    .replace(/[*`]+/g, ' ')
    .replace(/[:\-–—]+\s*$/g, '')
    .replace(/[_\-]+/g, ' ')
    .trim()
    .toUpperCase()
    .replace(/\s+/g, ' ');
}

/** Splits markdown into header-delimited sections. Text before the first header is returned under title ''. */
export function splitSections(md: string): MdSection[] {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const out: MdSection[] = [];
  let current: MdSection = { title: '', rawTitle: '', body: '' };
  const bodyLines: string[] = [];
  let inFence = false;

  const flush = () => {
    current.body = bodyLines.join('\n').trim();
    if (current.title || current.body) out.push(current);
    bodyLines.length = 0;
  };

  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      inFence = !inFence;
      bodyLines.push(line);
      continue;
    }
    const m = inFence ? null : HEADER_RE.exec(line);
    if (m) {
      flush();
      const raw = (m[1] ?? m[2] ?? m[3] ?? '').trim();
      current = { title: canonical(normalizeHeader(raw)), rawTitle: raw, body: '' };
      continue;
    }
    bodyLines.push(line);
  }
  flush();
  return out;
}

/** Map the ways Claude tends to write a header onto one canonical token. */
function canonical(title: string): string {
  const t = title.replace(/\s+/g, '_');
  const alias: Record<string, string> = {
    BRIEFING: 'BRIEF',
    LETTER: 'BRIEF',
    MORNING_LETTER: 'BRIEF',
    AFFIRMATION: 'AFFIRMATIONS',
    QUEST: 'QUESTS',
    STAT: 'STATS',
    STAT_CHANGES: 'STATS',
    STAT_DELTAS: 'STATS',
    WARNING: 'WARNINGS',
    INSIGHT: 'INSIGHTS',
    LESSONS: 'LESSONS',
    STATE_OF_ME: 'STATE_OF_ME',
    NEXT_MILESTONE: 'NEXT_MILESTONES',
    FACT: 'FACTS',
    ACHIEVEMENT: 'ACHIEVEMENTS',
    UPDATE: 'UPDATES',
  };
  return alias[t] ?? t;
}

/** Find one section by canonical title. */
export function section(sections: MdSection[], title: string): MdSection | undefined {
  return sections.find((s) => s.title === title);
}

/** Bullet or numbered lines → clean strings. Lines without a marker are kept too, one per line. */
export function bullets(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
    .filter((l) => l.length > 0 && l !== '-');
}

/** "key: value" or "key | value" pairs from a block, lower-cased keys. */
export function pairs(body: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of bullets(body)) {
    const m = /^\*{0,2}([^:|]{1,40}?)\*{0,2}\s*[:|]\s*(.+)$/.exec(line);
    if (m) out[m[1]!.trim().toLowerCase()] = m[2]!.trim();
  }
  return out;
}

/** Parse a number that may carry a sign, decimals or a unit suffix. */
export function num(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const m = /[-+]?\d+(?:[.,]\d+)?/.exec(text.replace(/,/g, ''));
  return m ? Number(m[0]) : undefined;
}
