/**
 * The mind web's only writer: nodes and edges from the nightly ## WEB, people met in the journal
 * from ## PEOPLE, and nodes for the player's own goals, routines, books, skills and people. Never
 * deletes: the player does that at /web. Every write is one transaction over every table it touches,
 * and each call returns a report for the paste message. Re-pasting the same reply changes nothing.
 */
import { db } from './db';
import { stamp } from './repo';
import { CIRCLES, type Circle, type Contact, type Person, type WebEdge, type WebNode, type WebNodeType } from './types';
import { DEFAULT_ROLLOVER_HOUR, nowIso, todayKey } from '@/lib/dates';
import { ownThings, planLinks } from '@/lib/web/link';
import { labelKey, type PersonUpdate, type WebUpdates } from '@/lib/web/types';

/** Defaults for a person first met in the journal. */
export const NEW_PERSON = { circle: 'other' as Circle, closeness: 2, wantCloser: false, contactEveryDays: 14 };
/** Importance of a node Claude adds; the player's own things start higher (lib/web/link.ts). */
export const NEW_NODE_IMPORTANCE = 2;
export const MAX_EDGE_WEIGHT = 5;

export interface WebReport {
  /** Labels of nodes created from node or summary lines. */
  added: string[];
  /** Labels of existing nodes named in node or summary lines. */
  updated: string[];
  /** Link ends that matched no node, created as topics. */
  createdTopics: string[];
  /** "A -> B" for each link line applied. */
  links: string[];
  /** Summary labels that matched no node, skipped. */
  unmatched: string[];
}

export interface PeopleReport {
  /** Names of Person rows created. */
  added: string[];
  /** Names of existing people seen again. */
  updated: string[];
}

export interface LinkReport {
  created: number;
  updated: number;
}

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

const CIRCLE_ALIASES: Record<string, Circle> = {
  friend: 'close',
  'close friend': 'close',
  'close friends': 'close',
  'best friend': 'close',
  classmate: 'college',
  classmates: 'college',
  university: 'college',
  uni: 'college',
  school: 'college',
  girlfriend: 'partner',
  boyfriend: 'partner',
  wife: 'partner',
  husband: 'partner',
  clients: 'client',
};

/** Claude's circle word as one of the app's circles; anything else (acquaintance, work, friends) is 'other'. */
export function circleFrom(text: string | undefined): Circle {
  const t = (text ?? '').trim().toLowerCase();
  if ((CIRCLES as readonly string[]).includes(t)) return t as Circle;
  return CIRCLE_ALIASES[t] ?? NEW_PERSON.circle;
}

function cleanLabel(label: string): string {
  return label.trim().replace(/\s+/g, ' ');
}

/**
 * Appends a dated fact unless the same text is already there for that date. The first fact of a
 * date is that night's one mention, so a re-paste never counts twice. True when added.
 */
function addFact(node: WebNode, date: string, text: string): boolean {
  const fact = text.trim();
  if (!fact) return false;
  if (node.facts.some((f) => f.date === date && f.text.trim().toLowerCase() === fact.toLowerCase())) return false;
  if (!node.facts.some((f) => f.date === date)) node.mentions += 1;
  node.facts = [...node.facts, { date, text: fact }].sort((a, b) => a.date.localeCompare(b.date));
  return true;
}

/** Widens firstSeen/lastSeen to include `date`. True when either moved. */
function seenOn(node: WebNode, date: string): boolean {
  let moved = false;
  if (date > node.lastSeen) {
    node.lastSeen = date;
    moved = true;
  }
  if (date < node.firstSeen) {
    node.firstSeen = date;
    moved = true;
  }
  return moved;
}

function freshNode(type: WebNodeType, label: string, date: string, extra: Partial<WebNode> = {}): WebNode {
  return stamp<WebNode>({ type, label: cleanLabel(label), summaryMd: '', facts: [], firstSeen: date, lastSeen: date, mentions: 0, importance: NEW_NODE_IMPORTANCE, ...extra });
}

/** Nodes loaded once per call, found by (type, label) or by label alone; changed ones are written at the end. */
class NodeIndex {
  private byKey = new Map<string, WebNode>();
  private byLabel = new Map<string, WebNode[]>();
  private byRef = new Map<string, WebNode>();
  private dirty = new Set<WebNode>();

  constructor(nodes: WebNode[]) {
    for (const n of nodes) this.add(n);
  }

  add(n: WebNode): void {
    const key = `${n.type}|${labelKey(n.label)}`;
    if (!this.byKey.has(key)) this.byKey.set(key, n);
    this.byLabel.set(labelKey(n.label), [...(this.byLabel.get(labelKey(n.label)) ?? []), n]);
    if (n.refId) this.byRef.set(n.refId, n);
  }

  get(type: WebNodeType, label: string): WebNode | undefined {
    return this.byKey.get(`${type}|${labelKey(label)}`);
  }

  ref(refId: string): WebNode | undefined {
    return this.byRef.get(refId);
  }

  /** Any node with this label; the most mentioned when several types share it. */
  find(label: string): WebNode | undefined {
    const list = this.byLabel.get(labelKey(label)) ?? [];
    return [...list].sort((a, b) => b.mentions - a.mentions || b.lastSeen.localeCompare(a.lastSeen))[0];
  }

  touch(n: WebNode): void {
    this.dirty.add(n);
  }

  async flush(): Promise<void> {
    const now = nowIso();
    if (this.dirty.size) await db.webNodes.bulkPut([...this.dirty].map((n) => ({ ...n, updatedAt: now })));
  }
}

/* ------------------------------------------------------------------ */
/* Repository                                                          */
/* ------------------------------------------------------------------ */

export const webRepo = {
  /**
   * ## WEB for one night. Nodes upsert by (type, label) and gain their fact (an identical fact on the
   * same date is kept once), the night's mention and lastSeen. A person node adopts the Person row of
   * the same name. Summaries rewrite the matching node's summaryMd (matched by label). Links upsert by
   * (from, to); an end that matches no node becomes a topic node. Each new night on a link adds 1 to
   * its weight, up to 5.
   */
  async applyWeb(date: string, updates: WebUpdates): Promise<WebReport> {
    const report: WebReport = { added: [], updated: [], createdTopics: [], links: [], unmatched: [] };
    if (!updates.nodes.length && !updates.links.length && !updates.summaries.length) return report;
    return db.transaction('rw', db.webNodes, db.webEdges, db.people, async () => {
      const index = new NodeIndex(await db.webNodes.toArray());
      const people = new Map((await db.people.toArray()).map((p) => [labelKey(p.name), p]));
      const created = new Set<WebNode>();
      const named = (n: WebNode) => {
        const list = created.has(n) ? report.added : report.updated;
        if (!list.includes(n.label)) list.push(n.label);
      };

      for (const u of updates.nodes) {
        const label = cleanLabel(u.label);
        if (!label) continue;
        let node = index.get(u.type, label);
        if (!node) {
          const person = u.type === 'person' ? people.get(labelKey(label)) : undefined;
          const adopt = person && !index.ref(person.id);
          node = freshNode(u.type, person?.name ?? label, date, adopt ? { refId: person.id } : {});
          index.add(node);
          index.touch(node);
          created.add(node);
        }
        named(node);
        const learned = addFact(node, date, u.fact);
        if (seenOn(node, date) || learned) index.touch(node);
      }

      for (const s of updates.summaries) {
        const node = index.find(s.label);
        if (!node) {
          report.unmatched.push(cleanLabel(s.label));
          continue;
        }
        named(node);
        const summary = s.summary.trim();
        if (!summary || node.summaryMd === summary) continue;
        node.summaryMd = summary;
        seenOn(node, date);
        index.touch(node);
      }

      const edges = await db.webEdges.toArray();
      const byPair = new Map(edges.map((e) => [`${e.from}|${e.to}`, e]));
      const resolve = (label: string): WebNode | undefined => {
        const clean = cleanLabel(label);
        if (!clean) return undefined;
        const found = index.find(clean);
        if (found) return found;
        const topic = freshNode('topic', clean, date);
        index.add(topic);
        index.touch(topic);
        created.add(topic);
        report.createdTopics.push(topic.label);
        return topic;
      };
      const now = nowIso();
      const edgeWrites = new Map<string, WebEdge>();
      for (const l of updates.links) {
        const from = resolve(l.from);
        const to = resolve(l.to);
        if (!from || !to || from === to) continue;
        report.links.push(`${from.label} -> ${to.label}`);
        for (const n of [from, to]) if (seenOn(n, date)) index.touch(n);
        const relation = l.relation.trim() || 'related to';
        const note = l.note?.trim() || undefined;
        const pair = `${from.id}|${to.id}`;
        const existing = byPair.get(pair);
        if (!existing) {
          const edge = stamp<WebEdge>({ from: from.id, to: to.id, relation, note, weight: 1, firstSeen: date, lastSeen: date });
          byPair.set(pair, edge);
          edgeWrites.set(pair, edge);
          continue;
        }
        const newNight = date > existing.lastSeen;
        const next: WebEdge = {
          ...existing,
          relation,
          note: note ?? existing.note,
          weight: newNight ? Math.min(MAX_EDGE_WEIGHT, existing.weight + 1) : existing.weight,
          lastSeen: newNight ? date : existing.lastSeen,
          firstSeen: date < existing.firstSeen ? date : existing.firstSeen,
        };
        if (JSON.stringify(next) === JSON.stringify(existing)) continue;
        next.updatedAt = now;
        byPair.set(pair, next);
        edgeWrites.set(pair, next);
      }

      await index.flush();
      if (edgeWrites.size) await db.webEdges.bulkPut([...edgeWrites.values()]);
      return report;
    });
  },

  /**
   * ## PEOPLE for one night. Each person is found by name (case-insensitive) or created (circle from
   * the reply when it is one of the app's, else 'other'; closeness 2; every 14 days), gets
   * lastContact = date and one Contact for the day (kind 'other', the line as its note), and is
   * mirrored as a person node with refId whose fact for the day is that line.
   */
  async applyPeople(date: string, people: PersonUpdate[]): Promise<PeopleReport> {
    const report: PeopleReport = { added: [], updated: [] };
    if (!people.length) return report;
    return db.transaction('rw', db.people, db.contacts, db.webNodes, async () => {
      const rows = new Map((await db.people.toArray()).map((p) => [labelKey(p.name), p]));
      const index = new NodeIndex(await db.webNodes.toArray());
      const now = nowIso();
      const seen = new Set<string>();

      for (const u of people) {
        const name = cleanLabel(u.name);
        const key = labelKey(name);
        if (!name || seen.has(key)) continue;
        seen.add(key);
        const note = u.note.trim();

        let person = rows.get(key);
        if (!person) {
          person = stamp<Person>({ name, ...NEW_PERSON, circle: circleFrom(u.circle), lastContact: date });
          await db.people.put(person);
          report.added.push(name);
        } else {
          report.updated.push(person.name);
          if (!person.lastContact || person.lastContact.slice(0, 10) < date) {
            person = { ...person, lastContact: date, updatedAt: now };
            await db.people.put(person);
          }
        }
        rows.set(key, person);

        const personId = person.id;
        const sameDay = await db.contacts
          .where('personId')
          .equals(personId)
          .filter((c) => c.date === date && (c.note ?? '') === note)
          .first();
        if (!sameDay) await db.contacts.put(stamp<Contact>({ personId, date, kind: 'other', note: note || undefined }));

        let node = index.ref(personId) ?? index.get('person', person.name);
        if (!node) {
          node = freshNode('person', person.name, date, { refId: personId });
          index.add(node);
          index.touch(node);
        } else if (!node.refId) {
          node.refId = personId;
          index.touch(node);
        }
        const learned = addFact(node, date, note);
        if (seenOn(node, date) || learned) index.touch(node);
      }

      await index.flush();
      return report;
    });
  },

  /**
   * Make sure every active goal, active routine, book being read, skill and person has a node with
   * its refId (created, or an existing node of the same type and label adopted), and that renamed
   * rows rename their node. Call before building a prompt that should know the player's own things.
   * `date` defaults to today (with the player's rollover).
   */
  async linkExisting(date?: string): Promise<LinkReport> {
    return db.transaction('rw', [db.webNodes, db.goals, db.routines, db.books, db.skills, db.people, db.profile], async () => {
      const day = date ?? todayKey((await db.profile.get('me'))?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR);
      const [nodes, goals, routines, books, skills, people] = await Promise.all([
        db.webNodes.toArray(),
        db.goals.toArray(),
        db.routines.toArray(),
        db.books.toArray(),
        db.skills.toArray(),
        db.people.toArray(),
      ]);
      const plan = planLinks(nodes, ownThings({ goals, routines, books, skills, people }), day);
      const now = nowIso();
      const byId = new Map(nodes.map((n) => [n.id, n]));
      const writes: WebNode[] = plan.create.map((c) => stamp<WebNode>(c));
      for (const u of plan.update) {
        const n = byId.get(u.id);
        if (n) writes.push({ ...n, ...u.changes, updatedAt: now });
      }
      if (writes.length) await db.webNodes.bulkPut(writes);
      return { created: plan.create.length, updated: plan.update.length };
    });
  },
};
