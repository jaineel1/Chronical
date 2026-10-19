/**
 * Reads Claude's lore reply:
 *
 *   ## FACTS          - bullets
 *   ## ACHIEVEMENTS   2026-10-12 | Long run 22 km | 22 km
 *   ## LESSONS        - bullets (books) or none
 *   ## UPDATES        field: value
 *   ## REPLY          two to four sentences
 *
 * `ok` needs at least FACTS or REPLY. Everything else is optional and forgiving.
 */
import { bullets, section, splitSections, type MdSection } from './sections';

export interface LoreAchievement {
  /** Day key, only when the reply gave a valid YYYY-MM-DD. */
  date?: string;
  text: string;
  value?: number;
  unit?: string;
}

export interface LoreParse {
  ok: boolean;
  facts: string[];
  achievements: LoreAchievement[];
  lessons: string[];
  /** Canonical keys (`level`, `contactEveryDays`, …); unknown keys are kept lower-cased. */
  updates: Record<string, string>;
  replyMd: string;
  errors: string[];
}

const NONE_RE = /^(none|n\/a|na|-+|nothing|no change|no changes|unchanged|nothing new|nothing to update)\.?$/i;

/** Every field any lore type may update, keyed by its normalised spelling. */
const UPDATE_KEYS: Record<string, string> = {
  level: 'level',
  goal: 'goal',
  closeness: 'closeness',
  contacteverydays: 'contactEveryDays',
  contactevery: 'contactEveryDays',
  contactfrequency: 'contactEveryDays',
  wantcloser: 'wantCloser',
  wantscloser: 'wantCloser',
  notes: 'notes',
  note: 'notes',
  why: 'why',
  targetdate: 'targetDate',
  status: 'status',
  author: 'author',
};

function findSection(sections: MdSection[], titles: string[]): MdSection | undefined {
  for (const t of titles) {
    const s = section(sections, t);
    if (s) return s;
  }
  return undefined;
}

function unfence(md: string): string {
  return md.replace(/^\s*```[\w-]*\s*$/gm, '');
}

const MARKED_RE = /^\s*(?:[-*•]|\d+[.)])\s+/;

/** List items. When some lines are bullets, unmarked lines ("Here is what I will remember:") are prose, not items. */
function items(body: string | undefined): string[] {
  if (!body) return [];
  const marked = body.split('\n').filter((l) => MARKED_RE.test(l));
  return bullets(marked.length ? marked.join('\n') : body).filter((l) => !NONE_RE.test(l.replace(/[*_]/g, '').trim()));
}

/** Cells of a "| a | b |" row without the empty cells at both ends. */
function tableCells(line: string): string[] {
  return line
    .split('|')
    .map((c) => c.trim())
    .filter((c, i, all) => !(c === '' && (i === 0 || i === all.length - 1)));
}

const RULE_CELL = /^:?-{2,}:?$/;

export function isDayKey(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d);
  return date.getFullYear() === y && date.getMonth() === mo - 1 && date.getDate() === d;
}

/** "22 km" → {22, 'km'}; "1,240 pts" → {1240, 'pts'}; "none" or text → undefined. */
export function parseValueUnit(raw: string | undefined): { value?: number; unit?: string } {
  const t = (raw ?? '').trim();
  if (!t || NONE_RE.test(t)) return {};
  const m = /^([-+]?\d[\d,]*(?:\.\d+)?)\s*(.*)$/.exec(t);
  if (!m) return {};
  const value = Number(m[1]!.replace(/,/g, ''));
  if (!Number.isFinite(value)) return {};
  const unit = m[2]!.trim().replace(/\.$/, '').slice(0, 24);
  return unit && !NONE_RE.test(unit) ? { value, unit } : { value };
}

function parseAchievement(line: string, errors: string[]): LoreAchievement | undefined {
  const cells = tableCells(line);
  if (cells.length === 0 || cells.every((c) => RULE_CELL.test(c))) return undefined;
  // A table's header row ("Date | Achievement | Value") or an echoed format line.
  if (cells.length > 1 && /^(date|day|when|yyyy-mm-dd\b.*)$/i.test(cells[0]!.replace(/[*_`]/g, ''))) return undefined;
  let dateCell: string | undefined;
  let text: string | undefined;
  let valueCell: string | undefined;
  if (cells.length === 1) {
    text = cells[0];
  } else if (cells.length === 2) {
    const first = cells[0]!;
    if (isDayKey(first) || NONE_RE.test(first) || /^\d{4}[-/]\d{1,2}[-/]\d{1,2}$/.test(first)) [dateCell, text] = cells;
    else [text, valueCell] = cells;
  } else {
    [dateCell, text] = cells;
    valueCell = cells.slice(2).join(' ');
  }
  text = (text ?? '').replace(/^["“]|["”]$/g, '').trim();
  if (!text || NONE_RE.test(text)) {
    if (cells.some((c) => c && !NONE_RE.test(c))) errors.push(`Achievement without text skipped: "${line.slice(0, 60)}"`);
    return undefined;
  }
  let date: string | undefined;
  if (dateCell && !NONE_RE.test(dateCell)) {
    const normalized = dateCell.replace(/\//g, '-').replace(/^(\d{4})-(\d)-/, '$1-0$2-').replace(/-(\d)$/, '-0$1');
    if (isDayKey(normalized)) date = normalized;
    else errors.push(`Could not read the date "${dateCell}"; used today instead.`);
  }
  return { date, text, ...parseValueUnit(valueCell) };
}

function parseUpdates(body: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!body) return out;
  for (const raw of bullets(body)) {
    let line = raw;
    if (line.startsWith('|')) {
      // A "| Field | Value |" table: skip the header and rule rows, read the rest as "field: value".
      const cells = tableCells(line);
      if (cells.length < 2 || RULE_CELL.test(cells[0]!) || /^(field|key|name)$/i.test(cells[0]!.replace(/[*_`]/g, ''))) continue;
      line = `${cells[0]}: ${cells.slice(1).join(' | ')}`;
    }
    const m = /^\**`?([A-Za-z][A-Za-z _-]{0,40}?)`?\**\s*[:=|]\s*(.+)$/.exec(line);
    if (!m) continue;
    const norm = m[1]!.toLowerCase().replace(/[^a-z]/g, '');
    const key = UPDATE_KEYS[norm] ?? norm;
    const value = m[2]!
      .trim()
      .replace(/^\*+|\*+$/g, '')
      .replace(/^["“'`]|["”'`]$/g, '')
      .trim();
    if (!value || NONE_RE.test(value)) continue;
    out[key] = value;
  }
  return out;
}

export function parseLoreReply(md: string): LoreParse {
  const errors: string[] = [];
  const sections = splitSections(unfence(md ?? ''));

  const facts = items(findSection(sections, ['FACTS', 'REMEMBER', 'MEMORY'])?.body);
  const lessons = items(findSection(sections, ['LESSONS', 'LESSON'])?.body);

  const achievements: LoreAchievement[] = [];
  const achSection = findSection(sections, ['ACHIEVEMENTS']);
  if (achSection) {
    for (const line of bullets(achSection.body)) {
      if (NONE_RE.test(line.replace(/[*_]/g, '').trim())) continue;
      const a = parseAchievement(line, errors);
      if (a) achievements.push(a);
    }
  }

  const updates = parseUpdates(findSection(sections, ['UPDATES'])?.body);
  const replyMd = (findSection(sections, ['REPLY', 'RESPONSE'])?.body ?? '').trim();

  const ok = facts.length > 0 || replyMd.length > 0;
  if (!ok) errors.unshift('No ## FACTS or ## REPLY section in the reply.');
  return { ok, facts, achievements, lessons, updates, replyMd, errors };
}
