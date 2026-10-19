/**
 * Reads Claude's skill-ranking reply:
 *
 *   ## ASSESSMENT
 *   Running | 64 | 92 | 55 | 8 km at 5:52 and a 22 km long run.
 *
 *   ## NEXT_MILESTONES
 *   Running | 64 -> 70: a half marathon under 1:55
 *
 * Tolerant on purpose: markdown tables, bold names, bullets, "top 8%" percentiles, `→` arrows and
 * a missing reasoning column all still parse. Names are matched to the player's skills
 * case-insensitively, ignoring punctuation, so "UI Design" and "ui-design" both find "UI design".
 */
import { bullets, num, section, splitSections, type MdSection } from './sections';

export interface ParsedAssessment {
  /** The player's skill name as stored (or as written when no names were given). */
  name: string;
  /** 1-100, one decimal at most. */
  level: number;
  percentileGeneral?: number;
  percentilePractitioners?: number;
  reasoning: string;
}

export interface ParsedSkillMilestone {
  name: string;
  /** Stored form, e.g. "64 to 70: a half marathon under 1:55". */
  text: string;
  from?: number;
  to?: number;
}

export interface SkillRankParse {
  ok: boolean;
  assessments: ParsedAssessment[];
  milestones: ParsedSkillMilestone[];
  /** Human-readable problems. Non-fatal ones (skipped lines) can appear even when ok. */
  errors: string[];
}

const ASSESSMENT_TITLES = ['ASSESSMENT', 'ASSESSMENTS', 'RANKING', 'RANKINGS', 'SKILL_ASSESSMENT', 'SKILL_ASSESSMENTS', 'SKILL_RANKINGS', 'SKILLS'];
const MILESTONE_TITLES = ['NEXT_MILESTONES', 'MILESTONES', 'NEXT_MILESTONE', 'NEXT_STEPS'];
const NONE_RE = /^(none|n\/a|na|-+|nothing|no change)\.?$/i;

/** "**UI Design** (visual)" → "uidesign". Used only for matching. */
export function normalizeSkillName(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

function cleanName(raw: string): string {
  return raw
    .replace(/[*_`]+/g, '')
    .replace(/[:\s]+$/g, '')
    .trim();
}

function findSection(sections: MdSection[], titles: string[]): MdSection | undefined {
  for (const t of titles) {
    const s = section(sections, t);
    if (s) return s;
  }
  return undefined;
}

/** Split a "a | b | c" line, dropping the empty cells a markdown table adds at both ends. */
function cells(line: string): string[] {
  const parts = line.split('|').map((p) => p.trim());
  if (parts.length > 1 && parts[0] === '') parts.shift();
  if (parts.length > 1 && parts[parts.length - 1] === '') parts.pop();
  return parts;
}

function isTableRule(line: string): boolean {
  return /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?$/.test(line.trim());
}

const PERCENTILE_CELL_RE = /^(?:top\s*)?[~≈]?\d+(?:\.\d+)?\s*(?:%|st|nd|rd|th)?(?:\s*(?:percentile|pct))?$/i;

/** After name and level: up to two percentile cells, then the reasoning (which may itself contain "|"). */
function splitRest(rest: string[]): { general?: number; practitioners?: number; reasoning: string } {
  const pct: (number | undefined)[] = [];
  let i = 0;
  while (i < rest.length && pct.length < 2) {
    const cell = rest[i]!.trim();
    if (PERCENTILE_CELL_RE.test(cell)) pct.push(parsePercentile(cell));
    else if (NONE_RE.test(cell) || cell === '') pct.push(undefined);
    else break;
    i++;
  }
  const reasoning = rest
    .slice(i)
    .join(' | ')
    .trim()
    .replace(/^["“]|["”]$/g, '')
    .trim();
  return { general: pct[0], practitioners: pct[1], reasoning };
}

/** "92", "92nd", "92%", "top 8%" → 0-100; anything else → undefined. */
export function parsePercentile(text: string | undefined): number | undefined {
  if (!text) return undefined;
  const t = text.trim();
  if (!t || NONE_RE.test(t)) return undefined;
  const top = /top\s*(\d+(?:\.\d+)?)\s*%?/i.exec(t);
  const n = top ? 100 - Number(top[1]) : num(t);
  if (n === undefined || Number.isNaN(n)) return undefined;
  return Math.max(0, Math.min(100, Math.round(n * 10) / 10));
}

/** Skills live on 1-100 with one decimal; anything unreadable becomes 1. */
export function clampSkillLevel(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(100, Math.round(n * 10) / 10));
}

/** "62 -> 70: a half marathon" / "62 → 70 - x" / "62 to 70: x" → stored "62 to 70: x". */
export function normalizeMilestoneText(raw: string): { text: string; from?: number; to?: number } {
  const t = raw.trim().replace(/^[*_]+|[*_]+$/g, '').trim();
  const m = /^(\d+(?:\.\d+)?)\s*(?:->|-->|→|⟶|➝|=>|–>|—>|\bto\b)\s*(\d+(?:\.\d+)?)\s*(?:[:\-–—,.]\s*)?(.*)$/i.exec(t);
  if (!m) return { text: t };
  const from = Number(m[1]);
  const to = Number(m[2]);
  const what = (m[3] ?? '').trim();
  return { text: what ? `${from} to ${to}: ${what}` : `${from} to ${to}`, from, to };
}

function lines(body: string): string[] {
  return body
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !isTableRule(l))
    .map((l) => (l.startsWith('|') ? l : (bullets(l)[0] ?? '')))
    .filter((l) => l.length > 0 && !NONE_RE.test(l));
}

/** Remove ``` fence lines so a reply pasted inside a code block still splits into sections. */
function unfence(md: string): string {
  return md.replace(/^\s*```[\w-]*\s*$/gm, '');
}

export function parseSkillRankReply(md: string, knownSkillNames: readonly string[]): SkillRankParse {
  const errors: string[] = [];
  const known = new Map<string, string>();
  for (const name of knownSkillNames) known.set(normalizeSkillName(name), name);

  const resolve = (raw: string): string | undefined => {
    const cleaned = cleanName(raw);
    if (!cleaned) return undefined;
    if (known.size === 0) return cleaned;
    return known.get(normalizeSkillName(cleaned));
  };

  const sections = splitSections(unfence(md ?? ''));
  const assessmentSection = findSection(sections, ASSESSMENT_TITLES);
  const byName = new Map<string, ParsedAssessment>();

  if (!assessmentSection) {
    errors.push('No ## ASSESSMENT section in the reply.');
  } else {
    for (const line of lines(assessmentSection.body)) {
      let nameRaw: string;
      let levelRaw: string | undefined;
      let rest: string[] = [];
      if (line.includes('|')) {
        const c = cells(line);
        nameRaw = c[0] ?? '';
        levelRaw = c[1];
        rest = c.slice(2);
      } else {
        const m = /^(.+?)\s*(?::|—|–|=|\s-\s)\s*(\d+(?:\.\d+)?)(?:\s*\/\s*100)?\b[\s,.;:—–-]*(.*)$/.exec(line);
        if (!m) {
          errors.push(`Could not read: "${line.slice(0, 60)}"`);
          continue;
        }
        nameRaw = m[1]!;
        levelRaw = m[2];
        rest = m[3] ? [m[3]] : [];
      }
      const level = num(levelRaw);
      if (level === undefined) {
        // An echoed header row ("Name | level | ...") is not an error.
        if (!/level/i.test(levelRaw ?? '')) errors.push(`No level for "${cleanName(nameRaw)}".`);
        continue;
      }
      const name = resolve(nameRaw);
      if (!name) {
        const shown = cleanName(nameRaw);
        if (shown && !/^name$/i.test(shown)) errors.push(`"${shown}" is not one of your skills; skipped.`);
        continue;
      }
      const { general, practitioners, reasoning } = splitRest(rest);
      byName.set(name, {
        name,
        level: clampSkillLevel(level),
        percentileGeneral: general,
        percentilePractitioners: practitioners,
        reasoning,
      });
    }
    if (byName.size === 0) errors.push('The ## ASSESSMENT section has no line in the "Name | level | ..." format.');
  }

  const milestones: ParsedSkillMilestone[] = [];
  const milestoneSection = findSection(sections, MILESTONE_TITLES);
  if (milestoneSection) {
    for (const line of lines(milestoneSection.body)) {
      let nameRaw: string;
      let rest: string;
      const bar = line.indexOf('|');
      if (bar >= 0) {
        const c = cells(line);
        nameRaw = c[0] ?? '';
        rest = c.slice(1).join(' | ');
      } else {
        const m = /^(.+?)\s*[:—–]\s*(\d.*)$/.exec(line);
        if (!m) {
          errors.push(`Could not read milestone: "${line.slice(0, 60)}"`);
          continue;
        }
        nameRaw = m[1]!;
        rest = m[2]!;
      }
      if (/^name$/i.test(cleanName(nameRaw)) && /from/i.test(rest)) continue; // echoed format line
      const name = resolve(nameRaw);
      if (!name) {
        const shown = cleanName(nameRaw);
        if (shown) errors.push(`Milestone for "${shown}" skipped: not one of your skills.`);
        continue;
      }
      if (!rest.trim()) continue;
      milestones.push({ name, ...normalizeMilestoneText(rest) });
    }
  }

  const assessments = [...byName.values()];
  if (assessments.length && known.size) {
    const missing = knownSkillNames.filter((n) => !byName.has(n));
    if (missing.length) errors.push(`Not ranked: ${missing.join(', ')}.`);
  }

  return { ok: assessments.length > 0, assessments, milestones, errors };
}
