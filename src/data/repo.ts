import type { EntityTable, Table } from 'dexie';
import { db, TABLE_NAMES, type TableName } from './db';
import { newId } from './ids';
import { nowIso } from '@/lib/dates';
import {
  DEFAULT_SETTINGS,
  PILLARS,
  SUBSTATS,
  type Base,
  type BackupFile,
  type DayLog,
  type Pillar,
  type PillarState,
  type Profile,
  type Prompt,
  type PromptKind,
  type Routine,
  type RoutineLog,
  type Settings,
  type SubStatState,
} from './types';
import type { Food, Meal, MealSlot, StarredAffirmation } from './types';

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

type Draft<T extends Base> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'id'>>;

/** Fill id and timestamps for a new row. */
export function stamp<T extends Base>(draft: Draft<T>): T {
  const now = nowIso();
  return { ...(draft as object), id: draft.id ?? newId(), createdAt: now, updatedAt: now } as T;
}

/**
 * Apply a partial update and bump updatedAt. Returns the stored row or undefined if missing.
 * The read and the write share one transaction, so two patches of the same row never lose a change.
 */
export async function patch<T extends Base>(table: EntityTable<T, 'id'>, id: string, changes: Partial<T>): Promise<T | undefined> {
  // Dexie's generic key types do not narrow through a generic T; the casts are local to this helper.
  const anyTable = table as unknown as Table & { get(id: string): Promise<T | undefined>; put(row: T): Promise<unknown> };
  return db.transaction('rw', anyTable, async () => {
    const row = await anyTable.get(id);
    if (!row) return undefined;
    const next = { ...row, ...changes, updatedAt: nowIso() } as T;
    await anyTable.put(next);
    return next;
  });
}

/* ------------------------------------------------------------------ */
/* Profile                                                             */
/* ------------------------------------------------------------------ */

export const profileRepo = {
  async get(): Promise<Profile | undefined> {
    return db.profile.get('me');
  },
  /** Creates the single profile row on first run. Idempotent. */
  async ensure(displayName = ''): Promise<Profile> {
    return db.transaction('rw', PROFILE_TABLES(), async () => {
      const existing = await db.profile.get('me');
      if (existing) return existing;
      const now = nowIso();
      const profile: Profile = {
        id: 'me',
        displayName,
        startedAt: now,
        settings: { ...DEFAULT_SETTINGS },
        createdAt: now,
        updatedAt: now,
      };
      await db.profile.put(profile);
      await ensureGameState();
      return profile;
    });
  },
  // Read and write in one transaction: a settings toggle and a debounced name save landing together
  // must both stick.
  async update(changes: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
    return db.transaction('rw', PROFILE_TABLES(), async () => {
      const current = await profileRepo.ensure();
      const next: Profile = { ...current, ...changes, id: 'me', updatedAt: nowIso() };
      await db.profile.put(next);
      return next;
    });
  },
  async updateSettings(changes: Partial<Settings>): Promise<Profile> {
    return db.transaction('rw', PROFILE_TABLES(), async () => {
      const current = await profileRepo.ensure();
      return profileRepo.update({ settings: { ...current.settings, ...changes } });
    });
  },
  /** Settings computed from the stored ones inside the same transaction, for nested objects like `models`. */
  async updateSettingsWith(change: (current: Settings) => Partial<Settings>): Promise<Profile> {
    return db.transaction('rw', PROFILE_TABLES(), async () => {
      const current = await profileRepo.ensure();
      return profileRepo.update({ settings: { ...current.settings, ...change(current.settings) } });
    });
  },
};

/** Creating the profile also creates the pillars, so every profile write covers those tables. */
const PROFILE_TABLES = () => [db.profile, db.pillarState, db.subStatState];

/** Make sure the five pillars and twenty sub-stats exist. Idempotent. */
export async function ensureGameState(): Promise<void> {
  await db.transaction('rw', db.pillarState, db.subStatState, async () => {
    for (const pillar of PILLARS) {
      const existing = await db.pillarState.where('pillar').equals(pillar).first();
      if (!existing) await db.pillarState.put(stamp<PillarState>({ pillar, points: 0 }));
      for (const name of SUBSTATS[pillar]) {
        const sub = await db.subStatState.where('[pillar+name]').equals([pillar, name]).first();
        if (!sub) await db.subStatState.put(stamp<SubStatState>({ pillar, name, points: 0 }));
      }
    }
  });
}

/* ------------------------------------------------------------------ */
/* Routines and logs                                                   */
/* ------------------------------------------------------------------ */

export const routineRepo = {
  listActive(): Promise<Routine[]> {
    return db.routines.filter((r) => !r.archived).sortBy('sortOrder');
  },
  async create(draft: Draft<Routine>): Promise<Routine> {
    const row = stamp<Routine>(draft);
    await db.routines.put(row);
    return row;
  },
  update(id: string, changes: Partial<Routine>) {
    return patch(db.routines, id, changes);
  },
  /** Routines scheduled for a given weekday (0-6). */
  async forWeekday(weekday: number): Promise<Routine[]> {
    const all = await routineRepo.listActive();
    return all.filter((r) => r.days.length === 0 || r.days.includes(weekday));
  },
};

export const routineLogRepo = {
  forDate(date: string): Promise<RoutineLog[]> {
    return db.routineLogs.where('date').equals(date).toArray();
  },
  async get(routineId: string, date: string): Promise<RoutineLog | undefined> {
    return db.routineLogs.where('[routineId+date]').equals([routineId, date]).first();
  },
  /** Upsert the done flag for one routine on one day. One transaction, so a double tap writes one row. */
  async set(routineId: string, date: string, done: boolean, extra: Partial<RoutineLog> = {}): Promise<RoutineLog> {
    return db.transaction('rw', db.routineLogs, async () => {
      const existing = await routineLogRepo.get(routineId, date);
      if (existing) {
        const next = { ...existing, ...extra, done, updatedAt: nowIso() };
        await db.routineLogs.put(next);
        return next;
      }
      const row = stamp<RoutineLog>({ routineId, date, done, shielded: false, ...extra });
      await db.routineLogs.put(row);
      return row;
    });
  },
  async recent(routineId: string, limit = 60): Promise<RoutineLog[]> {
    return db.routineLogs.where('routineId').equals(routineId).reverse().sortBy('date').then((rows) => rows.slice(0, limit));
  },
};

/* ------------------------------------------------------------------ */
/* Day logs                                                            */
/* ------------------------------------------------------------------ */

export function emptyDayLog(date: string): DayLog {
  return stamp<DayLog>({
    date,
    urgesResisted: 0,
    scrollSessions: 0,
    affirmations: [],
    quests: [],
    stats: [],
    warnings: [],
    insights: [],
  });
}

export const dayLogRepo = {
  get(date: string): Promise<DayLog | undefined> {
    return db.dayLogs.where('date').equals(date).first();
  },
  // `date` is unique: two first touches of a day at once must not both insert, and two field saves
  // must not overwrite each other, so the read and the write share one transaction.
  async ensure(date: string): Promise<DayLog> {
    return db.transaction('rw', db.dayLogs, async () => {
      const existing = await dayLogRepo.get(date);
      if (existing) return existing;
      const row = emptyDayLog(date);
      await db.dayLogs.put(row);
      return row;
    });
  },
  async update(date: string, changes: Partial<DayLog>): Promise<DayLog> {
    return db.transaction('rw', db.dayLogs, async () => {
      const current = await dayLogRepo.ensure(date);
      const next: DayLog = { ...current, ...changes, updatedAt: nowIso() };
      await db.dayLogs.put(next);
      return next;
    });
  },
  /** Most recent `n` logs, newest first. */
  async recent(n: number, beforeOrOn?: string): Promise<DayLog[]> {
    let coll = db.dayLogs.orderBy('date').reverse();
    if (beforeOrOn) coll = coll.filter((d) => d.date <= beforeOrOn);
    return coll.limit(n).toArray();
  },
  /** The latest log that has a brief, i.e. the last night Claude replied to. */
  async latestWithBrief(): Promise<DayLog | undefined> {
    return db.dayLogs.orderBy('date').reverse().filter((d) => !!d.briefMd).first();
  },
};

/* ------------------------------------------------------------------ */
/* Prompts                                                             */
/* ------------------------------------------------------------------ */

/** Rough token estimate: ~4 characters per token for English prose and markdown. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}

export const promptRepo = {
  async create(kind: PromptKind, model: string, promptMd: string, subject?: string): Promise<Prompt> {
    const row = stamp<Prompt>({ kind, model, promptMd, tokensEst: estimateTokens(promptMd), sentAt: nowIso(), subject });
    await db.prompts.put(row);
    return row;
  },
  async attachReply(id: string, replyMd: string, parsedOk: boolean): Promise<Prompt | undefined> {
    return patch(db.prompts, id, { replyMd, parsedOk, repliedAt: nowIso() });
  },
  recent(limit = 50): Promise<Prompt[]> {
    return db.prompts.orderBy('sentAt').reverse().limit(limit).toArray();
  },
  /** Training pairs: every prompt with a reply that parsed. */
  async dataset(): Promise<Prompt[]> {
    return db.prompts.filter((p) => !!p.replyMd && p.parsedOk === true).toArray();
  },
};

/* ------------------------------------------------------------------ */
/* Pillar helpers                                                      */
/* ------------------------------------------------------------------ */

export const gameRepo = {
  async pillars(): Promise<Record<Pillar, PillarState>> {
    await ensureGameState();
    const rows = await db.pillarState.toArray();
    return Object.fromEntries(rows.map((r) => [r.pillar, r])) as Record<Pillar, PillarState>;
  },
  async subStats(pillar?: Pillar): Promise<SubStatState[]> {
    await ensureGameState();
    return pillar ? db.subStatState.where('pillar').equals(pillar).toArray() : db.subStatState.toArray();
  },
  /**
   * Apply a point delta. A pillar is the mean of its four sub-stats, so:
   *  - with a subStat: that sub-stat moves by `delta`, the pillar by delta / 4;
   *  - without: all four sub-stats move by `delta`, so the pillar moves by `delta`.
   * Points never go below zero. The pillar row is recomputed, never written directly.
   */
  async addPoints(pillar: Pillar, subStat: string | undefined, delta: number): Promise<void> {
    await ensureGameState();
    await db.transaction('rw', db.pillarState, db.subStatState, async () => {
      const subs = await db.subStatState.where('pillar').equals(pillar).toArray();
      const targets = subStat ? subs.filter((s) => s.name.toLowerCase() === subStat.toLowerCase()) : subs;
      if (targets.length === 0) return;
      const now = nowIso();
      for (const s of targets) {
        s.points = Math.max(0, s.points + delta);
        s.updatedAt = now;
        await db.subStatState.put(s);
      }
      await recomputePillar(pillar);
    });
  },
  /** Overwrite one sub-stat's points (used by seeds and imports), then recompute the pillar. */
  async setSubStatPoints(pillar: Pillar, subStat: string, points: number): Promise<void> {
    await ensureGameState();
    await db.transaction('rw', db.pillarState, db.subStatState, async () => {
      const s = await db.subStatState.where('[pillar+name]').equals([pillar, subStat]).first();
      if (!s) return;
      await db.subStatState.put({ ...s, points: Math.max(0, points), updatedAt: nowIso() });
      await recomputePillar(pillar);
    });
  },
};

/** pillar.points = mean of its sub-stats. Must run inside a transaction that covers both tables. */
export async function recomputePillar(pillar: Pillar): Promise<void> {
  const subs = await db.subStatState.where('pillar').equals(pillar).toArray();
  const p = await db.pillarState.where('pillar').equals(pillar).first();
  if (!p) return;
  const mean = subs.length ? subs.reduce((a, s) => a + s.points, 0) / subs.length : 0;
  await db.pillarState.put({ ...p, points: mean, updatedAt: nowIso() });
}

/* ------------------------------------------------------------------ */
/* Backup, restore, reset                                              */
/* ------------------------------------------------------------------ */

export async function exportBackup(): Promise<BackupFile> {
  const tables: Record<string, unknown[]> = {};
  for (const name of TABLE_NAMES) {
    tables[name] = await db.table(name).toArray();
  }
  return { app: 'chronicle', version: 1, exportedAt: nowIso(), tables };
}

/**
 * Refuse a backup that would not restore cleanly, before anything is cleared: a table that is not a
 * list (it would be wiped and left empty), a row without an id, two day logs for one date, or, when
 * replacing, no profile (it would leave an empty game).
 */
function checkBackup(file: BackupFile, mode: 'replace' | 'merge'): void {
  if (!file || file.app !== 'chronicle' || file.version !== 1) throw new Error('Not a Chronicle backup file');
  if (!file.tables || typeof file.tables !== 'object') throw new Error('This backup has no tables. Nothing was changed.');
  for (const name of TABLE_NAMES) {
    const rows = file.tables[name];
    if (rows === undefined) continue;
    if (!Array.isArray(rows)) throw new Error(`This backup is damaged: ${name} is not a list of rows. Nothing was changed.`);
    for (const row of rows) {
      const id = (row as { id?: unknown } | null)?.id;
      if (typeof id !== 'string' || !id) throw new Error(`This backup is damaged: a row in ${name} has no id. Nothing was changed.`);
    }
  }
  const dates = new Set<unknown>();
  for (const log of (file.tables.dayLogs ?? []) as { date?: unknown }[]) {
    if (dates.has(log.date)) throw new Error(`This backup has two day logs for ${String(log.date)}. Nothing was changed.`);
    dates.add(log.date);
  }
  if (mode === 'replace' && !(file.tables.profile ?? []).some((p) => (p as { id?: unknown }).id === 'me')) {
    throw new Error('This backup has no profile, so it would leave an empty game. Nothing was changed.');
  }
}

export async function importBackup(file: BackupFile, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
  checkBackup(file, mode);
  await db.transaction('rw', TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) {
      const rows = file.tables[name] ?? [];
      if (mode === 'replace') await db.table(name).clear();
      if (rows.length) await db.table(name).bulkPut(rows);
    }
  });
}

export async function resetAll(): Promise<void> {
  await db.transaction('rw', TABLE_NAMES.map((n) => db.table(n)), async () => {
    for (const name of TABLE_NAMES) await db.table(name).clear();
  });
}

export function tableNames(): readonly TableName[] {
  return TABLE_NAMES;
}

/* ------------------------------------------------------------------ */
/* Foods, meals, kept affirmations (added for the night loop)          */
/* ------------------------------------------------------------------ */

export const foodRepo = {
  list(): Promise<Food[]> {
    return db.foods.orderBy('name').toArray();
  },
  /** The food with this name (case-insensitive), created if it is new. */
  async ensure(name: string): Promise<Food> {
    const clean = name.trim().replace(/\s+/g, ' ');
    const wanted = clean.toLowerCase();
    const existing = await db.foods.filter((f) => f.name.trim().toLowerCase() === wanted).first();
    if (existing) return existing;
    const row = stamp<Food>({ name: clean, tags: [] });
    await db.foods.put(row);
    return row;
  },
};

export const MEAL_SLOTS: readonly MealSlot[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const mealRepo = {
  /** Meals for a day, in the order they were logged. */
  async forDate(date: string): Promise<Meal[]> {
    return db.meals.where('date').equals(date).sortBy('createdAt');
  },
  async add(date: string, foodId: string, slot: MealSlot, feltAfter?: number): Promise<Meal> {
    const row = stamp<Meal>({ date, foodId, slot, feltAfter });
    await db.meals.put(row);
    return row;
  },
  async remove(id: string): Promise<void> {
    await db.meals.delete(id);
  },
};

export const affirmationRepo = {
  list(): Promise<StarredAffirmation[]> {
    return db.affirmations.orderBy('date').reverse().toArray();
  },
  /** Keep an affirmation. Keeping the same line from the same day twice stores it once. */
  async keep(text: string, date: string): Promise<StarredAffirmation> {
    const existing = await db.affirmations.where('date').equals(date).filter((a) => a.text === text).first();
    if (existing) return existing;
    const row = stamp<StarredAffirmation>({ text, date });
    await db.affirmations.put(row);
    return row;
  },
};
