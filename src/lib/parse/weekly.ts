/**
 * Parser and writer for the weekly review and monthly digest replies.
 *
 *   ## DIGEST       → a Digest row (kind weekly or monthly; INSIGHTS are appended to it)
 *   ## STATE_OF_ME  → profile.stateOfMeMd (its own "# State of Me" / "## Where I am" headers are kept)
 *   ## QUESTS       → today's DayLog, ids prefixed "wk-" / "mo-" so a nightly reply keeps them
 *   ## WARNINGS     → today's DayLog, prefixed "This week: " / "This month: "
 *   ## INSIGHTS     → appended to the digest
 *   ## BOSS         → digest.boss (weekly only; optional, older replies have none, "- None" sets none)
 */
import { db } from '@/data/db';
import { dayLogRepo, profileRepo, stamp } from '@/data/repo';
import { pillarFromLabel, type Digest, type Quest } from '@/data/types';
import { nowIso, todayKey } from '@/lib/dates';
import { bossWeek, matchWeakTo, type WeeklyBoss } from '@/lib/game/boss';
import { parseQuestLine } from './reply';
import { bullets, num, splitSections } from './sections';

export type PeriodKind = 'weekly' | 'monthly';

export interface ParsedWeekly {
  ok: boolean;
  digestMd: string;
  stateOfMeMd: string;
  quests: Quest[];
  warnings: string[];
  insights: string[];
  extraSections: { title: string; body: string }[];
  errors: string[];
  /** From ## BOSS. Absent when there was none, it said "None", or a field was missing (see errors). */
  boss?: ParsedBoss;
}

/** A boss as Claude wrote it: weak-to names are matched to routines and the week is set when saved. */
export type ParsedBoss = Omit<WeeklyBoss, 'weakTo' | 'start' | 'end'> & { weakTo: string[] };

export const NO_DIGEST_ERROR = 'No ## DIGEST section. Nothing was saved.';

export const PERIOD_QUEST_PREFIX: Record<PeriodKind, string> = { weekly: 'wk-', monthly: 'mo-' };
export const PERIOD_WARNING_PREFIX: Record<PeriodKind, string> = { weekly: 'This week: ', monthly: 'This month: ' };

/** Quests set by a weekly or monthly review (they outlive a nightly re-paste). */
export function isPeriodQuest(q: Pick<Quest, 'id'>): boolean {
  return q.id.startsWith(PERIOD_QUEST_PREFIX.weekly) || q.id.startsWith(PERIOD_QUEST_PREFIX.monthly);
}

export function isPeriodWarning(w: string): boolean {
  return w.startsWith(PERIOD_WARNING_PREFIX.weekly) || w.startsWith(PERIOD_WARNING_PREFIX.monthly);
}

type Top = 'DIGEST' | 'STATE_OF_ME' | 'QUESTS' | 'WARNINGS' | 'INSIGHTS' | 'BOSS';

const TOP_ALIASES: Record<string, Top> = {
  DIGEST: 'DIGEST',
  WEEKLY_DIGEST: 'DIGEST',
  MONTHLY_DIGEST: 'DIGEST',
  WEEK_DIGEST: 'DIGEST',
  MONTH_DIGEST: 'DIGEST',
  STATE_OF_ME: 'STATE_OF_ME',
  QUESTS: 'QUESTS',
  QUEST: 'QUESTS',
  WARNINGS: 'WARNINGS',
  WARNING: 'WARNINGS',
  INSIGHTS: 'INSIGHTS',
  INSIGHT: 'INSIGHTS',
  BOSS: 'BOSS',
  WEEKLY_BOSS: 'BOSS',
  BOSS_FIGHT: 'BOSS',
};

const LOOSE_HEADER =
  /^\s{0,3}(?:#{1,6}\s*)?(?:\d+[.)]\s*)?(?:\*\*|__)?\s*(digest|weekly digest|monthly digest|state[ _]of[ _]me|quests?|warnings?|insights?|(?:weekly )?boss(?: fight)?)\s*(?:\*\*|__)?\s*(?:\([^)]*\))?\s*:?\s*(?:\*\*|__)?\s*$/i;
const FENCE_LINE = /^\s*(?:```|~~~)[\w-]*\s*$/;
const NONE_LINE = /^(?:none|nothing|n\/a|-+)\.?$/i;

function normalise(md: string): string {
  return md
    .split('\n')
    .map((line) => {
      // Keep "# State of Me" (a single hash) as the rewrite's own title; only "##"+ or bare forms are reply headers.
      if (/^\s{0,3}#\s+state of me\s*$/i.test(line)) return line;
      const m = LOOSE_HEADER.exec(line);
      return m ? `## ${m[1]!.trim().toUpperCase().replace(/\s+/g, '_')}` : line;
    })
    .join('\n');
}

function plain(line: string): string {
  return line.replace(/\*\*|__|`/g, '').trim();
}

function items(body: string): string[] {
  return bullets(body)
    .filter((l) => !/^#{1,6}\s/.test(l))
    .map(plain)
    .filter((l) => l && !NONE_LINE.test(l));
}

interface Collected {
  top: Map<Top, string[]>;
  extra: { title: string; body: string }[];
}

function collect(text: string): Collected {
  const top = new Map<Top, string[]>();
  const extra: Collected['extra'] = [];
  let current: Top | null = null;
  for (const s of splitSections(normalise(text))) {
    if (!s.title) continue;
    const t = TOP_ALIASES[s.title];
    if (t && !(current === 'STATE_OF_ME' && t === 'STATE_OF_ME')) {
      current = t;
      top.set(t, [...(top.get(t) ?? []), s.body]);
      continue;
    }
    if (!current) {
      extra.push({ title: s.rawTitle, body: s.body });
      continue;
    }
    // A header inside a section: the rewrite's own "# State of Me" / "## Where I am", or a sub-heading.
    const header = t === 'STATE_OF_ME' ? '# State of Me' : current === 'STATE_OF_ME' || current === 'DIGEST' ? `## ${s.rawTitle}` : '';
    const parts = top.get(current) ?? [];
    parts.push(header ? `${header}\n${s.body}` : s.body);
    top.set(current, parts);
  }
  return { top, extra };
}

type BossField = 'name' | 'pillar' | 'hp' | 'weakTo' | 'reward' | 'taunt';

const BOSS_FIELDS: Record<string, BossField> = {
  name: 'name',
  boss: 'name',
  'boss name': 'name',
  pillar: 'pillar',
  hp: 'hp',
  health: 'hp',
  'hit points': 'hp',
  'weak to': 'weakTo',
  'weak against': 'weakTo',
  weakness: 'weakTo',
  weaknesses: 'weakTo',
  reward: 'reward',
  taunt: 'taunt',
};

const BOSS_FIELD_LABEL: Record<BossField, string> = { name: 'Name', pillar: 'Pillar', hp: 'HP', weakTo: 'Weak to', reward: 'Reward', taunt: 'Taunt' };

/** '"Evening walk" (weight 2)' → 'Evening walk'. */
function routineName(raw: string): string {
  return raw
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/^["'“‘]+|["'”’.]+$/g, '')
    .trim();
}

/** ## BOSS body → a boss, nothing ("None"), or an error note naming the missing fields. */
export function parseBoss(body: string): { boss?: ParsedBoss; error?: string } {
  const lines = bullets(body).map(plain).filter(Boolean);
  if (!lines.length || lines.every((l) => NONE_LINE.test(l))) return {};
  const fields: Partial<Record<BossField, string>> = {};
  const weakTo: string[] = [];
  let current: BossField | undefined;
  for (const line of lines) {
    const m = /^([^:|]{1,40}?)\s*[:|]\s*(.*)$/.exec(line);
    const field = m ? BOSS_FIELDS[m[1]!.toLowerCase().replace(/\s+/g, ' ').trim()] : undefined;
    if (m && field) {
      const value = m[2]!.trim();
      current = value ? undefined : field;
      if (field === 'weakTo') weakTo.push(...value.split(/[,;]/));
      else if (value) fields[field] = value;
      continue;
    }
    // "Weak to:" with nothing after it, followed by one routine per line.
    if (current === 'weakTo') weakTo.push(line);
    else current = undefined;
  }
  const names = [...new Set(weakTo.map(routineName).filter(Boolean))];
  const name = fields.name ? routineName(fields.name) : '';
  const pillar = fields.pillar ? pillarFromLabel(fields.pillar.replace(/[^a-z]/gi, '')) : undefined;
  const hpRaw = num(fields.hp);
  const hp = hpRaw !== undefined ? Math.round(hpRaw) : 0;

  const missing: BossField[] = [];
  if (!name) missing.push('name');
  if (!pillar) missing.push('pillar');
  if (hp <= 0) missing.push('hp');
  if (!names.length) missing.push('weakTo');
  if (missing.length || !pillar) {
    const list = missing.map((f) => BOSS_FIELD_LABEL[f]);
    const named = list.length > 1 ? `${list.slice(0, -1).join(', ')} or ${list[list.length - 1]}` : list[0];
    return { error: `The ## BOSS section has no usable ${named}, so no boss was set this week.` };
  }
  return { boss: { name, pillar, hp, weakTo: names, reward: fields.reward ?? '', taunt: fields.taunt ?? '' } };
}

export function parseWeeklyReply(md: string): ParsedWeekly {
  const text = md.replace(/^﻿/, '').replace(/\r\n?/g, '\n');
  let { top, extra } = collect(text);
  if (!top.has('DIGEST')) {
    const unfenced = collect(
      text
        .split('\n')
        .filter((l) => !FENCE_LINE.test(l))
        .join('\n'),
    );
    if (unfenced.top.has('DIGEST')) ({ top, extra } = unfenced);
  }

  const body = (t: Top) => (top.get(t) ?? []).join('\n\n').trim();
  const digestMd = body('DIGEST');
  if (!digestMd) {
    return { ok: false, digestMd: '', stateOfMeMd: '', quests: [], warnings: [], insights: [], extraSections: extra, errors: [NO_DIGEST_ERROR] };
  }

  const errors: string[] = [];
  let stateOfMeMd = body('STATE_OF_ME');
  if (stateOfMeMd && !/^#\s+state of me/i.test(stateOfMeMd)) stateOfMeMd = `# State of Me\n\n${stateOfMeMd}`;
  if (!stateOfMeMd) errors.push('No ## STATE_OF_ME section. The State of Me was left as it was.');

  const quests: Quest[] = [];
  for (const line of items(body('QUESTS'))) {
    if (/:\s*$/.test(line)) continue;
    const q = parseQuestLine(line);
    if (q && !quests.some((x) => x.text.toLowerCase() === q.text.toLowerCase())) quests.push(q);
  }
  if (!top.has('QUESTS')) errors.push('No ## QUESTS section.');

  const boss = top.has('BOSS') ? parseBoss(body('BOSS')) : {};
  if (boss.error) errors.push(boss.error);

  return {
    ok: true,
    digestMd,
    stateOfMeMd,
    quests,
    warnings: items(body('WARNINGS')),
    insights: items(body('INSIGHTS')),
    extraSections: extra,
    errors,
    ...(boss.boss ? { boss: boss.boss } : {}),
  };
}

/**
 * Save a parsed weekly or monthly reply: upsert the Digest for that period, replace the State of
 * Me, and put the quests and warnings on today's DayLog (replacing any from an earlier paste of the
 * same kind). Returns the saved Digest.
 */
export async function applyWeeklyReply(
  parsed: ParsedWeekly,
  kind: PeriodKind,
  periodStart: string,
  periodEnd: string,
  promptId?: string,
  date?: string,
): Promise<Digest> {
  if (!parsed.ok) throw new Error(parsed.errors[0] ?? NO_DIGEST_ERROR);
  const profile = await profileRepo.ensure();
  const today = date ?? todayKey(profile.settings.rolloverHour);
  const md = parsed.insights.length ? `${parsed.digestMd}\n\nInsights:\n${parsed.insights.map((i) => `- ${i}`).join('\n')}` : parsed.digestMd;

  return db.transaction('rw', [db.digests, db.profile, db.dayLogs, db.routines], async () => {
    const existing = await db.digests
      .where('periodStart')
      .equals(periodStart)
      .filter((d) => d.kind === kind)
      .first();
    const digest: Digest = existing
      ? { ...existing, periodEnd, md, promptId: promptId ?? existing.promptId, updatedAt: nowIso() }
      : stamp<Digest>({ kind, periodStart, periodEnd, md, promptId });
    // A re-paste replaces the boss too. Only weekly reviews set one.
    if (kind === 'weekly' && parsed.boss) {
      const routines = await db.routines.filter((r) => !r.archived).toArray();
      digest.boss = { ...parsed.boss, weakTo: matchWeakTo(parsed.boss.weakTo, routines), ...bossWeek(periodEnd) };
    } else {
      delete digest.boss;
    }
    await db.digests.put(digest);

    if (parsed.stateOfMeMd) await profileRepo.update({ stateOfMeMd: parsed.stateOfMeMd, stateOfMeAt: nowIso() });

    const log = await dayLogRepo.ensure(today);
    const qPrefix = PERIOD_QUEST_PREFIX[kind];
    const wPrefix = PERIOD_WARNING_PREFIX[kind];
    await dayLogRepo.update(today, {
      quests: [...log.quests.filter((q) => !q.id.startsWith(qPrefix)), ...parsed.quests.map((q) => ({ ...q, id: `${qPrefix}${q.id}` }))],
      warnings: [...log.warnings.filter((w) => !w.startsWith(wPrefix)), ...parsed.warnings.map((w) => `${wPrefix}${w}`)],
    });
    return digest;
  });
}
