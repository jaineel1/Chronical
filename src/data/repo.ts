import type { EntityTable } from 'dexie';
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

/* ------------------------------------------------------------------ */
/* Generic helpers                                                     */
/* ------------------------------------------------------------------ */

type Draft<T extends Base> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & Partial<Pick<T, 'id'>>;

/** Fill id and timestamps for a new row. */
export function stamp<T extends Base>(draft: Draft<T>): T {
  const now = nowIso();
  return { ...(draft as object), id: draft.id ?? newId(), createdAt: now, updatedAt: now } as T;
}

/** Apply a partial update and bump updatedAt. Returns the stored row or undefined if missing. */
export async function patch<T extends Base>(table: EntityTable<T, 'id'>, id: string, changes: Partial<T>): Promise<T | undefined> {
  // Dexie's generic key types do not narrow through a generic T; the casts are local to this helper.
  const anyTable = table as unknown as { get(id: string): Promise<T | undefined>; put(row: T): Promise<unknown> };
  const row = await anyTable.get(id);
  if (!row) return undefined;
  const next = { ...row, ...changes, updatedAt: nowIso() } as T;
  await anyTable.put(next);
  return next;
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
  },
  async update(changes: Partial<Omit<Profile, 'id'>>): Promise<Profile> {
    const current = await profileRepo.ensure();
    const next: Profile = { ...current, ...changes, id: 'me', updatedAt: nowIso() };
    await db.profile.put(next);
    return next;
  },
  async updateSettings(changes: Partial<Settings>): Promise<Profile> {
    const current = await profileRepo.ensure();
    return profileRepo.update({ settings: { ...current.settings, ...changes } });
  },
};

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
  /** Upsert the done flag for one routine on one day. */
  async set(routineId: string, date: string, done: boolean, extra: Partial<RoutineLog> = {}): Promise<RoutineLog> {
    const existing = await routineLogRepo.get(routineId, date);
    if (existing) {
      const next = { ...existing, ...extra, done, updatedAt: nowIso() };
      await db.routineLogs.put(next);
      return next;
    }
    const row = stamp<RoutineLog>({ routineId, date, done, shielded: false, ...extra });
    await db.routineLogs.put(row);
    return row;
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
  async ensure(date: string): Promise<DayLog> {
    const existing = await dayLogRepo.get(date);
    if (existing) return existing;
    const row = emptyDayLog(date);
    await db.dayLogs.put(row);
    return row;
  },
  async update(date: string, changes: Partial<DayLog>): Promise<DayLog> {
    const current = await dayLogRepo.ensure(date);
    const next: DayLog = { ...current, ...changes, updatedAt: nowIso() };
    await db.dayLogs.put(next);
    return next;
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

export async function importBackup(file: BackupFile, mode: 'replace' | 'merge' = 'replace'): Promise<void> {
  if (file.app !== 'chronicle' || file.version !== 1) throw new Error('Not a Chronicle backup file');
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
