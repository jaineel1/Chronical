import { describe, expect, it } from 'vitest';
import { baseFrom, mergeTables, type SyncRow, type SyncTables } from './merge';

const T0 = '2026-10-01T10:00:00.000Z';
const BASE_AT = '2026-10-02T10:00:00.000Z';
const T3 = '2026-10-03T10:00:00.000Z';
const T4 = '2026-10-04T10:00:00.000Z';

function row(id: string, updatedAt: string, extra: Record<string, unknown> = {}): SyncRow {
  return { id, createdAt: T0, updatedAt, ...extra };
}

function ids(tables: SyncTables, name: string): string[] {
  return (tables[name] ?? []).map((r) => r.id).sort();
}

const EMPTY_BASE = { at: BASE_AT, ids: {} };

describe('mergeTables', () => {
  it('keeps rows that are new on either side', () => {
    const out = mergeTables({ goals: [row('a', T3)] }, { goals: [row('b', T3)] }, EMPTY_BASE);
    expect(ids(out, 'goals')).toEqual(['a', 'b']);
  });

  it('keeps the later edit when both sides have the row', () => {
    const out = mergeTables({ goals: [row('a', T3, { title: 'local' })] }, { goals: [row('a', T4, { title: 'remote' })] }, EMPTY_BASE);
    expect(out.goals?.[0]?.title).toBe('remote');
    const back = mergeTables({ goals: [row('a', T4, { title: 'local' })] }, { goals: [row('a', T3, { title: 'remote' })] }, EMPTY_BASE);
    expect(back.goals?.[0]?.title).toBe('local');
  });

  it('carries a delete made on this device to GitHub', () => {
    const base = { at: BASE_AT, ids: { goals: ['a', 'b'] } };
    const out = mergeTables({ goals: [row('b', T0)] }, { goals: [row('a', T0), row('b', T0)] }, base);
    expect(ids(out, 'goals')).toEqual(['b']);
  });

  it('carries a delete made on another device to this one', () => {
    const base = { at: BASE_AT, ids: { goals: ['a', 'b'] } };
    const out = mergeTables({ goals: [row('a', T0), row('b', T0)] }, { goals: [row('a', T0)] }, base);
    expect(ids(out, 'goals')).toEqual(['a']);
  });

  it('lets an edit made after the last sync beat a delete from the other side', () => {
    const base = { at: BASE_AT, ids: { goals: ['a'] } };
    expect(ids(mergeTables({ goals: [row('a', T3)] }, { goals: [] }, base), 'goals')).toEqual(['a']);
    expect(ids(mergeTables({ goals: [] }, { goals: [row('a', T3)] }, base), 'goals')).toEqual(['a']);
  });

  it('keeps tables only one side knows about', () => {
    const out = mergeTables({}, { lore: [row('x', T0)] }, EMPTY_BASE);
    expect(ids(out, 'lore')).toEqual(['x']);
  });

  it('keeps one day log per date, preferring a closed night', () => {
    const open = row('l1', T4, { date: '2026-10-03' });
    const closed = row('l2', T3, { date: '2026-10-03', closedAt: T3 });
    const out = mergeTables({ dayLogs: [open] }, { dayLogs: [closed] }, EMPTY_BASE);
    expect(ids(out, 'dayLogs')).toEqual(['l2']);
  });

  it('keeps the later day log when neither night is closed', () => {
    const a = row('l1', T3, { date: '2026-10-03' });
    const b = row('l2', T4, { date: '2026-10-03' });
    expect(ids(mergeTables({ dayLogs: [a] }, { dayLogs: [b] }, EMPTY_BASE), 'dayLogs')).toEqual(['l2']);
  });
});

describe('baseFrom', () => {
  it('records every id per table and the snapshot time', () => {
    expect(baseFrom({ goals: [row('a', T0), row('b', T0)], lore: [] }, BASE_AT)).toEqual({ at: BASE_AT, ids: { goals: ['a', 'b'], lore: [] } });
  });
});
