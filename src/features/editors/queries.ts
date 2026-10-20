/** Read-only live queries for the editors. Writes go through `./lib/repos`. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Achievement, Assessment, Book, Contact, Goal, Lesson, Lore, LoreItemType, Milestone, Person, Routine, Skill, VisionItem } from '@/data/types';

const byCreated = <T extends { createdAt: string; id: string }>(a: T, b: T) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

export function useWorldCounts() {
  return useLiveQuery(async () => {
    const [routines, goals, skills, people, books, days] = await Promise.all([
      db.routines.toArray(),
      db.goals.toArray(),
      db.skills.count(),
      db.people.count(),
      db.books.toArray(),
      db.dayLogs.count(),
    ]);
    return {
      days,
      routinesActive: routines.filter((r) => !r.archived).length,
      routinesArchived: routines.filter((r) => r.archived).length,
      goalsActive: goals.filter((g) => g.status === 'active').length,
      goals: goals.length,
      skills,
      people,
      booksReading: books.filter((b) => b.status === 'reading').length,
      books: books.length,
    };
  }, []);
}

/* ---------- routines ---------- */

export function useRoutinesAll(): Routine[] | undefined {
  return useLiveQuery(async () => (await db.routines.toArray()).sort((a, b) => a.sortOrder - b.sortOrder || byCreated(a, b)), []);
}

/** undefined while loading, null when missing (or when no id: a new routine). */
export function useRoutine(id: string | undefined): Routine | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.routines.get(id)) ?? null) : null), [id]);
}

/* ---------- goals ---------- */

export interface GoalWithMilestones {
  goal: Goal;
  milestones: Milestone[];
}

export function useGoalsWithMilestones(): GoalWithMilestones[] | undefined {
  return useLiveQuery(async () => {
    const [goals, milestones] = await Promise.all([db.goals.toArray(), db.milestones.toArray()]);
    return goals.sort(byCreated).map((goal) => ({ goal, milestones: milestones.filter((m) => m.goalId === goal.id).sort(byCreated) }));
  }, []);
}

export function useGoals(): Goal[] | undefined {
  return useLiveQuery(async () => (await db.goals.toArray()).sort(byCreated), []);
}

export interface GoalBundle {
  goal: Goal;
  milestones: Milestone[];
  vision: VisionItem[];
}

export function useGoalBundle(id: string | undefined): GoalBundle | null | undefined {
  return useLiveQuery(async () => {
    if (!id) return null;
    const goal = await db.goals.get(id);
    if (!goal) return null;
    const [milestones, vision] = await Promise.all([db.milestones.where('goalId').equals(id).toArray(), db.visionItems.where('goalId').equals(id).toArray()]);
    return { goal, milestones: milestones.sort(byCreated), vision: vision.sort(byCreated) };
  }, [id]);
}

export function useVisionItems(): VisionItem[] | undefined {
  return useLiveQuery(async () => (await db.visionItems.toArray()).sort(byCreated), []);
}

export function useVisionItem(id: string | undefined): VisionItem | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.visionItems.get(id)) ?? null) : null), [id]);
}

/* ---------- skills ---------- */

export function useSkillsAll(): Skill[] | undefined {
  return useLiveQuery(() => db.skills.orderBy('sortOrder').toArray(), []);
}

export function useSkill(id: string | undefined): Skill | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.skills.get(id)) ?? null) : null), [id]);
}

export function useAchievements(skillId: string | undefined): Achievement[] | undefined {
  return useLiveQuery(
    async () => (skillId ? (await db.achievements.where('skillId').equals(skillId).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) : []),
    [skillId],
  );
}

export function useAssessments(skillId: string | undefined): Assessment[] | undefined {
  return useLiveQuery(
    async () => (skillId ? (await db.assessments.where('skillId').equals(skillId).toArray()).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) : []),
    [skillId],
  );
}

/* ---------- people ---------- */

export function usePeopleAll(): Person[] | undefined {
  return useLiveQuery(async () => (await db.people.toArray()).sort(byCreated), []);
}

export function usePerson(id: string | undefined): Person | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.people.get(id)) ?? null) : null), [id]);
}

export function useContacts(personId: string | undefined): Contact[] | undefined {
  return useLiveQuery(
    async () => (personId ? (await db.contacts.where('personId').equals(personId).toArray()).sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt)) : []),
    [personId],
  );
}

/* ---------- books ---------- */

export interface BookWithLessons {
  book: Book;
  lessons: Lesson[];
}

export function useBooksAll(): BookWithLessons[] | undefined {
  return useLiveQuery(async () => {
    const [books, lessons] = await Promise.all([db.books.toArray(), db.lessons.toArray()]);
    return books.sort(byCreated).map((book) => ({ book, lessons: lessons.filter((l) => l.bookId === book.id) }));
  }, []);
}

export function useBook(id: string | undefined): Book | null | undefined {
  return useLiveQuery(async () => (id ? ((await db.books.get(id)) ?? null) : null), [id]);
}

export function useLessons(bookId: string | undefined): Lesson[] | undefined {
  return useLiveQuery(async () => (bookId ? (await db.lessons.where('bookId').equals(bookId).toArray()).sort(byCreated) : []), [bookId]);
}

/* ---------- lore ---------- */

export function useLore(itemType: LoreItemType, itemId: string | undefined): Lore[] | undefined {
  return useLiveQuery(async () => (itemId ? (await db.lore.where('[itemType+itemId]').equals([itemType, itemId]).toArray()).sort(byCreated) : []), [itemType, itemId]);
}
