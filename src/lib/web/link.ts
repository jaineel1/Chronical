/**
 * The player's own things (goals, routines, books, skills, people) as mind-web nodes. Pure: it plans
 * which nodes to create or refresh, so `webRepo.linkExisting` can write them and the nightly prompt
 * can show the same picture before they are written.
 */
import { PILLAR_LABEL, type Book, type Goal, type Person, type Routine, type Skill, type WebNode } from '@/data/types';
import { labelKey } from './types';

export type OwnThingType = 'goal' | 'routine' | 'book' | 'skill' | 'person';

export interface OwnThing {
  type: OwnThingType;
  refId: string;
  label: string;
  /** 1-5, used only when the node is first made. */
  importance: number;
  /** Starting summary, used only when the node is first made. */
  summary: string;
}

export type NewWebNode = Omit<WebNode, 'id' | 'createdAt' | 'updatedAt'>;

export interface LinkPlan {
  create: NewWebNode[];
  /** Existing nodes that gain a refId or follow a rename. */
  update: { id: string; changes: Pick<WebNode, 'refId' | 'label'> }[];
}

export interface OwnRows {
  goals: Goal[];
  routines: Routine[];
  books: Book[];
  skills: Skill[];
  people: Person[];
}

/** Active goals, active routines, books being read, every skill and every person. */
export function ownThings(rows: OwnRows): OwnThing[] {
  const out: OwnThing[] = [];
  for (const g of rows.goals) {
    if (g.status !== 'active') continue;
    const by = g.targetDate ? ` by ${g.targetDate}` : '';
    out.push({ type: 'goal', refId: g.id, label: g.title.trim(), importance: 4, summary: `${PILLAR_LABEL[g.pillar]} goal${by}.${g.why.trim() ? ` Why: ${g.why.trim()}` : ''}` });
  }
  for (const r of rows.routines) {
    if (r.archived) continue;
    out.push({ type: 'routine', refId: r.id, label: r.name.trim(), importance: 3, summary: `${PILLAR_LABEL[r.pillar]}/${r.subStat} routine, weight ${r.weight}${r.window ? `, ${r.window}` : ''}.` });
  }
  for (const b of rows.books) {
    if (b.status !== 'reading') continue;
    out.push({ type: 'book', refId: b.id, label: b.title.trim(), importance: 2, summary: `Reading now${b.author ? `, by ${b.author}` : ''}.` });
  }
  for (const s of rows.skills) {
    out.push({ type: 'skill', refId: s.id, label: s.name.trim(), importance: 3, summary: `${PILLAR_LABEL[s.pillar]} skill, level ${Math.round(s.level)} of 100.` });
  }
  for (const p of rows.people) {
    out.push({ type: 'person', refId: p.id, label: p.name.trim(), importance: Math.min(5, Math.max(1, Math.round(p.closeness))), summary: `${p.circle}, closeness ${p.closeness} of 5.` });
  }
  return out.filter((t) => t.label.length > 0);
}

/**
 * Each thing finds its node by refId, then by (type, label) among nodes without a refId. Missing
 * nodes are created; a found node gains the refId and follows a rename. Summaries Claude wrote
 * are never touched.
 */
export function planLinks(nodes: readonly WebNode[], things: readonly OwnThing[], date: string): LinkPlan {
  const byRef = new Map(nodes.filter((n) => n.refId).map((n) => [n.refId!, n]));
  const free = new Map(nodes.filter((n) => !n.refId).map((n) => [`${n.type}|${labelKey(n.label)}`, n]));
  const plan: LinkPlan = { create: [], update: [] };
  for (const t of things) {
    const linked = byRef.get(t.refId);
    if (linked) {
      if (linked.label !== t.label) plan.update.push({ id: linked.id, changes: { refId: t.refId, label: t.label } });
      continue;
    }
    const key = `${t.type}|${labelKey(t.label)}`;
    const match = free.get(key);
    if (match) {
      free.delete(key);
      plan.update.push({ id: match.id, changes: { refId: t.refId, label: t.label } });
      continue;
    }
    plan.create.push({ type: t.type, label: t.label, refId: t.refId, summaryMd: t.summary, facts: [], firstSeen: date, lastSeen: date, mentions: 0, importance: t.importance });
  }
  return plan;
}

/** The nodes as they will be once the plan is written, for prompts built from a read-only query. */
export function withLinks(nodes: readonly WebNode[], plan: LinkPlan, now: string): WebNode[] {
  const changes = new Map(plan.update.map((u) => [u.id, u.changes]));
  const out = nodes.map((n) => (changes.has(n.id) ? { ...n, ...changes.get(n.id)! } : n));
  plan.create.forEach((c, i) => out.push({ ...c, id: `unsaved-${i}`, createdAt: now, updatedAt: now }));
  return out;
}
