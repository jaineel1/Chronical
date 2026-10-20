import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { decodeBase64, encodeBase64 } from '@/lib/sync/github';
import { db } from './db';
import { SCHEMA_VERSION } from './migrations';
import { profileRepo, resetAll } from './repo';
import { replaceGitHubWithThisDevice, replaceThisDeviceWithGitHub, SYNC_PATH, syncNow } from './sync';
import { getSyncState, setSyncConfig } from './syncState';
import type { BackupFile } from './types';

/** An in-memory GitHub contents API for one repo. */
function fakeGitHub(repo: string) {
  let file: { sha: string; text: string } | null = null;
  let version = 0;
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (url === `https://api.github.com/repos/${repo}`) return new Response('{}', { status: 200 });
    if (url !== `https://api.github.com/repos/${repo}/contents/${SYNC_PATH}`) return new Response('{}', { status: 404 });
    if (!init?.method || init.method === 'GET') {
      if (!file) return new Response('{"message":"Not Found"}', { status: 404 });
      return Response.json({ sha: file.sha, encoding: 'base64', content: encodeBase64(file.text) });
    }
    const body = JSON.parse(String(init.body)) as { content: string; sha?: string };
    if (file && body.sha !== file.sha) return new Response('{"message":"sha does not match"}', { status: 409 });
    file = { sha: `sha${++version}`, text: decodeBase64(body.content) };
    return Response.json({ content: { sha: file.sha } });
  });
  return {
    fetchMock,
    read: (): BackupFile => JSON.parse(file?.text ?? 'null') as BackupFile,
    /** Another device writes the file. */
    write: (f: BackupFile) => {
      file = { sha: `sha${++version}`, text: JSON.stringify(f) };
    },
  };
}

let n = 0;
let gh: ReturnType<typeof fakeGitHub>;

beforeEach(async () => {
  await resetAll();
  localStorage.clear();
  const repo = `me/data-${++n}`;
  setSyncConfig({ repo, token: 'token' });
  gh = fakeGitHub(repo);
  vi.stubGlobal('fetch', gh.fetchMock);
  await profileRepo.ensure('Jai');
  await profileRepo.updateSettings({ apiKey: 'sk-secret' });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

function goal(id: string, updatedAt: string, title = id) {
  return { id, title, pillar: 'BODY', status: 'active', createdAt: updatedAt, updatedAt };
}

const OLD = '2020-01-01T00:00:00.000Z';
const FUTURE = '2999-01-01T00:00:00.000Z';

describe('sync', () => {
  it('puts this device on GitHub without the API key and links it', async () => {
    await db.table('goals').put(goal('g1', OLD));
    await replaceGitHubWithThisDevice();
    const remote = gh.read();
    expect(remote.tables.goals).toHaveLength(1);
    expect(JSON.stringify(remote)).not.toContain('sk-secret');
    expect(getSyncState().linked).toBe(true);
  });

  it('refuses to sync before the device is linked', async () => {
    await expect(syncNow()).rejects.toThrow(/not linked/);
    expect(getSyncState().error).toMatch(/not linked/);
  });

  it('pulls new rows, carries deletes both ways, and keeps the API key', async () => {
    await db.table('goals').bulkPut([goal('keep', OLD), goal('deleteHere', OLD), goal('deleteThere', OLD)]);
    await replaceGitHubWithThisDevice();

    // This device deletes one goal; another device deletes a different one and adds a new one.
    await db.table('goals').delete('deleteHere');
    const remote = gh.read();
    remote.tables.goals = (remote.tables.goals as { id: string }[]).filter((g) => g.id !== 'deleteThere');
    remote.tables.goals.push(goal('fromPhone', OLD));
    gh.write(remote);

    const report = await syncNow();
    const local = (await db.table('goals').toArray()).map((g: { id: string }) => g.id).sort();
    const pushed = (gh.read().tables.goals as { id: string }[]).map((g) => g.id).sort();
    expect(local).toEqual(['fromPhone', 'keep']);
    expect(pushed).toEqual(['fromPhone', 'keep']);
    expect(report).toEqual({ received: 1, removed: 1, pushed: true, photos: { uploaded: 0, downloaded: 0, removed: 0 } });
    expect((await profileRepo.get())?.settings.apiKey).toBe('sk-secret');
    expect(JSON.stringify(gh.read())).not.toContain('sk-secret');
  });

  it('takes the newer edit from GitHub and does not rewrite an unchanged file', async () => {
    await db.table('goals').put(goal('g1', OLD, 'old title'));
    await replaceGitHubWithThisDevice();
    const remote = gh.read();
    remote.tables.goals = [goal('g1', FUTURE, 'new title')];
    gh.write(remote);

    expect((await syncNow()).pushed).toBe(false);
    expect((await db.table('goals').get('g1')).title).toBe('new title');
    expect((await syncNow()).received).toBe(0);
  });

  it('replaces this device with the data on GitHub, keeping the API key', async () => {
    const other: BackupFile = {
      app: 'chronicle',
      version: 1,
      exportedAt: OLD,
      tables: {
        profile: [{ id: 'me', displayName: 'Phone', startedAt: OLD, settings: { demo: false }, createdAt: OLD, updatedAt: OLD }],
        goals: [goal('remoteOnly', OLD)],
      },
    };
    gh.write(other);
    await db.table('goals').put(goal('localOnly', OLD));
    await replaceThisDeviceWithGitHub();
    expect((await db.table('goals').toArray()).map((g: { id: string }) => g.id)).toEqual(['remoteOnly']);
    const profile = await profileRepo.get();
    expect(profile?.displayName).toBe('Phone');
    expect(profile?.settings.apiKey).toBe('sk-secret');
    expect(getSyncState().linked).toBe(true);
  });

  it('refuses to sync with data from a newer app, leaving both sides alone', async () => {
    await db.table('goals').put(goal('g1', OLD));
    await replaceGitHubWithThisDevice();
    const newer = { ...gh.read(), schema: 99 };
    newer.tables.goals = [goal('g1', FUTURE, 'reshaped by a newer app')];
    gh.write(newer);

    await expect(syncNow()).rejects.toThrow(/Update this device first/);
    expect((await db.table('goals').get('g1')).title).toBe('g1');
    expect(gh.read().schema).toBe(99);
    expect(getSyncState().error).toMatch(/newer version of Chronicle/);
  });

  it('writes the schema version into the file on GitHub', async () => {
    await replaceGitHubWithThisDevice();
    expect(gh.read().schema).toBe(SCHEMA_VERSION);
  });

  it('upgrades a file written by an older app and rewrites it in this schema', async () => {
    await replaceGitHubWithThisDevice();
    const old = gh.read();
    gh.write({ ...old, schema: 1 });
    expect((await syncNow()).pushed).toBe(true);
    expect(gh.read().schema).toBe(SCHEMA_VERSION);
  });

  it('retries when another device writes in between, without losing its change', async () => {
    await db.table('goals').put(goal('g1', OLD));
    await replaceGitHubWithThisDevice();
    await db.table('goals').put(goal('mine', OLD));

    // The first PUT loses a race with the phone, which adds its own goal.
    const real = gh.fetchMock.getMockImplementation()!;
    let raced = false;
    gh.fetchMock.mockImplementation(async (url: string, init?: RequestInit) => {
      if (init?.method === 'PUT' && !raced) {
        raced = true;
        const r = gh.read();
        r.tables.goals = [...(r.tables.goals ?? []), goal('phone', OLD)];
        gh.write(r);
      }
      return real(url, init);
    });

    await syncNow();
    const pushed = (gh.read().tables.goals as { id: string }[]).map((g) => g.id).sort();
    expect(pushed).toEqual(['g1', 'mine', 'phone']);
  });
});
