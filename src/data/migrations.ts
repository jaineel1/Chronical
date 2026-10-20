/**
 * How the stored data changes between versions of the app without losing anything.
 *
 * Every change to the shape of stored data (a new table, a new index, a renamed or reshaped field, a
 * new setting that needs a value) is one entry appended to MIGRATIONS. Never edit or remove an entry
 * that has shipped, and never change `version(1)` in db.ts: devices in the wild have data in those
 * shapes. One entry drives three paths, so old data arrives in the current shape whichever way it comes:
 *
 *   1. the IndexedDB upgrade when an updated app first opens (db.ts),
 *   2. importing an old backup file (repo.ts importBackup),
 *   3. syncing with a file written by a device that has not updated yet (sync.ts).
 *
 * A device never writes data in an older shape over newer data: backups and sync files carry the
 * schema version that wrote them, and an older app refuses a newer file and asks to be updated.
 */

export type Row = Record<string, unknown>;
export type Tables = Record<string, Row[]>;

export interface Migration {
  /** The IndexedDB version this produces: 2 for the first entry, then 3, 4, ... in order. */
  version: number;
  /** Index changes for this version, in Dexie `stores()` syntax: only the tables that change; null drops a table. */
  stores?: Record<string, string | null>;
  /**
   * Turns every table from the previous version's shape into this one. Pure and synchronous: it gets
   * all tables of one device and returns all tables (rows may be changed, added, moved or dropped).
   * Must leave rows it does not change untouched, and must accept data that is already partly migrated.
   */
  upgrade?: (tables: Tables) => Tables;
}

export const MIGRATIONS: readonly Migration[] = [
  // 2: progress photos. `photos` syncs with the game; `photoBlobs` holds the images on this device only.
  { version: 2, stores: { photos: 'id, date', photoBlobs: 'id' } },
  // 3: notes (rant box, midday life feed), the weekly timetable, and the mind web (nodes + edges).
  { version: 3, stores: { notes: 'id, date, kind', timetable: 'id, day', webNodes: 'id, type, label, refId, lastSeen', webEdges: 'id, from, to, [from+to]' } },
  // Append new migrations here. Example:
  // {
  //   version: 4,
  //   stores: { habits: 'id, pillar' },
  //   upgrade: (t) => ({ ...t, profile: (t.profile ?? []).map((p) => ({ ...p, settings: { ...DEFAULT_SETTINGS, ...(p.settings as object) } })) }),
  // },
];

/** The schema version of data this build writes. Version 1 is the original db.ts schema. */
export function schemaVersionOf(migrations: readonly Migration[]): number {
  return migrations.length ? (migrations[migrations.length - 1] as Migration).version : 1;
}

export const SCHEMA_VERSION = schemaVersionOf(MIGRATIONS);

export class NewerDataError extends Error {}

/**
 * Brings tables written at schema `from` up to the current shape. Throws NewerDataError when the data
 * comes from a newer app, because writing it back here would silently drop what this build does not know.
 */
export function migrateTables(tables: Tables, from: number, migrations: readonly Migration[] = MIGRATIONS): Tables {
  const current = schemaVersionOf(migrations);
  if (!Number.isInteger(from) || from < 1) throw new Error(`Unknown data version ${String(from)}. Nothing was changed.`);
  if (from > current) {
    throw new NewerDataError(`This data was saved by a newer version of Chronicle (data version ${from}, this app reads up to ${current}). Update this device first.`);
  }
  let out = tables;
  for (const m of migrations) {
    if (m.version > from && m.upgrade) out = m.upgrade(out);
  }
  return out;
}
