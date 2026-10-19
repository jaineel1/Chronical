/**
 * Lore: the player writes freely about a skill, person, goal or book; Claude's reply is turned
 * into facts (kept on the Lore row), achievements (skills), lessons (books) and a few whitelisted
 * field updates.
 */
import { db } from '@/data/db';
import { promptRepo, stamp } from '@/data/repo';
import { PILLAR_LABEL, type Achievement, type BookStatus, type Lesson, type Lore } from '@/data/types';
import { formatShortDate, nowIso } from '@/lib/dates';
import { isDayKey, parseLoreReply, type LoreParse } from '@/lib/parse/lore';
import { num } from '@/lib/parse/sections';
import type { LoreSubject, LoreSubjectType } from '@/lib/prompt/lore';
import type { HandoffResult } from '@/ui/PromptHandoff';
import { daysLabel, daysQuiet, quietLabel } from './people';
import { formatAmount, isMetric } from './progress';
import { clampLevel, formatSkillLevel, skillBand } from './skills';

/* ------------------------------------------------------------------ */
/* Remembered facts                                                    */
/* ------------------------------------------------------------------ */

/** Facts from earlier lore notes, oldest first, without duplicates. */
export function rememberedFacts(rows: readonly Pick<Lore, 'structuredMd'>[], limit = 12): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const row of rows) {
    if (!row.structuredMd) continue;
    for (const fact of parseLoreReply(row.structuredMd).facts) {
      const key = fact.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(fact);
    }
  }
  return out.slice(-limit);
}

/* ------------------------------------------------------------------ */
/* What the game already knows about the item                          */
/* ------------------------------------------------------------------ */

export async function loreSubject(type: LoreSubjectType, id: string, today: string): Promise<LoreSubject | null> {
  const known = rememberedFacts(await db.lore.where('[itemType+itemId]').equals([type, id]).sortBy('createdAt'));
  const knownLines = known.map((f) => `Already known: ${f}`);

  if (type === 'skill') {
    const s = await db.skills.get(id);
    if (!s) return null;
    const ach = (await db.achievements.where('skillId').equals(id).toArray()).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3);
    return {
      type,
      name: s.name,
      summaryLines: [
        `Pillar: ${PILLAR_LABEL[s.pillar]}`,
        `Level ${formatSkillLevel(s.level)} of 100 (${skillBand(s.level)})`,
        `${formatAmount(s.hours)} hours logged`,
        ...(s.goal ? [`What it is for: ${s.goal}`] : []),
        ...s.milestones.map((m) => `Next milestone: ${m}`),
        ...ach.map((a) => `Achievement, ${formatShortDate(a.date)}: ${a.text}`),
        ...knownLines,
      ],
    };
  }

  if (type === 'person') {
    const p = await db.people.get(id);
    if (!p) return null;
    const days = daysQuiet(p, today);
    return {
      type,
      name: p.name,
      summaryLines: [
        `Circle: ${p.circle}`,
        `Closeness ${p.closeness} of 5${p.wantCloser ? ', the player wants to be closer' : ''}`,
        `Wants contact every ${daysLabel(p.contactEveryDays)}; ${days === null ? 'no contact logged yet' : days === 0 ? 'last contact today' : `last contact ${quietLabel(days)} ago`}`,
        ...(p.notes ? [`Notes: ${p.notes}`] : []),
        ...knownLines,
      ],
    };
  }

  if (type === 'goal') {
    const g = await db.goals.get(id);
    if (!g) return null;
    const ms = await db.milestones.where('goalId').equals(id).toArray();
    return {
      type,
      name: g.title,
      summaryLines: [
        `Pillar: ${PILLAR_LABEL[g.pillar]}`,
        `Status: ${g.status}`,
        ...(g.why ? [`Why: ${g.why}`] : []),
        ...(g.targetDate ? [`Target date: ${g.targetDate}`] : []),
        ...ms.map((m) => {
          const amount = isMetric(m) ? `: ${formatAmount(m.current)} of ${formatAmount(m.target)}${m.unit ? ` ${m.unit}` : ''}` : '';
          return `Milestone: ${m.title}${amount}${m.doneAt ? ' (done)' : ''}${m.dueDate ? `, due ${m.dueDate}` : ''}`;
        }),
        ...knownLines,
      ],
    };
  }

  const b = await db.books.get(id);
  if (!b) return null;
  const lessons = await db.lessons.where('bookId').equals(id).toArray();
  return {
    type,
    name: b.title,
    summaryLines: [
      ...(b.author ? [`Author: ${b.author}`] : []),
      `Status: ${b.status}`,
      ...lessons.map((l) => `Lesson already kept: ${l.text}`),
      ...knownLines,
    ],
  };
}

/* ------------------------------------------------------------------ */
/* Whitelisted updates                                                 */
/* ------------------------------------------------------------------ */

export interface LoreChanges {
  changes: Record<string, string | number | boolean>;
  /** Readable list for the confirmation line, e.g. ["level 64", "closeness 4"]. */
  applied: string[];
  /** Keys that were present but not allowed or not readable. */
  ignored: string[];
}

function yesNo(v: string): boolean | undefined {
  const t = v.trim().toLowerCase();
  if (/^(yes|y|true|1|closer|want closer)\b/.test(t)) return true;
  if (/^(no|n|false|0)\b/.test(t)) return false;
  return undefined;
}

function bookStatus(v: string): BookStatus | undefined {
  const t = v.trim().toLowerCase();
  if (/^(reading|in progress|currently reading|started)/.test(t)) return 'reading';
  if (/^(done|finished|read|completed|complete)/.test(t)) return 'done';
  if (/^(wishlist|wish list|to read|want to read|later)/.test(t)) return 'wishlist';
  return undefined;
}

function oneLine(v: string, max = 280): string {
  return v.replace(/\s+/g, ' ').trim().slice(0, max);
}

/** Turn the reply's `## UPDATES` into a patch, keeping only the fields allowed for the type. */
export function loreChanges(type: LoreSubjectType, updates: Record<string, string>): LoreChanges {
  const changes: LoreChanges['changes'] = {};
  const applied: string[] = [];
  const ignored: string[] = [];
  for (const [key, raw] of Object.entries(updates)) {
    const value = raw.trim();
    let ok = false;
    if (type === 'skill' && key === 'level') {
      const n = num(value);
      if (n !== undefined) {
        changes.level = clampLevel(n);
        applied.push(`level ${formatSkillLevel(changes.level)}`);
        ok = true;
      }
    } else if (type === 'skill' && key === 'goal' && value) {
      changes.goal = oneLine(value, 140);
      applied.push('goal');
      ok = true;
    } else if (type === 'person' && key === 'closeness') {
      const n = num(value);
      if (n !== undefined) {
        changes.closeness = Math.max(1, Math.min(5, Math.round(n)));
        applied.push(`closeness ${changes.closeness}`);
        ok = true;
      }
    } else if (type === 'person' && key === 'contactEveryDays') {
      const n = num(value);
      if (n !== undefined && n > 0) {
        changes.contactEveryDays = Math.max(1, Math.min(365, Math.round(n)));
        applied.push(`contact every ${daysLabel(changes.contactEveryDays)}`);
        ok = true;
      }
    } else if (type === 'person' && key === 'wantCloser') {
      const b = yesNo(value);
      if (b !== undefined) {
        changes.wantCloser = b;
        applied.push(b ? 'wants closer' : 'not pushing closer');
        ok = true;
      }
    } else if (type === 'person' && key === 'notes' && value) {
      changes.notes = oneLine(value);
      applied.push('notes');
      ok = true;
    } else if (type === 'goal' && key === 'why' && value) {
      changes.why = oneLine(value);
      applied.push('why');
      ok = true;
    } else if (type === 'goal' && key === 'targetDate' && isDayKey(value)) {
      changes.targetDate = value;
      applied.push(`target date ${value}`);
      ok = true;
    } else if (type === 'book' && key === 'status') {
      const s = bookStatus(value);
      if (s) {
        changes.status = s;
        applied.push(`status ${s}`);
        ok = true;
      }
    } else if (type === 'book' && key === 'author' && value) {
      changes.author = oneLine(value, 120);
      applied.push('author');
      ok = true;
    }
    if (!ok) ignored.push(key);
  }
  return { changes, applied, ignored };
}

/* ------------------------------------------------------------------ */
/* Apply a pasted reply                                                */
/* ------------------------------------------------------------------ */

export interface ApplyLoreArgs {
  type: LoreSubjectType;
  itemId: string;
  /** What the player wrote; stored as the Lore row's text. */
  freeText: string;
  replyMd: string;
  promptId?: string;
  /** Day key used for achievements without a date. */
  today: string;
}

function plural(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}

export async function applyLoreReply(args: ApplyLoreArgs): Promise<HandoffResult & { parsed: LoreParse }> {
  const parsed = parseLoreReply(args.replyMd);
  if (!parsed.ok) {
    if (args.promptId) await promptRepo.attachReply(args.promptId, args.replyMd, false);
    return { ok: false, error: `${parsed.errors[0] ?? 'Could not read that reply.'} Nothing was saved.`, parsed };
  }
  const { changes, applied } = loreChanges(args.type, parsed.updates);
  let achievements = 0;
  let lessons = 0;
  const tables = [db.lore, db.achievements, db.lessons, db.skills, db.people, db.goals, db.books];
  const found = await db.transaction('rw', tables, async () => {
    const table = { skill: db.skills, person: db.people, goal: db.goals, book: db.books }[args.type] as unknown as {
      get(id: string): Promise<Record<string, unknown> | undefined>;
      put(row: Record<string, unknown>): Promise<unknown>;
    };
    const item = await table.get(args.itemId);
    if (!item) return false;
    await db.lore.put(
      stamp<Lore>({ itemType: args.type, itemId: args.itemId, text: args.freeText.trim(), structuredMd: args.replyMd.trim(), promptId: args.promptId }),
    );
    if (args.type === 'skill') {
      for (const a of parsed.achievements) {
        await db.achievements.put(stamp<Achievement>({ skillId: args.itemId, date: a.date ?? args.today, text: a.text, value: a.value, unit: a.unit }));
        achievements++;
      }
    }
    if (args.type === 'book') {
      const existing = new Set((await db.lessons.where('bookId').equals(args.itemId).toArray()).map((l) => l.text.trim().toLowerCase()));
      for (const text of parsed.lessons) {
        if (existing.has(text.trim().toLowerCase())) continue;
        await db.lessons.put(stamp<Lesson>({ bookId: args.itemId, text, appliedCount: 0 }));
        existing.add(text.trim().toLowerCase());
        lessons++;
      }
    }
    if (Object.keys(changes).length) await table.put({ ...item, ...changes, updatedAt: nowIso() });
    return true;
  });
  if (args.promptId) await promptRepo.attachReply(args.promptId, args.replyMd, found);
  if (!found) return { ok: false, error: 'That item no longer exists. Nothing was saved.', parsed };

  const kept = [
    parsed.facts.length ? plural(parsed.facts.length, 'fact') : '',
    achievements ? plural(achievements, 'achievement') : '',
    lessons ? plural(lessons, 'lesson') : '',
  ].filter(Boolean);
  const message = [
    kept.length ? `Kept ${kept.join(', ')}.` : 'Kept the note.',
    applied.length ? `Updated ${applied.join(', ')}.` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return { ok: true, message, parsed };
}
