import { Capacitor } from '@capacitor/core';
import { nowIso } from '@/lib/dates';
import { getFile, GitHubConflict, putFile, type GitHubRepo } from '@/lib/sync/github';
import { baseFrom, mergeTables, type SyncRow, type SyncTables } from '@/lib/sync/merge';
import { db, TABLE_NAMES } from './db';
import { SCHEMA_VERSION } from './migrations';
import { backupTables, exportBackup, importBackup, profileRepo } from './repo';
import { getSyncBase, getSyncState, recordSyncResult, setSyncBase, setSyncRunning } from './syncState';
import type { BackupFile } from './types';

/**
 * Sync through one JSON file in the player's private GitHub repo. The file is a regular Chronicle
 * backup, so it also restores through Vault → Data. Each device keeps its own copy in IndexedDB and
 * merges with the file row by row (see lib/sync/merge.ts). The API key never leaves the device.
 */
export const SYNC_PATH = 'chronicle.json';

export interface SyncReport {
  /** Rows written on this device from GitHub. */
  received: number;
  /** Rows removed on this device because another device deleted them. */
  removed: number;
  /** Whether the file on GitHub was updated. */
  pushed: boolean;
}

export interface RemoteSummary {
  exists: boolean;
  exportedAt?: string;
  rows: number;
}

function requireConfig(): GitHubRepo {
  const config = getSyncState().config;
  if (!config) throw new Error('Add the repo and token first.');
  return config;
}

function parseRemote(text: string): BackupFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error(`${SYNC_PATH} on GitHub is not valid JSON. Nothing was changed.`);
  }
  const file = parsed as Partial<BackupFile> | null;
  if (!file || file.app !== 'chronicle' || file.version !== 1 || typeof file.tables !== 'object' || file.tables === null) {
    throw new Error(`${SYNC_PATH} on GitHub is not Chronicle data. Nothing was changed.`);
  }
  return file as BackupFile;
}

/** Every row needs a string id and updatedAt to be merged; refuse anything else before writing. */
function asTables(file: BackupFile, where: string): SyncTables {
  const out: SyncTables = {};
  for (const [name, rows] of Object.entries(file.tables)) {
    if (!Array.isArray(rows)) throw new Error(`The data on ${where} is damaged: ${name} is not a list. Nothing was changed.`);
    for (const row of rows) {
      const r = row as Partial<SyncRow> | null;
      if (typeof r?.id !== 'string' || typeof r.updatedAt !== 'string') {
        throw new Error(`The data on ${where} is damaged: a row in ${name} has no id or updatedAt. Nothing was changed.`);
      }
    }
    out[name] = rows as SyncRow[];
  }
  return out;
}

/**
 * GitHub's tables in this build's shape. Data from an older app is migrated; data from a newer app is
 * refused (NewerDataError) so this device never writes old-shaped rows over it.
 */
function remoteTablesOf(file: BackupFile): SyncTables {
  asTables(file, 'GitHub');
  return asTables({ ...file, tables: backupTables(file) }, 'GitHub');
}

type ProfileRow = SyncRow & { settings?: Record<string, unknown> };

function mapProfile(tables: SyncTables, fn: (p: ProfileRow) => ProfileRow): SyncTables {
  const profiles = tables.profile;
  return profiles ? { ...tables, profile: (profiles as ProfileRow[]).map(fn) } : tables;
}

function withoutSecrets(tables: SyncTables): SyncTables {
  return mapProfile(tables, (p) => {
    if (!p.settings || !('apiKey' in p.settings)) return p;
    const { apiKey: _drop, ...settings } = p.settings;
    return { ...p, settings };
  });
}

function withApiKey(tables: SyncTables, apiKey: unknown): SyncTables {
  if (typeof apiKey !== 'string' || !apiKey) return tables;
  return mapProfile(tables, (p) => (p.settings ? { ...p, settings: { ...p.settings, apiKey } } : p));
}

function localApiKey(tables: SyncTables): unknown {
  return (tables.profile as ProfileRow[] | undefined)?.find((p) => p.id === 'me')?.settings?.apiKey;
}

function serialize(tables: SyncTables): string {
  const file: BackupFile = { app: 'chronicle', version: 1, exportedAt: nowIso(), schema: SCHEMA_VERSION, tables };
  return `${JSON.stringify(file, null, 2)}\n`;
}

function canonical(tables: SyncTables): string {
  const names = Object.keys(tables).sort();
  return JSON.stringify(names.map((n) => [n, [...(tables[n] ?? [])].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))]));
}

function byId(rows: SyncRow[] | undefined): Map<string, SyncRow> {
  return new Map((rows ?? []).map((r) => [r.id, r]));
}

function commitMessage(): string {
  return `Chronicle sync from ${Capacitor.isNativePlatform() ? 'iPhone' : 'laptop'}`;
}

/**
 * Writes the merge into IndexedDB, re-checking each row inside the transaction so an edit made while
 * GitHub was being read is never overwritten: a row is replaced only by a newer version, and removed
 * only if it is still exactly the version the merge saw.
 */
async function applyLocally(snapshot: SyncTables, merged: SyncTables): Promise<{ received: number; removed: number }> {
  let received = 0;
  let removed = 0;
  await db.transaction('rw', TABLE_NAMES.map((n) => db.table(n)), async () => {
    const puts: { name: string; rows: SyncRow[] }[] = [];
    for (const name of TABLE_NAMES) {
      const table = db.table<SyncRow, string>(name);
      const snap = byId(snapshot[name]);
      const want = byId(merged[name]);
      const current = byId(await table.toArray());
      const gone = [...snap.keys()].filter((id) => !want.has(id) && current.get(id)?.updatedAt === snap.get(id)?.updatedAt);
      // Deletes first, across every table, so a day log replaced by another device's log for the
      // same date frees its unique date before the new one lands.
      if (gone.length) await table.bulkDelete(gone);
      removed += gone.length;
      const rows = [...want.values()].filter((row) => {
        const cur = current.get(row.id);
        return cur ? row.updatedAt > cur.updatedAt : !snap.has(row.id);
      });
      puts.push({ name, rows });
    }
    for (const { name, rows } of puts) {
      if (rows.length) await db.table<SyncRow, string>(name).bulkPut(rows);
      received += rows.length;
    }
  });
  return { received, removed };
}

async function syncOnce(): Promise<SyncReport> {
  const config = requireConfig();
  const base = getSyncBase();
  if (!base) throw new Error('This device is not linked yet. Choose which data to keep on the Sync page.');
  for (let attempt = 0; attempt < 3; attempt++) {
    const at = nowIso();
    const local = asTables(await exportBackup(), 'this device');
    const remote = await getFile(config, SYNC_PATH);
    if (!remote) throw new Error(`${SYNC_PATH} is missing from ${config.repo}. Put this device's data on GitHub to start it again.`);
    const remoteFile = parseRemote(remote.text);
    const remoteTables = remoteTablesOf(remoteFile);
    const merged = withoutSecrets(mergeTables(local, remoteTables, base));
    const applied = await applyLocally(local, withApiKey(merged, localApiKey(local)));
    let pushed = false;
    // An older file is rewritten even when nothing changed, so it carries this build's schema.
    if ((remoteFile.schema ?? 1) < SCHEMA_VERSION || canonical(merged) !== canonical(remoteTables)) {
      try {
        await putFile(config, SYNC_PATH, serialize(merged), remote.sha, commitMessage());
        pushed = true;
      } catch (e) {
        if (e instanceof GitHubConflict) continue;
        throw e;
      }
    }
    setSyncBase(baseFrom(merged, at));
    return { ...applied, pushed };
  }
  throw new Error('The data on GitHub kept changing while syncing. Try again in a minute.');
}

let inFlight: Promise<unknown> | null = null;

/** One sync operation at a time; the result or error is recorded for the Sync page and the shell. */
function exclusive<T>(job: () => Promise<T>): Promise<T> {
  if (inFlight) return Promise.reject(new Error('A sync is already running.'));
  const run = (async () => {
    setSyncRunning(true);
    try {
      const out = await job();
      recordSyncResult({ lastSyncAt: nowIso() });
      return out;
    } catch (e) {
      recordSyncResult({ error: e instanceof Error ? e.message : String(e) });
      throw e;
    } finally {
      setSyncRunning(false);
      inFlight = null;
    }
  })();
  inFlight = run;
  return run;
}

export function syncNow(): Promise<SyncReport> {
  return exclusive(syncOnce);
}

/** What is on GitHub right now, so the player can choose which side to keep when linking. */
export async function inspectRemote(): Promise<RemoteSummary> {
  const remote = await getFile(requireConfig(), SYNC_PATH);
  if (!remote) return { exists: false, rows: 0 };
  const file = parseRemote(remote.text);
  const rows = Object.values(remoteTablesOf(file)).reduce((n, t) => n + t.length, 0);
  return { exists: true, exportedAt: file.exportedAt, rows };
}

/** Linking: replace everything on this device with the data on GitHub. The API key stays. */
export function replaceThisDeviceWithGitHub(): Promise<void> {
  return exclusive(async () => {
    const remote = await getFile(requireConfig(), SYNC_PATH);
    if (!remote) throw new Error('GitHub has no Chronicle data yet. Put this device’s data there instead.');
    const file = parseRemote(remote.text);
    const tables = remoteTablesOf(file);
    const keptKey = (await profileRepo.get())?.settings.apiKey;
    const at = nowIso();
    await importBackup(file, 'replace');
    if (keptKey) await profileRepo.updateSettings({ apiKey: keptKey });
    setSyncBase(baseFrom(tables, at));
  });
}

/** Linking: replace the data on GitHub with everything on this device. Git history keeps the old file. */
export function replaceGitHubWithThisDevice(): Promise<void> {
  return exclusive(async () => {
    const config = requireConfig();
    const at = nowIso();
    const local = withoutSecrets(asTables(await exportBackup(), 'this device'));
    if (!(local.profile ?? []).some((p) => p.id === 'me')) throw new Error('This device has no game yet, so there is nothing to put on GitHub.');
    const remote = await getFile(config, SYNC_PATH);
    await putFile(config, SYNC_PATH, serialize(local), remote?.sha, commitMessage());
    setSyncBase(baseFrom(local, at));
  });
}
