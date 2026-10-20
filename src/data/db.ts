import Dexie, { type EntityTable, type Transaction } from 'dexie';
import { MIGRATIONS, type Migration, type Row, type Tables } from './migrations';
import type {
  Achievement,
  Assessment,
  Book,
  Contact,
  DayLog,
  Digest,
  Food,
  Goal,
  Lesson,
  Lore,
  Meal,
  Milestone,
  Note,
  Person,
  Photo,
  PhotoBlob,
  TimetableEntry,
  WebEdge,
  WebNode,
  PillarState,
  Profile,
  Prompt,
  Routine,
  RoutineLog,
  Skill,
  StarredAffirmation,
  SubStatState,
  VisionItem,
} from './types';

/**
 * Local-first store. Everything the player has ever logged lives here, forever.
 * Sync (phase 2) mirrors these tables; it never owns them.
 */
export class ChronicleDB extends Dexie {
  profile!: EntityTable<Profile, 'id'>;
  pillarState!: EntityTable<PillarState, 'id'>;
  subStatState!: EntityTable<SubStatState, 'id'>;
  routines!: EntityTable<Routine, 'id'>;
  routineLogs!: EntityTable<RoutineLog, 'id'>;
  goals!: EntityTable<Goal, 'id'>;
  milestones!: EntityTable<Milestone, 'id'>;
  visionItems!: EntityTable<VisionItem, 'id'>;
  dayLogs!: EntityTable<DayLog, 'id'>;
  affirmations!: EntityTable<StarredAffirmation, 'id'>;
  foods!: EntityTable<Food, 'id'>;
  meals!: EntityTable<Meal, 'id'>;
  skills!: EntityTable<Skill, 'id'>;
  achievements!: EntityTable<Achievement, 'id'>;
  assessments!: EntityTable<Assessment, 'id'>;
  people!: EntityTable<Person, 'id'>;
  contacts!: EntityTable<Contact, 'id'>;
  books!: EntityTable<Book, 'id'>;
  lessons!: EntityTable<Lesson, 'id'>;
  lore!: EntityTable<Lore, 'id'>;
  prompts!: EntityTable<Prompt, 'id'>;
  digests!: EntityTable<Digest, 'id'>;
  photos!: EntityTable<Photo, 'id'>;
  notes!: EntityTable<Note, 'id'>;
  timetable!: EntityTable<TimetableEntry, 'id'>;
  webNodes!: EntityTable<WebNode, 'id'>;
  webEdges!: EntityTable<WebEdge, 'id'>;
  /** Images for `photos`, on this device only: not in TABLE_NAMES, so never in backups or the JSON sync. */
  photoBlobs!: EntityTable<PhotoBlob, 'id'>;

  constructor(name = 'chronicle', migrations: readonly Migration[] = MIGRATIONS) {
    super(name);
    // Shipped schema: never edit. Changes go in migrations.ts as a new version.
    this.version(1).stores({
      profile: 'id',
      pillarState: 'id, pillar',
      subStatState: 'id, pillar, [pillar+name]',
      routines: 'id, pillar, archived, sortOrder',
      routineLogs: 'id, routineId, date, [routineId+date]',
      goals: 'id, pillar, status',
      milestones: 'id, goalId',
      visionItems: 'id, goalId',
      dayLogs: 'id, &date',
      affirmations: 'id, date',
      foods: 'id, name',
      meals: 'id, date, foodId',
      skills: 'id, pillar, sortOrder',
      achievements: 'id, skillId, date',
      assessments: 'id, skillId, createdAt',
      people: 'id, circle, lastContact',
      contacts: 'id, personId, date',
      books: 'id, status',
      lessons: 'id, bookId',
      lore: 'id, [itemType+itemId]',
      prompts: 'id, kind, sentAt, subject',
      digests: 'id, kind, periodStart',
    });
    for (const m of migrations) {
      const version = this.version(m.version).stores(m.stores ?? {});
      const upgrade = m.upgrade;
      if (upgrade) version.upgrade((tx) => upgradeAllTables(tx, upgrade));
    }
  }
}

/** Runs one migration's pure upgrade over every table inside Dexie's upgrade transaction. */
async function upgradeAllTables(tx: Transaction, upgrade: (tables: Tables) => Tables): Promise<void> {
  const names = tx.storeNames;
  const before: Tables = {};
  for (const name of names) before[name] = await tx.table<Row, string>(name).toArray();
  const after = upgrade(before);
  for (const name of names) {
    const rows = after[name] ?? [];
    if (JSON.stringify(rows) === JSON.stringify(before[name])) continue;
    await tx.table(name).clear();
    if (rows.length) await tx.table(name).bulkAdd(rows);
  }
}

export const db = new ChronicleDB();

/** Every table name, in a stable order. Used by backup, reset and tests. */
export const TABLE_NAMES = [
  'profile',
  'pillarState',
  'subStatState',
  'routines',
  'routineLogs',
  'goals',
  'milestones',
  'visionItems',
  'dayLogs',
  'affirmations',
  'foods',
  'meals',
  'skills',
  'achievements',
  'assessments',
  'people',
  'contacts',
  'books',
  'lessons',
  'lore',
  'prompts',
  'digests',
  'photos',
  'notes',
  'timetable',
  'webNodes',
  'webEdges',
] as const;

export type TableName = (typeof TABLE_NAMES)[number];
