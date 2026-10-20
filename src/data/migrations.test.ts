import { existsSync, readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
import { ChronicleDB } from './db';
import { MIGRATIONS, migrateTables, NewerDataError, SCHEMA_VERSION, schemaVersionOf, type Migration, type Tables } from './migrations';
import { exportBackup, importBackup, profileRepo, resetAll } from './repo';
import type { BackupFile } from './types';

const T = '2026-01-01T00:00:00.000Z';

/** A realistic change: goals get `name` instead of `title`, and a new `habits` table appears. */
const RENAME_TITLE: Migration = {
  version: 2,
  stores: { goals: 'id, pillar, status, name', habits: 'id' },
  upgrade: (t) => ({
    ...t,
    goals: (t.goals ?? []).map(({ title, ...g }) => ('name' in g ? g : { ...g, name: title })),
  }),
};
const ADD_FLAG: Migration = {
  version: 3,
  upgrade: (t) => ({ ...t, goals: (t.goals ?? []).map((g) => ({ ...g, flagged: g.flagged ?? false })) }),
};

describe('the shipped migration list', () => {
  it('numbers versions 2, 3, 4 ... in order with no gaps', () => {
    MIGRATIONS.forEach((m, i) => expect(m.version).toBe(i + 2));
    expect(SCHEMA_VERSION).toBe(MIGRATIONS.length + 1);
  });

  // Each released schema leaves a backup behind in tests/fixtures. When you add a migration, add
  // tests/fixtures/backup-schema-<new version>.json (export a backup from the new build) as well.
  it('has a backup fixture for every schema version, and every one imports into this build', async () => {
    for (let v = 1; v <= SCHEMA_VERSION; v++) {
      const path = `tests/fixtures/backup-schema-${v}.json`;
      expect(existsSync(path), `${path} is missing`).toBe(true);
      const file = JSON.parse(readFileSync(path, 'utf8')) as BackupFile;
      await resetAll();
      await importBackup(file, 'replace');
      const profile = await profileRepo.get();
      expect(profile?.onboardedAt, `${path} did not restore a playable game`).toBeTruthy();
      const out = await exportBackup();
      expect(out.schema).toBe(SCHEMA_VERSION);
      for (const [name, rows] of Object.entries(file.tables)) {
        expect(out.tables[name]?.length ?? 0, `${path}: ${name} lost rows`).toBe(rows.length);
      }
    }
  });
});

describe('migrateTables', () => {
  const v1: Tables = { goals: [{ id: 'g', title: 'Run 10k', updatedAt: T }] };

  it('applies every newer migration in order', () => {
    expect(migrateTables(v1, 1, [RENAME_TITLE, ADD_FLAG]).goals).toEqual([{ id: 'g', name: 'Run 10k', updatedAt: T, flagged: false }]);
  });

  it('skips migrations the data already has', () => {
    const v2: Tables = { goals: [{ id: 'g', name: 'Run 10k', updatedAt: T }] };
    expect(migrateTables(v2, 2, [RENAME_TITLE, ADD_FLAG]).goals).toEqual([{ id: 'g', name: 'Run 10k', updatedAt: T, flagged: false }]);
  });

  it('leaves current data alone', () => {
    expect(migrateTables(v1, 1, [])).toBe(v1);
  });

  it('refuses data from a newer app', () => {
    expect(() => migrateTables(v1, 3, [RENAME_TITLE])).toThrow(NewerDataError);
    expect(() => migrateTables(v1, 3, [RENAME_TITLE])).toThrow(/Update this device first/);
  });

  it('refuses a nonsense version', () => {
    expect(() => migrateTables(v1, 0)).toThrow(/Unknown data version/);
  });

  it('reports the schema version a list produces', () => {
    expect(schemaVersionOf([])).toBe(1);
    expect(schemaVersionOf([RENAME_TITLE, ADD_FLAG])).toBe(3);
  });
});

describe('IndexedDB upgrade', () => {
  it('migrates rows stored by the old app when the updated app opens', async () => {
    const name = `upgrade-${Math.random()}`;
    const old = new ChronicleDB(name, []);
    await old.table('goals').bulkPut([
      { id: 'g1', title: 'Run 10k', pillar: 'BODY', status: 'active', createdAt: T, updatedAt: T },
      { id: 'g2', title: 'Read 12 books', pillar: 'MIND', status: 'active', createdAt: T, updatedAt: T },
    ]);
    await old.table('routines').put({ id: 'r1', title: 'Stretch', createdAt: T, updatedAt: T });
    old.close();

    const updated = new ChronicleDB(name, [RENAME_TITLE, ADD_FLAG]);
    await updated.open();
    expect(updated.verno).toBe(3);
    const goals = await updated.table('goals').orderBy('id').toArray();
    expect(goals.map((g) => [g.name, g.title, g.flagged])).toEqual([
      ['Run 10k', undefined, false],
      ['Read 12 books', undefined, false],
    ]);
    // The new index works and untouched tables keep their rows.
    expect(await updated.table('goals').where('name').equals('Run 10k').count()).toBe(1);
    expect(await updated.table('routines').count()).toBe(1);
    expect(await updated.table('habits').count()).toBe(0);
    updated.close();
  });
});

describe('backups across versions', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('stamps exports with the schema that wrote them', async () => {
    expect((await exportBackup()).schema).toBe(SCHEMA_VERSION);
  });

  it('refuses a backup from a newer app and changes nothing', async () => {
    await profileRepo.ensure('Jai');
    const fromFuture: BackupFile = {
      app: 'chronicle',
      version: 1,
      exportedAt: T,
      schema: SCHEMA_VERSION + 1,
      tables: { profile: [{ id: 'me', displayName: 'Future', createdAt: T, updatedAt: T }] },
    };
    await expect(importBackup(fromFuture, 'replace')).rejects.toThrow(/Update this device first/);
    expect((await profileRepo.get())?.displayName).toBe('Jai');
  });
});
