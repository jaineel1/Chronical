/**
 * Parser for the nightly reply: tagged markdown → the fields of a DayLog.
 *
 *   ## BRIEF          the morning letter (required; without it the paste is kept as a draft)
 *   ## AFFIRMATIONS   - lines; lines without a number or a known name are flagged as generic
 *   ## QUESTS         - [Pillar] text | reward: text
 *   ## STATS          Body +2 · Body/Endurance +1 · Running 62 -> 64
 *   ## WARNINGS       - lines
 *   ## INSIGHTS       - lines
 *   ## LESSON         one sentence
 *   ## MEALS          - Slot | Food | 250 g | 380 kcal | P 12 g | C 60 g | F 8 g   (optional)
 *   ## SUMMARY        two or three lines recapping the day                      (optional)
 *   ## ROUTINE        one routine row, or "- None"                              (optional)
 *
 * Forgiving on purpose: lowercase, bold or colon headers, prose before the first header, CRLF, a
 * reply wrapped in a ``` fence, bullets or bold in STATS, unicode arrows and minus signs, and
 * repeated sections are all read. Unknown sections are kept verbatim.
 */
import { newId } from '@/data/ids';
import { PILLAR_LABEL, SUBSTATS, pillarFromLabel, type MealSlot, type Pillar, type Quest, type RoutineDraft, type StatDelta } from '@/data/types';
import type { MealEstimate } from '@/lib/nutrition';
import { parseRoutines } from './origin';
import { bullets, splitSections, type MdSection } from './sections';

export interface ParsedReply {
  ok: boolean;
  briefMd: string;
  /** Every affirmation, in order, flagged ones included. */
  affirmations: string[];
  /** The subset with no number and no name from the player's log. Still shown, marked as generic. */
  flaggedAffirmations: string[];
  quests: Quest[];
  stats: StatDelta[];
  warnings: string[];
  insights: string[];
  lessonMd: string;
  /** ## MEALS: Claude's grams, calories and macros per meal. */
  meals: MealEstimate[];
  /** ## SUMMARY: a short recap of the day. */
  summaryMd: string;
  /** ## ROUTINE: at most one suggested routine. */
  routine?: RoutineDraft;
  extraSections: { title: string; body: string }[];
  /** When ok is false, the first entry says why. Otherwise notes about lines that were skipped or adjusted. */
  errors: string[];
}

export interface ParseOptions {
  /** Routine, goal, skill, people and book names from the player's log. */
  knownNouns?: string[];
}

export const NO_BRIEF_ERROR = 'No ## BRIEF section. The reply was kept as a draft.';
export const EMPTY_BRIEF_ERROR = 'The ## BRIEF section is empty. The reply was kept as a draft.';

/** Pillar adjustments from Claude stay within this range a night (routines are scored separately). */
export const MAX_REPLY_DELTA = 3;

const KNOWN = ['BRIEF', 'AFFIRMATIONS', 'QUESTS', 'STATS', 'WARNINGS', 'INSIGHTS', 'LESSON', 'MEALS', 'SUMMARY', 'ROUTINE'] as const;
type Known = (typeof KNOWN)[number];

const ALIASES: Record<string, Known> = {
  BRIEF: 'BRIEF',
  BRIEFING: 'BRIEF',
  LETTER: 'BRIEF',
  MORNING_LETTER: 'BRIEF',
  AFFIRMATIONS: 'AFFIRMATIONS',
  AFFIRMATION: 'AFFIRMATIONS',
  QUESTS: 'QUESTS',
  QUEST: 'QUESTS',
  STATS: 'STATS',
  STAT: 'STATS',
  STAT_CHANGES: 'STATS',
  STAT_DELTAS: 'STATS',
  WARNINGS: 'WARNINGS',
  WARNING: 'WARNINGS',
  INSIGHTS: 'INSIGHTS',
  INSIGHT: 'INSIGHTS',
  LESSON: 'LESSON',
  LESSONS: 'LESSON',
  MEALS: 'MEALS',
  MEAL: 'MEALS',
  NUTRITION: 'MEALS',
  FOOD: 'MEALS',
  CALORIES: 'MEALS',
  SUMMARY: 'SUMMARY',
  RECAP: 'SUMMARY',
  DAY_SUMMARY: 'SUMMARY',
  NIGHTLY_SUMMARY: 'SUMMARY',
  ROUTINE: 'ROUTINE',
  ROUTINES: 'ROUTINE',
  NEW_ROUTINE: 'ROUTINE',
  ROUTINE_SUGGESTION: 'ROUTINE',
  SUGGESTED_ROUTINE: 'ROUTINE',
};

/* ------------------------------------------------------------------ */
/* Pre-processing                                                      */
/* ------------------------------------------------------------------ */

const SECTION_WORDS = 'brief|briefing|letter|morning letter|affirmations?|quests?|stats?|stat changes|stat deltas|warnings?|insights?|lessons?';
/** A header line in any of the shapes Claude uses: "Brief:", "**Brief**", "1. BRIEF", "## Brief (150-400 words)". */
const LOOSE_HEADER = new RegExp(
  `^\\s{0,3}(?:#{1,6}\\s*)?(?:\\d+[.)]\\s*)?(?:\\*\\*|__)?\\s*(${SECTION_WORDS})\\s*(?:\\*\\*|__)?\\s*(?:\\([^)]*\\))?\\s*[:\\-–—]?\\s*(?:\\*\\*|__)?\\s*$`,
  'i',
);
/**
 * "LESSON: From Deep Work: ..." on one line. Upper case only (plus "Lesson:", which is nearly always
 * the one-line lesson), so a sentence that starts "Warning:" inside the letter stays prose.
 */
const INLINE_HEADER = /^\s{0,3}(?:\*\*)?(BRIEF|AFFIRMATIONS|QUESTS|STATS|WARNINGS|INSIGHTS|LESSON|Lesson)(?:\*\*)?\s*:\s*(?:\*\*)?\s*(\S.*)$/;
const FENCE_LINE = /^\s*(?:```|~~~)[\w-]*\s*$/;

function normaliseHeaders(md: string): string {
  return md
    .split('\n')
    .flatMap((line) => {
      const loose = LOOSE_HEADER.exec(line);
      if (loose) return [`## ${loose[1]!.trim().toUpperCase()}`];
      const inline = INLINE_HEADER.exec(line);
      if (inline) return [`## ${inline[1]!.toUpperCase()}`, inline[2]!];
      return [line];
    })
    .join('\n');
}

/** Canonical section, also for headers with extra words ("LESSON_FOR_TOMORROW", "STATS_CHANGES"). */
function canonicalTitle(title: string): Known | undefined {
  const exact = ALIASES[title];
  if (exact) return exact;
  const head = title.split('_')[0] ?? '';
  return title.includes('_') ? ALIASES[head] : undefined;
}

/** Sections of the reply, unwrapping a ``` fence when the headers only exist inside one. */
function readSections(md: string): MdSection[] {
  const text = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  const direct = splitSections(normaliseHeaders(text));
  if (direct.some((s) => canonicalTitle(s.title) === 'BRIEF')) return direct;
  const unfenced = text
    .split('\n')
    .filter((l) => !FENCE_LINE.test(l))
    .join('\n');
  const second = splitSections(normaliseHeaders(unfenced));
  return second.some((s) => canonicalTitle(s.title) === 'BRIEF') ? second : direct;
}

/* ------------------------------------------------------------------ */
/* Line helpers                                                        */
/* ------------------------------------------------------------------ */

const NONE_LINE = /^(?:none|nothing|no changes?|no warnings?|no insights?|n\/a|-+|—)\.?$/i;

/** Remove bold/italic/code markers and surrounding quotes from one line. */
function plain(line: string): string {
  return line
    .replace(/\*\*|__|`/g, '')
    .replace(/^\*(.+)\*$/, '$1')
    .replace(/^_(.+)_$/, '$1')
    .replace(/^["“](.+)["”]$/, '$1')
    .trim();
}

function listItems(body: string): string[] {
  return bullets(body)
    .map(plain)
    .filter((l) => l.length > 0 && !NONE_LINE.test(l) && !/^-{3,}$/.test(l));
}

function trimRules(body: string): string {
  return body.replace(/^(?:\s*-{3,}\s*\n)+/, '').replace(/(?:\n\s*-{3,}\s*)+$/, '').trim();
}

/* ------------------------------------------------------------------ */
/* STATS                                                               */
/* ------------------------------------------------------------------ */

const NUM = '(\\d+(?:\\.\\d+)?)';
const ARROW_RE = new RegExp(`^(.+?)(?:\\s*:\\s*|\\s+)${NUM}\\s*(?:-{1,2}>|→|⟶|=>|\\bto\\b)\\s*${NUM}(?!\\d|\\.\\d)`, 'i');
const DELTA_RE = new RegExp(`^(.+?)(?:\\s*:\\s*|\\s+)([+-]?)\\s*${NUM}(?!\\d|\\.\\d|\\s*(?:-{1,2}>|→|⟶|=>))`);
const REVERSED_RE = new RegExp(`^([+-])\\s*${NUM}\\s+([A-Za-z][\\w /&-]*)$`);

/** Canonical target: pillar labels and sub-stats in their display casing, anything else as written. */
export function normaliseTarget(name: string): string {
  const n = name.replace(/\s*\/\s*/, '/').replace(/[\s:]+$/, '').trim();
  const slash = n.indexOf('/');
  if (slash >= 0) {
    const pillar = pillarFromLabel(n.slice(0, slash));
    const right = n.slice(slash + 1).trim();
    if (!pillar) return n;
    const sub = SUBSTATS[pillar].find((s) => s.toLowerCase() === right.toLowerCase());
    return `${PILLAR_LABEL[pillar]}/${sub ?? right}`;
  }
  const pillar = pillarFromLabel(n);
  return pillar ? PILLAR_LABEL[pillar] : n;
}

function validName(name: string): boolean {
  const n = name.trim();
  return n.length > 0 && n.length <= 48 && /\p{L}/u.test(n) && !/^\d/.test(n);
}

/** One stat expression ("Body +2", "Running 62 -> 64"), or undefined. */
export function parseStatExpression(expr: string): StatDelta | undefined {
  const text = expr.trim();
  if (!text) return undefined;
  const arrow = ARROW_RE.exec(text);
  if (arrow && validName(arrow[1]!)) {
    return { target: normaliseTarget(arrow[1]!), from: Number(arrow[2]), to: Number(arrow[3]) };
  }
  const delta = DELTA_RE.exec(text);
  if (delta && validName(delta[1]!)) {
    const n = Number(delta[3]);
    return { target: normaliseTarget(delta[1]!), delta: delta[2] === '-' ? -n : n };
  }
  const reversed = REVERSED_RE.exec(text);
  if (reversed && validName(reversed[3]!)) {
    const n = Number(reversed[2]);
    return { target: normaliseTarget(reversed[3]!), delta: reversed[1] === '-' ? -n : n };
  }
  return undefined;
}

/** A STATS line may hold several expressions: "Body +2 · Mind -1", "Body +2, Mind -1". */
export function parseStatLine(raw: string): StatDelta[] {
  const line = plain(raw)
    .replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '')
    .replace(/[−–](?=\s*\d)/g, '-')
    .trim();
  if (!line || NONE_LINE.test(line)) return [];
  const out: StatDelta[] = [];
  for (const piece of line.split(/\s*[·•;|]\s*/)) {
    const commaParts = piece.split(/,\s+/);
    const parsedParts = commaParts.map(parseStatExpression);
    if (commaParts.length > 1 && parsedParts.every(Boolean)) {
      out.push(...(parsedParts as StatDelta[]));
      continue;
    }
    const single = parseStatExpression(piece);
    if (single) out.push(single);
  }
  return out;
}

function isPillarLike(target: string): boolean {
  const slash = target.indexOf('/');
  return !!pillarFromLabel(slash >= 0 ? target.slice(0, slash) : target);
}

function parseStats(body: string, errors: string[]): StatDelta[] {
  const byTarget = new Map<string, StatDelta>();
  for (const line of body.split('\n')) {
    if (!line.trim()) continue;
    const parsed = parseStatLine(line);
    if (parsed.length === 0) {
      const shown = plain(line).replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
      if (shown && !NONE_LINE.test(shown)) errors.push(`Could not read a STATS line: "${shown}".`);
      continue;
    }
    for (const stat of parsed) {
      let s = stat;
      if (typeof s.delta === 'number' && isPillarLike(s.target) && Math.abs(s.delta) > MAX_REPLY_DELTA) {
        const kept = Math.sign(s.delta) * MAX_REPLY_DELTA;
        errors.push(`${s.target} ${s.delta > 0 ? '+' : ''}${s.delta} is outside -3 to +3; kept ${kept > 0 ? '+' : ''}${kept}.`);
        s = { ...s, delta: kept };
      }
      // A later line for the same target wins: Claude correcting itself.
      byTarget.delete(s.target.toLowerCase());
      byTarget.set(s.target.toLowerCase(), s);
    }
  }
  return [...byTarget.values()];
}

/* ------------------------------------------------------------------ */
/* QUESTS                                                              */
/* ------------------------------------------------------------------ */

const REWARD_PATTERNS: RegExp[] = [
  /\s*\|\s*(?:reward\s*[:—–-]?\s*)?(.+)$/i, // text | reward: x   or   text | x
  /\s*\(\s*reward\s*[:—–-]?\s*([^)]+?)\s*\)\s*\.?\s*$/i, // text (reward: x)
  /\s*[—–]+\s*reward\s*[:—–-]?\s*(.+)$/i, // text — reward: x
  /\s+-{1,2}\s*reward\s*[:—–-]?\s*(.+)$/i, // text - reward: x
  /[,;.]?\s+reward\s*[:—–]\s*(.+)$/i, // text, reward: x   or   text reward — x
];

/** "- [Work] Two hours of deep work | reward: ships Friday" → a Quest. */
export function parseQuestLine(raw: string): Quest | undefined {
  let line = plain(raw).replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '');
  line = line.replace(/^\[\s*[xX ]?\s*\]\s+/, '');
  let pillar: Pillar | undefined;
  const tag = /^[[(]\s*([A-Za-z]+)\s*[\])]\s*[:\-–—]?\s*/.exec(line);
  if (tag) {
    pillar = pillarFromLabel(tag[1]!);
    line = line.slice(tag[0].length);
  } else {
    const prefix = /^([A-Za-z]+)\s*[:–—]\s+/.exec(line);
    if (prefix && pillarFromLabel(prefix[1]!)) {
      pillar = pillarFromLabel(prefix[1]!);
      line = line.slice(prefix[0].length);
    }
  }
  let reward: string | undefined;
  for (const re of REWARD_PATTERNS) {
    const m = re.exec(line);
    if (m) {
      reward = plain(m[1]!).replace(/^reward\s*[:—–-]\s*/i, '').replace(/\.$/, '').trim();
      line = line.slice(0, m.index);
      break;
    }
  }
  const text = line.replace(/[\s,;:—–|-]+$/, '').trim();
  if (!text) return undefined;
  return { id: newId(), pillar, text, reward: reward || undefined, done: false };
}

/* ------------------------------------------------------------------ */
/* AFFIRMATIONS                                                        */
/* ------------------------------------------------------------------ */

const NUMBER_WORDS =
  /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty|thirty|forty|fifty|sixty|seventy|eighty|ninety|hundred|thousand)\b/i;

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** True when a line has no digit, no number word and none of the player's own names. */
export function isGenericAffirmation(text: string, knownNouns: readonly string[] = []): boolean {
  if (/\d/.test(text) || NUMBER_WORDS.test(text)) return false;
  return !knownNouns.some((noun) => {
    const n = noun.trim();
    if (n.length < 3) return false;
    return new RegExp(`(^|[^\\p{L}\\p{N}])${escapeRe(n)}($|[^\\p{L}\\p{N}])`, 'iu').test(text);
  });
}

/* ------------------------------------------------------------------ */
/* MEALS and ROUTINE                                                   */
/* ------------------------------------------------------------------ */

const SLOT_WORDS: Record<string, MealSlot> = { breakfast: 'breakfast', lunch: 'lunch', dinner: 'dinner', snack: 'snack', snacks: 'snack', supper: 'dinner' };

function firstNumber(cell: string): number | undefined {
  const m = /(\d[\d,]*(?:\.\d+)?)/.exec(cell);
  return m ? Number(m[1]!.replace(/,/g, '')) : undefined;
}

/**
 * `- Breakfast | Oats with banana | 250 g | 380 kcal | P 12 g | C 60 g | F 8 g`. The slot is optional,
 * and the numbers are read by their labels in any order. Lines for totals are skipped.
 */
export function parseMealLine(line: string): MealEstimate | null {
  const cells = plain(line.replace(/^\s*(?:[-*+•]|\d{1,2}[.)])\s+/, ''))
    .split('|')
    .map((c) => c.trim())
    .filter(Boolean);
  if (cells.length < 2) return null;
  const slot = SLOT_WORDS[cells[0]!.toLowerCase().replace(/[:.]$/, '')];
  if (slot) cells.shift();
  const name = cells.shift()?.replace(/[:.]$/, '').trim();
  if (!name || /^(?:total|day total|totals?)\b/i.test(name)) return null;
  const out: MealEstimate = { name, ...(slot ? { slot } : {}) };
  for (const cell of cells) {
    const v = firstNumber(cell);
    if (v === undefined) continue;
    const c = cell.toLowerCase();
    if (/kcal|calorie|\bcal\b/.test(c)) out.kcal = v;
    else if (/^(?:p\b|protein)/.test(c) || /\bprotein\b/.test(c)) out.proteinG = v;
    else if (/^(?:c\b|carb)/.test(c) || /\bcarbs?\b/.test(c)) out.carbsG = v;
    else if (/^(?:f\b|fat)/.test(c) || /\bfats?\b/.test(c)) out.fatG = v;
    else if (/\d\s*g\b|grams?/.test(c) && out.grams === undefined) out.grams = v;
  }
  return MACRO_KEYS.some((k) => out[k] !== undefined) ? out : null;
}

const MACRO_KEYS = ['grams', 'kcal', 'proteinG', 'carbsG', 'fatG'] as const;

function parseMeals(body: string): MealEstimate[] {
  const out: MealEstimate[] = [];
  for (const line of bullets(body)) {
    if (NONE_LINE.test(plain(line))) continue;
    const m = parseMealLine(line);
    if (m) out.push(m);
  }
  return out;
}

/** The first routine row of ## ROUTINE, or none when Claude wrote "- None". */
function parseRoutine(body: string, errors: string[]): RoutineDraft | undefined {
  const rows = bullets(body).filter((l) => !NONE_LINE.test(plain(l)));
  if (!rows.length) return undefined;
  const notes: string[] = [];
  const [first] = parseRoutines(rows.join('\n'), notes);
  if (!first) {
    errors.push(`The suggested routine could not be read${notes[0] ? `: ${notes[0]}` : '.'}`);
    return undefined;
  }
  return { name: first.name, pillar: first.pillar, subStat: first.subStat, weight: first.weight, days: [...first.days], window: first.window, upside: first.upside, cost: first.cost };
}

/* ------------------------------------------------------------------ */
/* Whole reply                                                         */
/* ------------------------------------------------------------------ */

export function parseNightlyReply(md: string, opts: ParseOptions = {}): ParsedReply {
  const errors: string[] = [];
  const grouped = new Map<Known, MdSection[]>();
  const extraSections: ParsedReply['extraSections'] = [];

  for (const s of readSections(md)) {
    if (!s.title) continue; // prose before the first header
    const known = canonicalTitle(s.title);
    if (!known) {
      extraSections.push({ title: s.rawTitle, body: s.body });
      continue;
    }
    grouped.set(known, [...(grouped.get(known) ?? []), s]);
  }

  for (const [title, list] of grouped) {
    if (list.length > 1) errors.push(`${title} appeared ${list.length} times; ${title === 'BRIEF' || title === 'LESSON' ? 'the last one was kept' : 'they were merged'}.`);
  }

  const lastBody = (t: Known) => [...(grouped.get(t) ?? [])].reverse().map((s) => trimRules(s.body)).find((b) => b.length > 0) ?? '';
  const allBodies = (t: Known) => (grouped.get(t) ?? []).map((s) => trimRules(s.body)).join('\n');

  const briefMd = lastBody('BRIEF');
  const knownNouns = opts.knownNouns ?? [];

  const affirmations = dedupe(listItems(allBodies('AFFIRMATIONS')));
  const flaggedAffirmations = affirmations.filter((a) => isGenericAffirmation(a, knownNouns));

  const questTexts = new Set<string>();
  const quests: Quest[] = [];
  for (const line of bullets(allBodies('QUESTS'))) {
    // Skip "None" and intro lines such as "Three for tomorrow:".
    if (NONE_LINE.test(plain(line)) || /:\s*$/.test(line)) continue;
    const q = parseQuestLine(line);
    if (!q || questTexts.has(q.text.toLowerCase())) continue;
    questTexts.add(q.text.toLowerCase());
    quests.push(q);
  }

  const stats = grouped.has('STATS') ? parseStats(allBodies('STATS'), errors) : [];
  const warnings = dedupe(listItems(allBodies('WARNINGS')));
  const insights = dedupe(listItems(allBodies('INSIGHTS')));
  const lessonMd = listItems(lastBody('LESSON')).join(' ');
  const meals = parseMeals(allBodies('MEALS'));
  const summaryMd = listItems(lastBody('SUMMARY')).join(' ');
  const routine = grouped.has('ROUTINE') ? parseRoutine(lastBody('ROUTINE'), errors) : undefined;

  if (!grouped.has('BRIEF')) {
    return emptyResult(NO_BRIEF_ERROR, extraSections);
  }
  if (!briefMd) {
    return emptyResult(EMPTY_BRIEF_ERROR, extraSections);
  }
  for (const t of ['AFFIRMATIONS', 'QUESTS', 'STATS', 'LESSON'] as const) {
    if (!grouped.has(t)) errors.push(`No ## ${t} section.`);
  }

  return { ok: true, briefMd, affirmations, flaggedAffirmations, quests, stats, warnings, insights, lessonMd, meals, summaryMd, routine, extraSections, errors };
}

function emptyResult(error: string, extraSections: ParsedReply['extraSections']): ParsedReply {
  return {
    ok: false,
    briefMd: '',
    affirmations: [],
    flaggedAffirmations: [],
    quests: [],
    stats: [],
    warnings: [],
    insights: [],
    lessonMd: '',
    meals: [],
    summaryMd: '',
    extraSections,
    errors: [error],
  };
}

function dedupe(items: string[]): string[] {
  const seen = new Set<string>();
  return items.filter((i) => {
    const k = i.toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}
