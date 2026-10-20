/**
 * Three-way merge of this device's tables with the copy on GitHub, row by row.
 *
 * The base is what this device and GitHub agreed on right after the last sync: the ids of every row
 * and the moment the device's snapshot was taken. With it, a row missing on one side is either new on
 * the other side (not in the base: keep it) or deleted on this side (in the base: drop it), so deletes
 * travel between devices without tombstones. An edit made after the last sync beats a delete.
 */

export interface SyncRow {
  id: string;
  updatedAt: string;
  [key: string]: unknown;
}

export type SyncTables = Record<string, SyncRow[]>;

export interface SyncBase {
  /** ISO time the local snapshot of the last successful sync was taken. */
  at: string;
  /** Ids per table present right after that sync. */
  ids: Record<string, string[]>;
}

export function baseFrom(tables: SyncTables, at: string): SyncBase {
  const ids: Record<string, string[]> = {};
  for (const [name, rows] of Object.entries(tables)) ids[name] = rows.map((r) => r.id);
  return { at, ids };
}

function byId(rows: SyncRow[] | undefined): Map<string, SyncRow> {
  return new Map((rows ?? []).map((r) => [r.id, r]));
}

function mergeTable(local: SyncRow[] | undefined, remote: SyncRow[] | undefined, baseIds: Set<string>, baseAt: string): SyncRow[] {
  const l = byId(local);
  const r = byId(remote);
  const out: SyncRow[] = [];
  for (const id of new Set([...l.keys(), ...r.keys()])) {
    const lr = l.get(id);
    const rr = r.get(id);
    if (lr && rr) {
      // A tie means the same version: take GitHub's copy so an unchanged file is not written again.
      out.push(rr.updatedAt >= lr.updatedAt ? rr : lr);
    } else {
      const only = (lr ?? rr) as SyncRow;
      // In the base and gone from the other side: deleted there, unless edited here since.
      if (!baseIds.has(id) || only.updatedAt > baseAt) out.push(only);
    }
  }
  return out;
}

/** Day logs are unique by date. Two devices can each start one for the same night: keep one. */
function oneLogPerDate(rows: SyncRow[]): SyncRow[] {
  const best = new Map<string, SyncRow>();
  for (const row of rows) {
    const date = String(row.date);
    const prev = best.get(date);
    if (!prev || betterLog(row, prev)) best.set(date, row);
  }
  return [...best.values()];
}

/** A closed night beats an open one; otherwise the later edit wins. */
function betterLog(a: SyncRow, b: SyncRow): boolean {
  const ac = !!a.closedAt;
  const bc = !!b.closedAt;
  if (ac !== bc) return ac;
  return a.updatedAt > b.updatedAt;
}

export function mergeTables(local: SyncTables, remote: SyncTables, base: SyncBase): SyncTables {
  const out: SyncTables = {};
  for (const name of new Set([...Object.keys(local), ...Object.keys(remote)])) {
    const merged = mergeTable(local[name], remote[name], new Set(base.ids[name] ?? []), base.at);
    out[name] = name === 'dayLogs' ? oneLogPerDate(merged) : merged;
  }
  return out;
}
