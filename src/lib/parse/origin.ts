/**
 * Reads Claude's reply to the origin prompt (src/lib/prompt/origin.ts) into the pieces the game
 * is built from. Forgiving by design: header variants, wrong-case pillars, tables, code fences,
 * stray prose and rule lines all parse; anything adjusted or skipped is explained in `errors`.
 *
 * `ok` needs only STATE_OF_ME and BRIEF. SKILLS, ROUTINES, GOALS and AFFIRMATIONS are optional.
 */
import { PILLARS, PILLAR_LABEL, SUBSTATS, pillarFromLabel, type Pillar } from '@/data/types';
import { toDayKey } from '@/lib/dates';
import { bullets, num, splitSections, type MdSection } from './sections';

export interface OriginSkill {
  name: string;
  pillar: Pillar;
  /** 1-100. */
  level: number;
  why: string;
}

export interface OriginRoutine {
  name: string;
  pillar: Pillar;
  /** One of SUBSTATS[pillar], spelled exactly. */
  subStat: string;
  /** 1-5. */
  weight: number;
  /** 0 = Sunday … 6 = Saturday. Empty = every day (the seed's DAILY convention). */
  days: number[];
  /** "HH:MM-HH:MM" or undefined. */
  window?: string;
  upside: string;
  cost: string;
}

export interface OriginGoal {
  title: string;
  pillar: Pillar;
  why: string;
  /** Day key 'YYYY-MM-DD'. */
  targetDate?: string;
}

export type OriginSectionKey = 'STATE_OF_ME' | 'SKILLS' | 'ROUTINES' | 'GOALS' | 'BRIEF' | 'AFFIRMATIONS';

export interface OriginReply {
  ok: boolean;
  /** Starts with "# State of Me", sub-sections as "## …" (the STATE_OF_ME_MD shape). '' when missing. */
  stateOfMeMd: string;
  skills: OriginSkill[];
  routines: OriginRoutine[];
  goals: OriginGoal[];
  briefMd: string;
  affirmations: string[];
  /** Missing required sections first, then notes about lines that were adjusted or skipped. */
  errors: string[];
  /** Required sections that were absent or empty. */
  missing: OriginSectionKey[];
}

/* ------------------------------------------------------------------ */
/* Sections                                                            */
/* ------------------------------------------------------------------ */

const KEY_ALIASES: readonly (readonly [string, OriginSectionKey])[] = [
  ['STATE_OF_ME', 'STATE_OF_ME'],
  ['STATE_OF_YOU', 'STATE_OF_ME'],
  ['STATE', 'STATE_OF_ME'],
  ['CHARACTER_SHEET', 'STATE_OF_ME'],
  ['SKILLS', 'SKILLS'],
  ['SKILL', 'SKILLS'],
  ['STARTING_SKILLS', 'SKILLS'],
  ['ROUTINES', 'ROUTINES'],
  ['ROUTINE', 'ROUTINES'],
  ['STARTING_ROUTINES', 'ROUTINES'],
  ['GOALS', 'GOALS'],
  ['GOAL', 'GOALS'],
  ['BRIEF', 'BRIEF'],
  ['FIRST_LETTER', 'BRIEF'],
  ['FIRST_BRIEF', 'BRIEF'],
  ['MORNING_BRIEF', 'BRIEF'],
  ['DAY_1_BRIEF', 'BRIEF'],
  ['DAY_1_LETTER', 'BRIEF'],
  ['AFFIRMATIONS', 'AFFIRMATIONS'],
];

/** Canonical section title (from splitSections) → origin key, tolerating "1. STATE_OF_ME" and "BRIEF (Day 1)". */
export function originSectionKey(title: string): OriginSectionKey | undefined {
  const t = title.replace(/^\d+[.)]?_*/, '').replace(/_+$/, '');
  for (const [alias, key] of KEY_ALIASES) if (t === alias || t.startsWith(`${alias}_`)) return key;
  return undefined;
}

const RULE_LINE = /^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/;
const FENCE_LINE = /^\s*```[\w-]*\s*$/;

function stripRules(body: string): string {
  return body
    .split('\n')
    .filter((l) => !RULE_LINE.test(l))
    .join('\n')
    .trim();
}

/** A line that is only one of our section names ("Routines:", "**Skills**"), in any case. */
const LOOSE_HEADER = /^\s*(?:\*\*)?\s*(state[ _-]of[ _-]me|skills|routines|goals|brief|affirmations)\s*(?:\*\*)?\s*:?\s*(?:\*\*)?\s*$/i;

/** Promote loose section-name lines to "## NAME" so splitSections sees them. */
function promoteLooseHeaders(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      const m = LOOSE_HEADER.exec(line);
      return m ? `## ${m[1]!.toUpperCase().replace(/[ -]/g, '_')}` : line;
    })
    .join('\n');
}

/** Split, and if every header hid inside a code fence (a fenced reply), split again without fences. */
function originSections(md: string): MdSection[] {
  const text = promoteLooseHeaders(md.replace(/\r\n?/g, '\n'));
  const first = splitSections(text);
  if (first.some((s) => originSectionKey(s.title))) return first;
  return splitSections(text.replace(/^\s*```[\w-]*\s*$/gm, ''));
}

/* ------------------------------------------------------------------ */
/* Field readers (exported for tests and the review screen)            */
/* ------------------------------------------------------------------ */

const PILLAR_SYNONYMS: Record<string, Pillar> = {
  FITNESS: 'BODY',
  HEALTH: 'BODY',
  PHYSICAL: 'BODY',
  TRAINING: 'BODY',
  SPORT: 'BODY',
  SKINCARE: 'SKIN',
  'SKIN CARE': 'SKIN',
  LOOKS: 'SKIN',
  APPEARANCE: 'SKIN',
  MENTAL: 'MIND',
  MINDSET: 'MIND',
  SOCIAL: 'MIND',
  RELATIONSHIPS: 'MIND',
  PEOPLE: 'MIND',
  CAREER: 'WORK',
  STUDY: 'WORK',
  STUDIES: 'WORK',
  COLLEGE: 'WORK',
  BUSINESS: 'WORK',
  PHONE: 'DOPAMINE',
  SCREEN: 'DOPAMINE',
  'SCREEN TIME': 'DOPAMINE',
  DIGITAL: 'DOPAMINE',
};

const PILLAR_NAMES = PILLARS.map((p) => PILLAR_LABEL[p]).join(', ');

/** Strip markdown emphasis, code ticks and wrapping double quotes from one cell. */
function clean(s: string | undefined): string {
  return (s ?? '')
    .replace(/\*\*|__|`/g, '')
    .trim()
    .replace(/^["“”]+|["“”]+$/g, '')
    .trim();
}

/** Exact sub-stat name for a pillar, case-insensitive, tolerating a plural ("Routines"). */
export function matchSubStat(pillar: Pillar, raw: string | undefined): string | undefined {
  const t = clean(raw).toLowerCase();
  if (!t) return undefined;
  return SUBSTATS[pillar].find((s) => {
    const n = s.toLowerCase();
    return n === t || `${n}s` === t || n === `${t}s`;
  });
}

/** The pillar that owns a sub-stat name, if any (names are unique across pillars). */
export function pillarOfSubStat(raw: string | undefined): { pillar: Pillar; subStat: string } | undefined {
  for (const p of PILLARS) {
    const s = matchSubStat(p, raw);
    if (s) return { pillar: p, subStat: s };
  }
  return undefined;
}

export interface PillarRead {
  pillar?: Pillar;
  /** Set when the cell also named a sub-stat ("Body/Endurance") or was a sub-stat. */
  subStat?: string;
  /** The text that was read loosely (a synonym or a sub-stat), for a note. */
  loose?: string;
}

/** "Body", "body", "[Body]", "Body pillar", "Body/Endurance", "Fitness", "Endurance" → BODY. */
export function readPillar(raw: string | undefined): PillarRead {
  const t = clean(raw)
    .replace(/[[\]()]/g, ' ')
    .replace(/\bpillar\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!t) return {};
  const direct = pillarFromLabel(t);
  if (direct) return { pillar: direct };
  const combined = /^([A-Za-z]+)\s*[/:·>–—-]\s*([A-Za-z ]+)$/.exec(t);
  if (combined) {
    const p = pillarFromLabel(combined[1]!);
    if (p) return { pillar: p, subStat: combined[2]!.trim() };
  }
  const syn = PILLAR_SYNONYMS[t.toUpperCase()];
  if (syn) return { pillar: syn, loose: t };
  const owner = pillarOfSubStat(t);
  if (owner) return { pillar: owner.pillar, subStat: owner.subStat, loose: t };
  return {};
}

const DAY_TOKENS: Record<string, number> = {
  su: 0, sun: 0, sunday: 0, sundays: 0,
  mo: 1, mon: 1, monday: 1, mondays: 1, m: 1,
  tu: 2, tue: 2, tues: 2, tuesday: 2, tuesdays: 2,
  we: 3, wed: 3, weds: 3, wednesday: 3, wednesdays: 3, w: 3,
  th: 4, thu: 4, thur: 4, thurs: 4, thursday: 4, thursdays: 4,
  fr: 5, fri: 5, friday: 5, fridays: 5, f: 5,
  sa: 6, sat: 6, saturday: 6, saturdays: 6,
};

/** "3x a week" without named days: a sensible spread across the week. */
const SPREAD: Record<number, number[]> = { 1: [3], 2: [2, 5], 3: [1, 3, 5], 4: [1, 2, 4, 6], 5: [1, 2, 3, 4, 5], 6: [1, 2, 3, 4, 5, 6] };

const DAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface DaysRead {
  /** Sorted weekdays; [] means every day. */
  days: number[];
  ok: boolean;
  /** True when "3x a week" was spread over chosen days. */
  spread?: boolean;
}

/**
 * daily / every day → []; weekdays, Mon-Fri, Monday to Friday → [1..5]; weekends → [0, 6];
 * lists and ranges ("Mon, Wed, Fri", "Tue/Thu", "Mon-Wed, Sat", "Fri-Mon") → sorted days;
 * "3x a week" → [1, 3, 5]. All seven days collapse to [] (daily). Unreadable → { days: [], ok: false }.
 */
export function parseDays(raw: string | undefined): DaysRead {
  const t = clean(raw)
    .toLowerCase()
    .replace(/[–—]/g, '-')
    .replace(/\./g, '')
    .trim();
  if (!t) return { days: [], ok: false };
  if (/\b(daily|every ?day|everyday|each day|all days|all week|7 days|seven days|7\/7)\b|\b7 ?x\b/.test(t)) return { days: [], ok: true };

  const set = new Set<number>();
  let matched = false;
  const addAll = (list: number[]) => {
    list.forEach((d) => set.add(d));
    matched = true;
  };
  if (/\bweek ?days?\b|\bwork ?days?\b/.test(t)) addAll([1, 2, 3, 4, 5]);
  if (/\bweek ?ends?\b/.test(t)) addAll([0, 6]);

  const times = /\b([1-7])\s*(?:x|×|times|days?)\s*(?:a|per|\/|each)?\s*w(?:ee)?k\b/.exec(t) ?? /^([1-7])\s*(?:x|×)$/.exec(t);
  if (times && !matched) {
    const n = Number(times[1]);
    return n >= 7 ? { days: [], ok: true } : { days: SPREAD[n]!, ok: true, spread: true };
  }

  const tokens = t
    .replace(/\s*-\s*/g, '-')
    .replace(/\s*\b(?:to|through|thru|till|until)\b\s*/g, '-')
    .replace(/\band\b/g, ',')
    .split(/[\s,;/+&]+/)
    .filter(Boolean);
  for (const tok of tokens) {
    const range = /^([a-z]+)-([a-z]+)$/.exec(tok);
    if (range) {
      const a = DAY_TOKENS[range[1]!];
      const b = DAY_TOKENS[range[2]!];
      if (a === undefined || b === undefined) continue;
      for (let d = a, guard = 0; guard < 7; d = (d + 1) % 7, guard++) {
        set.add(d);
        if (d === b) break;
      }
      matched = true;
      continue;
    }
    const d = DAY_TOKENS[tok];
    if (d !== undefined) {
      set.add(d);
      matched = true;
    }
  }
  if (!matched || set.size === 0) return { days: [], ok: false };
  const days = [...set].sort((a, b) => a - b);
  return { days: days.length === 7 ? [] : days, ok: true };
}

export function formatDays(days: number[]): string {
  if (days.length === 0 || days.length === 7) return 'daily';
  const key = days.join(',');
  if (key === '1,2,3,4,5') return 'weekdays';
  if (key === '0,6') return 'weekends';
  if (key === '1,2,3,4,5,6') return 'Mon-Sat';
  return days.map((d) => DAY_SHORT[d]).join(', ');
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function to24(h: number, ampm: string | undefined): number {
  if (ampm === 'pm' && h < 12) return h + 12;
  if (ampm === 'am' && h === 12) return 0;
  return h;
}

/** "06:00-07:30", "6-7:30am", "9 to 11", "10pm-11pm" → "HH:MM-HH:MM"; "none" → undefined (ok). */
export function parseWindow(raw: string | undefined): { window?: string; ok: boolean } {
  const t = clean(raw).toLowerCase();
  if (!t || /^(none|no|n\/a|na|-|–|—|any ?time|any|flexible|not fixed|no window)$/.test(t)) return { ok: true };
  const m = /(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?\s*(?:-|–|—|to|until|till)\s*(\d{1,2})(?:[:.](\d{2}))?\s*(am|pm)?/.exec(t);
  if (!m) return { ok: false };
  const h1 = to24(Number(m[1]), m[3] ?? m[6]);
  const h2 = to24(Number(m[4]), m[6] ?? m[3]);
  const m1 = Number(m[2] ?? 0);
  const m2 = Number(m[5] ?? 0);
  if (h1 > 23 || h2 > 23 || m1 > 59 || m2 > 59) return { ok: false };
  return { window: `${pad2(h1)}:${pad2(m1)}-${pad2(h2)}:${pad2(m2)}`, ok: true };
}

/** "2027-02-14" (also 2027-2-4) or a date Date.parse understands → day key; none/tbd → undefined (ok). */
export function parseTargetDate(raw: string | undefined): { date?: string; ok: boolean } {
  const t = clean(raw);
  if (!t || /^(none|no|n\/a|na|-|–|—|tbd|someday|ongoing|no date|open)$/i.test(t)) return { ok: true };
  const iso = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(t);
  if (iso) {
    const y = Number(iso[1]);
    const mo = Number(iso[2]);
    const d = Number(iso[3]);
    if (mo >= 1 && mo <= 12 && d >= 1 && d <= 31) return { date: `${y}-${pad2(mo)}-${pad2(d)}`, ok: true };
    return { ok: false };
  }
  if (/\d{4}/.test(t)) {
    const ms = Date.parse(t);
    if (!Number.isNaN(ms)) return { date: toDayKey(new Date(ms)), ok: true };
  }
  return { ok: false };
}

/* ------------------------------------------------------------------ */
/* Rows                                                                */
/* ------------------------------------------------------------------ */

const HEADER_FIRST_CELLS = new Set(['name', 'skill', 'skills', 'routine', 'routines', 'title', 'goal', 'goals']);

function short(line: string): string {
  return line.length > 60 ? `${line.slice(0, 57)}…` : line;
}

/** Bullet lines of a list section split into cells; table rules, header rows and prose are dropped. */
function rowsOf(body: string, label: string, notes: string[]): string[][] {
  const rows: string[][] = [];
  for (const line of bullets(body)) {
    if (FENCE_LINE.test(line) || RULE_LINE.test(line)) continue;
    if (!line.includes('|')) {
      if (!/[:：]$/.test(line)) notes.push(`Skipped a line under ${label} with no | fields: "${short(line)}".`);
      continue;
    }
    if (/^[\s|:\-–—]+$/.test(line)) continue;
    let l = line.trim();
    if (l.startsWith('|')) l = l.slice(1);
    if (l.endsWith('|')) l = l.slice(0, -1);
    const cells = l.split('|').map(clean);
    if (HEADER_FIRST_CELLS.has(cells[0]!.toLowerCase())) continue;
    if (!cells[0]) continue;
    rows.push(cells);
  }
  return rows;
}

function clampInt(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

const LEVEL_CELL = /^\D{0,12}\d{1,3}(?:\.\d+)?\s*(?:\/\s*100)?\s*$/;

function parseSkills(body: string, notes: string[]): OriginSkill[] {
  const out: OriginSkill[] = [];
  for (const cells of rowsOf(body, 'SKILLS', notes)) {
    const name = cells[0]!;
    let pillarIdx = -1;
    let pillar: Pillar | undefined;
    for (let i = 1; i < cells.length && pillarIdx < 0; i++) {
      const r = readPillar(cells[i]);
      if (r.pillar) {
        pillarIdx = i;
        pillar = r.pillar;
        if (r.loose) notes.push(`Read "${r.loose}" as ${PILLAR_LABEL[r.pillar]} for the skill "${name}".`);
      }
    }
    if (!pillar) {
      notes.push(`Skipped the skill "${name}": no pillar out of ${PILLAR_NAMES}.`);
      continue;
    }
    let levelIdx = -1;
    let level: number | undefined;
    for (let i = 1; i < cells.length && levelIdx < 0; i++) {
      if (i !== pillarIdx && LEVEL_CELL.test(cells[i]!)) {
        levelIdx = i;
        level = num(cells[i]);
      }
    }
    if (level === undefined) {
      notes.push(`No level for the skill "${name}"; set to 10.`);
      level = 10;
    } else if (level < 1 || level > 100) {
      notes.push(`Level ${level} for "${name}" is outside 1-100; kept it inside.`);
    }
    const why = cells.slice(Math.max(pillarIdx, levelIdx) + 1).filter(Boolean).join(' | ');
    out.push({ name, pillar, level: clampInt(level, 1, 100), why });
  }
  return out;
}

function parseRoutines(body: string, notes: string[]): OriginRoutine[] {
  const out: OriginRoutine[] = [];
  for (let cells of rowsOf(body, 'ROUTINES', notes)) {
    const name = cells[0]!;
    const read = readPillar(cells[1]);
    // "Body/Endurance | 3 | …" or "Endurance | 3 | …": the sub-stat sat in the pillar cell, so every
    // later field is one place early. Put the sub-stat back in its own cell.
    if (read.subStat && cells[2] !== undefined && num(cells[2]) !== undefined && !pillarOfSubStat(cells[2])) {
      cells = [cells[0]!, cells[1]!, read.subStat, ...cells.slice(2)];
    }
    let pillar = read.pillar;
    if (!pillar) {
      const owner = pillarOfSubStat(cells[2]);
      if (owner) {
        pillar = owner.pillar;
        notes.push(`No pillar for "${name}"; ${owner.subStat} is a ${PILLAR_LABEL[owner.pillar]} sub-stat, so it goes there.`);
      }
    } else if (read.loose) {
      notes.push(`Read "${read.loose}" as ${PILLAR_LABEL[pillar]}${read.subStat ? `/${read.subStat}` : ''} for the routine "${name}".`);
    }
    if (!pillar) {
      notes.push(`Skipped the routine "${name}": no pillar out of ${PILLAR_NAMES}.`);
      continue;
    }

    let subStat = matchSubStat(pillar, cells[2]) ?? (read.subStat ? matchSubStat(pillar, read.subStat) : undefined);
    if (!subStat) {
      const first = SUBSTATS[pillar][0];
      const elsewhere = pillarOfSubStat(cells[2]);
      const said = clean(cells[2]);
      notes.push(
        elsewhere
          ? `"${name}": ${elsewhere.subStat} is a ${PILLAR_LABEL[elsewhere.pillar]} sub-stat, so it counts toward ${PILLAR_LABEL[pillar]}/${first}.`
          : said
            ? `"${name}": "${said}" is not a ${PILLAR_LABEL[pillar]} sub-stat; it counts toward ${first}.`
            : `"${name}": no sub-stat given; it counts toward ${PILLAR_LABEL[pillar]}/${first}.`,
      );
      subStat = first;
    }

    let weight = num(cells[3]);
    if (weight === undefined) {
      notes.push(`"${name}": no weight given; set to 2.`);
      weight = 2;
    }

    const daysRead = parseDays(cells[4]);
    if (!daysRead.ok) {
      notes.push(`"${name}": could not read the days${cells[4] ? ` "${cells[4]}"` : ''}; set to daily.`);
    } else if (daysRead.spread) {
      notes.push(`"${name}": read "${cells[4]}" as ${formatDays(daysRead.days)}.`);
    }

    const windowRead = parseWindow(cells[5]);
    if (!windowRead.ok) notes.push(`"${name}": could not read the window "${cells[5]}"; left it open.`);

    out.push({
      name,
      pillar,
      subStat,
      weight: clampInt(weight, 1, 5),
      days: daysRead.days,
      window: windowRead.window,
      upside: cells[6] ?? '',
      cost: cells.slice(7).filter(Boolean).join(' | '),
    });
  }
  return out;
}

function looksLikeDateOrNone(s: string): boolean {
  const r = parseTargetDate(s);
  return /\d{4}/.test(s) ? r.ok && !!r.date : r.ok;
}

function parseGoals(body: string, notes: string[]): OriginGoal[] {
  const out: OriginGoal[] = [];
  for (const cells of rowsOf(body, 'GOALS', notes)) {
    const title = cells[0]!;
    const read = readPillar(cells[1]);
    if (!read.pillar) {
      notes.push(`Skipped the goal "${title}": no pillar out of ${PILLAR_NAMES}.`);
      continue;
    }
    if (read.loose) notes.push(`Read "${read.loose}" as ${PILLAR_LABEL[read.pillar]} for the goal "${title}".`);
    const rest = cells.slice(2);
    let why = '';
    let dateCell: string | undefined;
    if (rest.length >= 2) {
      dateCell = rest[rest.length - 1];
      why = rest.slice(0, -1).filter(Boolean).join(' | ');
    } else if (rest.length === 1) {
      if (looksLikeDateOrNone(rest[0]!)) dateCell = rest[0];
      else why = rest[0]!;
    }
    const date = parseTargetDate(dateCell);
    if (!date.ok) {
      notes.push(`"${title}": could not read the date "${dateCell}"; left it open.`);
      why = [why, dateCell].filter(Boolean).join(' | ');
    }
    out.push({ title, pillar: read.pillar, why, targetDate: date.date });
  }
  return out;
}

function dedupe<T>(items: T[], name: (t: T) => string, label: string, notes: string[]): T[] {
  const seen = new Set<string>();
  return items.filter((it) => {
    const key = name(it).toLowerCase();
    if (seen.has(key)) {
      notes.push(`"${name(it)}" appeared twice under ${label}; kept the first.`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

/* ------------------------------------------------------------------ */
/* Entry point                                                         */
/* ------------------------------------------------------------------ */

export function parseOriginReply(md: string): OriginReply {
  const groups: Record<OriginSectionKey, string[]> = { STATE_OF_ME: [], SKILLS: [], ROUTINES: [], GOALS: [], BRIEF: [], AFFIRMATIONS: [] };
  const notes: string[] = [];
  let current: OriginSectionKey | undefined;

  for (const s of originSections(md ?? '')) {
    const key = originSectionKey(s.title);
    const body = stripRules(s.body);
    if (key) {
      current = key;
      if (body) groups[key].push(body);
      continue;
    }
    if (!s.title || !current) continue; // text before the first known header
    // An unknown header inside a known section is a sub-heading of it (### Where I am, ### Body).
    if (current === 'STATE_OF_ME') groups.STATE_OF_ME.push(`## ${s.rawTitle.replace(/[*:]+$/g, '').trim()}${body ? `\n${body}` : ''}`);
    else if (current === 'BRIEF') groups.BRIEF.push([s.rawTitle.trim(), body].filter(Boolean).join('\n'));
    else if (current === 'AFFIRMATIONS') notes.push(`Left out an extra section after AFFIRMATIONS: "${s.rawTitle.trim()}".`);
    else if (body) groups[current].push(body);
  }

  const stateBody = groups.STATE_OF_ME.join('\n\n').trim();
  const stateOfMeMd = stateBody ? `# State of Me\n\n${stateBody}\n` : '';
  const briefMd = groups.BRIEF.join('\n\n').trim();
  const affirmations = bullets(groups.AFFIRMATIONS.join('\n'))
    .filter((l) => !FENCE_LINE.test(l))
    .map((l) => clean(l))
    .filter(Boolean);

  const skills = dedupe(parseSkills(groups.SKILLS.join('\n'), notes), (s) => s.name, 'SKILLS', notes);
  const routines = dedupe(parseRoutines(groups.ROUTINES.join('\n'), notes), (r) => r.name, 'ROUTINES', notes);
  const goals = dedupe(parseGoals(groups.GOALS.join('\n'), notes), (g) => g.title, 'GOALS', notes);

  const missing: OriginSectionKey[] = [];
  if (!stateOfMeMd) missing.push('STATE_OF_ME');
  if (!briefMd) missing.push('BRIEF');
  const errors = [...missing.map((k) => `No ## ${k} section.`), ...notes];

  return { ok: missing.length === 0, stateOfMeMd, skills, routines, goals, briefMd, affirmations, errors, missing };
}

/** One sentence for the paste box when the reply cannot be used. */
export function originReplyProblem(r: OriginReply): string {
  if (r.ok) return '';
  const what = r.missing.map((k) => `## ${k}`).join(' and ');
  return `This reply has no ${what} section. Copy Claude's whole answer, from ## STATE_OF_ME to the last affirmation, and paste it again.`;
}
