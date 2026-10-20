import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64 } from '@/lib/sync/github';
import { db } from './db';
import { photoRepo, resetAll, stamp } from './repo';
import { syncPhotos } from './photoSync';
import type { Photo } from './types';

const REPO = 'me/data';
const BASE = `https://api.github.com/repos/${REPO}/contents/`;
const config = { repo: REPO, token: 't' };

/** An in-memory photos/ folder behind the GitHub contents API. */
function fakeFolder(initial: Record<string, Uint8Array<ArrayBuffer>> = {}) {
  const files = new Map(Object.entries(initial).map(([p, b], i) => [p, { sha: `s${i}`, bytes: b }]));
  let n = 100;
  const calls: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = decodeURIComponent(url.slice(BASE.length));
    const method = init?.method ?? 'GET';
    calls.push(`${method} ${path}`);
    if (path === 'photos' && method === 'GET') {
      if (!files.size) return new Response('{}', { status: 404 });
      return Response.json([...files].map(([p, f]) => ({ type: 'file', name: p.split('/').pop(), path: p, sha: f.sha })));
    }
    if (method === 'GET') {
      const f = files.get(path);
      return f ? new Response(f.bytes) : new Response('{}', { status: 404 });
    }
    if (method === 'PUT') {
      const body = JSON.parse(String(init!.body)) as { content: string };
      const bytes = Uint8Array.from(atob(body.content), (c) => c.charCodeAt(0));
      files.set(path, { sha: `s${++n}`, bytes });
      return Response.json({ content: { sha: `s${n}` } });
    }
    if (method === 'DELETE') {
      files.delete(path);
      return Response.json({});
    }
    return new Response('{}', { status: 400 });
  });
  return { fetchMock, files, calls };
}

function bytes(...b: number[]): Uint8Array<ArrayBuffer> {
  return new Uint8Array(b);
}

beforeEach(async () => {
  await resetAll();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('syncPhotos', () => {
  it('uploads new photos, downloads missing ones and removes orphaned files', async () => {
    // Taken here, not on GitHub yet.
    const mine = await photoRepo.add({ date: '2026-10-20', angle: 'front', blob: new Blob([bytes(1, 2, 3)], { type: 'image/jpeg' }), width: 3, height: 4, weightKg: 72.4 });
    // Taken on the phone: the row arrived with the JSON sync, the image is only on GitHub.
    const theirs = await db.photos.put(stamp<Photo>({ date: '2026-10-06', angle: 'side', width: 3, height: 4, path: 'photos/2026-10-06-side-p.jpg' }));
    const gh = fakeFolder({ 'photos/2026-10-06-side-p.jpg': bytes(9, 9), 'photos/2026-09-01-back-gone.jpg': bytes(7) });
    vi.stubGlobal('fetch', gh.fetchMock);

    expect(await syncPhotos(config)).toEqual({ uploaded: 1, downloaded: 1, removed: 1 });
    expect([...gh.files.keys()].sort()).toEqual(['photos/2026-10-06-side-p.jpg', mine.path].sort());
    expect([...gh.files.get(mine.path)!.bytes]).toEqual([1, 2, 3]);
    const downloaded = await db.photoBlobs.get(theirs);
    expect(downloaded).toBeTruthy();

    gh.calls.length = 0;
    expect(await syncPhotos(config)).toEqual({ uploaded: 0, downloaded: 0, removed: 0 });
    expect(gh.calls).toEqual(['GET photos']);
  });

  it('removes the file of a photo deleted on this device', async () => {
    const p = await photoRepo.add({ date: '2026-10-20', angle: 'back', blob: new Blob([bytes(5)]), width: 1, height: 1 });
    const gh = fakeFolder({ [p.path]: bytes(5) });
    vi.stubGlobal('fetch', gh.fetchMock);
    await photoRepo.remove(p.id);
    expect(await syncPhotos(config)).toEqual({ uploaded: 0, downloaded: 0, removed: 1 });
    expect(gh.files.size).toBe(0);
  });

  it('encodes bytes the way GitHub expects', () => {
    expect(bytesToBase64(bytes(1, 2, 3))).toBe('AQID');
  });
});
