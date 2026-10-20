/**
 * Write paths for the world: routines' order and archive, goals with milestones and vision items,
 * skills with achievements, people with contacts, books with lessons, and lore.
 *
 * These complement `src/data/repo.ts` (which owns profile, routines' create/update, day logs,
 * prompts and pillars). Screens write through here; read-only screen queries live in each
 * feature's `queries.ts`.
 */
import { db } from '@/data/db';
import { patch, routineRepo, stamp } from '@/data/repo';
import type { Achievement, Base, Book, Contact, Goal, Lesson, Lore, LoreItemType, Meal, Milestone, Person, Skill, VisionItem } from '@/data/types';
import { nowIso } from '@/lib/dates';
import { contactDayKey } from './people';
import { levelAfterHours } from './skills';

export type New<T extends Base> = Omit<T, 'id' | 'createdAt' | 'updatedAt'>;

let lastOrderedStamp = 0;

/**
 * `stamp` for sibling rows that have no order field (milestones, vision items): each one gets a
 * later millisecond than the one before, so sorting by createdAt keeps the order they were added.
 * Waits at most a millisecond per row.
 */
function stampInOrder<T extends Base>(draft: New<T>): T {
  while (Date.now() <= lastOrderedStamp) {
    /* spin until the clock ticks */
  }
  const row = stamp<T>(draft);
  // Remember the stamp actually written: the clock can tick between the wait above and stamp().
  lastOrderedStamp = Date.parse(row.createdAt);
  return row;
}

/* ------------------------------------------------------------------ */
/* Routines: order and archive (create/update live in src/data/repo)   */
/* ------------------------------------------------------------------ */

export const routineOrderRepo = {
  async nextSortOrder(): Promise<number> {
    const all = await db.routines.toArray();
    return all.reduce((max, r) => Math.max(max, r.sortOrder), -1) + 1;
  },
  async archive(id: string): Promise<void> {
    await routineRepo.update(id, { archived: true });
  },
  async restore(id: string): Promise<void> {
    await routineRepo.update(id, { archived: false, sortOrder: await routineOrderRepo.nextSortOrder() });
  },
  /** Move an active routine one place up (-1) or down (+1); renumbers the active list 0..n-1. */
  async move(id: string, dir: -1 | 1): Promise<void> {
    await db.transaction('rw', db.routines, async () => {
      const active = (await db.routines.filter((r) => !r.archived).toArray()).sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
      const i = active.findIndex((r) => r.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= active.length) return;
      [active[i], active[j]] = [active[j]!, active[i]!];
      const now = nowIso();
      for (const [k, r] of active.entries()) {
        if (r.sortOrder !== k) await db.routines.put({ ...r, sortOrder: k, updatedAt: now });
      }
    });
  },
};

/* ------------------------------------------------------------------ */
/* Goals, milestones, vision                                           */
/* ------------------------------------------------------------------ */

export type MilestoneDraft = New<Omit<Milestone, 'goalId'>> & { id?: string };
export type VisionDraft = New<Omit<VisionItem, 'goalId'>> & { id?: string };

export const goalRepo = {
  /**
   * Create or update a goal together with its milestones and the vision items linked to it.
   * Milestones and linked vision items that are missing from the drafts are deleted.
   */
  async save(goal: New<Goal> & { id?: string }, milestones: MilestoneDraft[], vision: VisionDraft[]): Promise<Goal> {
    return db.transaction('rw', db.goals, db.milestones, db.visionItems, async () => {
      const { id, ...fields } = goal;
      const now = nowIso();
      const existing = id ? await db.goals.get(id) : undefined;
      const row: Goal = existing ? { ...existing, ...fields, id: existing.id, updatedAt: now } : stamp<Goal>(fields);
      await db.goals.put(row);
      const goalId = row.id;

      const oldMs = await db.milestones.where('goalId').equals(goalId).toArray();
      const keepMs = new Set(milestones.map((m) => m.id).filter((x): x is string => !!x));
      for (const m of oldMs) if (!keepMs.has(m.id)) await db.milestones.delete(m.id);
      const msById = new Map(oldMs.map((m) => [m.id, m]));
      for (const { id: mid, ...rest } of milestones) {
        const cur = mid ? msById.get(mid) : undefined;
        await db.milestones.put(cur ? { ...cur, ...rest, goalId, updatedAt: now } : stampInOrder<Milestone>({ ...rest, goalId }));
      }

      const oldVision = await db.visionItems.where('goalId').equals(goalId).toArray();
      const keepVision = new Set(vision.map((v) => v.id).filter((x): x is string => !!x));
      for (const v of oldVision) if (!keepVision.has(v.id)) await db.visionItems.delete(v.id);
      const visionById = new Map(oldVision.map((v) => [v.id, v]));
      for (const { id: vid, ...rest } of vision) {
        const cur = vid ? visionById.get(vid) : undefined;
        await db.visionItems.put(cur ? { ...cur, ...rest, goalId, updatedAt: now } : stampInOrder<VisionItem>({ ...rest, goalId }));
      }
      return row;
    });
  },
  update(id: string, changes: Partial<Goal>) {
    return patch(db.goals, id, changes);
  },
  /** Delete a goal and its milestones. Vision items and routines that pointed at it are kept, unlinked. */
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.goals, db.milestones, db.visionItems, db.routines, db.lore], async () => {
      await db.goals.delete(id);
      await db.milestones.where('goalId').equals(id).delete();
      const now = nowIso();
      for (const v of await db.visionItems.where('goalId').equals(id).toArray()) await db.visionItems.put({ ...v, goalId: undefined, updatedAt: now });
      for (const r of await db.routines.filter((r) => r.goalId === id).toArray()) await db.routines.put({ ...r, goalId: undefined, updatedAt: now });
      await db.lore.where('[itemType+itemId]').equals(['goal', id]).delete();
    });
  },
};

export const visionRepo = {
  async create(draft: New<VisionItem>): Promise<VisionItem> {
    const row = stamp<VisionItem>(draft);
    await db.visionItems.put(row);
    return row;
  },
  update(id: string, changes: Partial<VisionItem>) {
    return patch(db.visionItems, id, changes);
  },
  async remove(id: string): Promise<void> {
    await db.visionItems.delete(id);
  },
};

/* ------------------------------------------------------------------ */
/* Skills                                                              */
/* ------------------------------------------------------------------ */

export const skillRepo = {
  async nextSortOrder(): Promise<number> {
    const all = await db.skills.toArray();
    return all.reduce((max, s) => Math.max(max, s.sortOrder), -1) + 1;
  },
  async create(draft: New<Skill>): Promise<Skill> {
    const row = stamp<Skill>(draft);
    await db.skills.put(row);
    return row;
  },
  update(id: string, changes: Partial<Skill>) {
    return patch(db.skills, id, changes);
  },
  /** Hours go up; the level gets +0.1 per hour until Claude ranks the skill again. */
  async logHours(id: string, hours: number): Promise<Skill | undefined> {
    return db.transaction('rw', db.skills, async () => {
      const s = await db.skills.get(id);
      if (!s || !(hours > 0)) return s;
      const next: Skill = { ...s, hours: Math.round((s.hours + hours) * 100) / 100, level: levelAfterHours(s.level, hours), updatedAt: nowIso() };
      await db.skills.put(next);
      return next;
    });
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.skills, db.achievements, db.assessments, db.lore], async () => {
      await db.skills.delete(id);
      await db.achievements.where('skillId').equals(id).delete();
      await db.assessments.where('skillId').equals(id).delete();
      await db.lore.where('[itemType+itemId]').equals(['skill', id]).delete();
    });
  },
};

export const achievementRepo = {
  async create(draft: New<Achievement>): Promise<Achievement> {
    const row = stamp<Achievement>(draft);
    await db.achievements.put(row);
    return row;
  },
  async remove(id: string): Promise<void> {
    await db.achievements.delete(id);
  },
};

/* ------------------------------------------------------------------ */
/* People                                                              */
/* ------------------------------------------------------------------ */

export const personRepo = {
  async create(draft: New<Person>): Promise<Person> {
    const row = stamp<Person>(draft);
    await db.people.put(row);
    return row;
  },
  update(id: string, changes: Partial<Person>) {
    return patch(db.people, id, changes);
  },
  /** Add a contact and move `lastContact` forward to its date. */
  async logContact(personId: string, kind: Contact['kind'], date: string, note?: string): Promise<Contact> {
    return db.transaction('rw', db.people, db.contacts, async () => {
      const contact = stamp<Contact>({ personId, date, kind, note: note?.trim() || undefined });
      await db.contacts.put(contact);
      const p = await db.people.get(personId);
      if (p) {
        const last = contactDayKey(p.lastContact);
        if (!last || last < date) await db.people.put({ ...p, lastContact: date, updatedAt: nowIso() });
      }
      return contact;
    });
  },
  /** Remove one contact; `lastContact` falls back to the newest one left. */
  async removeContact(contactId: string): Promise<void> {
    await db.transaction('rw', db.people, db.contacts, async () => {
      const c = await db.contacts.get(contactId);
      if (!c) return;
      await db.contacts.delete(contactId);
      const left = await db.contacts.where('personId').equals(c.personId).toArray();
      const newest = left.reduce<string | undefined>((max, x) => (!max || x.date > max ? x.date : max), undefined);
      const p = await db.people.get(c.personId);
      if (p) await db.people.put({ ...p, lastContact: newest, updatedAt: nowIso() });
    });
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.people, db.contacts, db.lore], async () => {
      await db.people.delete(id);
      await db.contacts.where('personId').equals(id).delete();
      await db.lore.where('[itemType+itemId]').equals(['person', id]).delete();
    });
  },
};

/* ------------------------------------------------------------------ */
/* Books and lessons                                                   */
/* ------------------------------------------------------------------ */

export const bookRepo = {
  async create(draft: New<Book>): Promise<Book> {
    const row = stamp<Book>(draft);
    await db.books.put(row);
    return row;
  },
  update(id: string, changes: Partial<Book>) {
    return patch(db.books, id, changes);
  },
  async remove(id: string): Promise<void> {
    await db.transaction('rw', [db.books, db.lessons, db.lore], async () => {
      await db.books.delete(id);
      await db.lessons.where('bookId').equals(id).delete();
      await db.lore.where('[itemType+itemId]').equals(['book', id]).delete();
    });
  },
};

export const lessonRepo = {
  async create(bookId: string, text: string): Promise<Lesson> {
    const row = stamp<Lesson>({ bookId, text: text.trim(), appliedCount: 0 });
    await db.lessons.put(row);
    return row;
  },
  update(id: string, changes: Partial<Lesson>) {
    return patch(db.lessons, id, changes);
  },
  async remove(id: string): Promise<void> {
    await db.lessons.delete(id);
  },
};

/* ------------------------------------------------------------------ */
/* Lore                                                                */
/* ------------------------------------------------------------------ */

export const loreRepo = {
  async create(draft: New<Lore>): Promise<Lore> {
    const row = stamp<Lore>(draft);
    await db.lore.put(row);
    return row;
  },
  forItem(itemType: LoreItemType, itemId: string): Promise<Lore[]> {
    return db.lore.where('[itemType+itemId]').equals([itemType, itemId]).sortBy('createdAt');
  },
};

/** Changes to a logged meal that `mealRepo` has no method for (its slot, or which saved meal it is). */
export const mealEditRepo = {
  async update(id: string, changes: Pick<Partial<Meal>, 'slot' | 'foodId'>): Promise<void> {
    const row = await patch(db.meals, id, changes);
    if (!row) throw new Error(`No meal ${id}`);
  },
};
