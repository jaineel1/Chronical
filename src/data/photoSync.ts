import { deleteFile, getBytes, listDir, putBytes, type GitHubRepo } from '@/lib/sync/github';
import { db } from './db';

/**
 * Progress photo images travel as their own files under photos/ in the sync repo, so the JSON sync
 * stays small. Runs after the JSON sync, when this device's `photos` rows are the merged list:
 * upload images GitHub lacks, download images this device lacks, remove files no photo points at.
 */
export const PHOTO_DIR = 'photos';

export interface PhotoSyncReport {
  uploaded: number;
  downloaded: number;
  removed: number;
}

export async function syncPhotos(config: GitHubRepo): Promise<PhotoSyncReport> {
  const remote = await listDir(config, PHOTO_DIR);
  const remotePaths = new Set(remote.map((e) => e.path));
  const photos = await db.photos.toArray();
  const local = new Set(await db.photoBlobs.toCollection().primaryKeys());
  const report: PhotoSyncReport = { uploaded: 0, downloaded: 0, removed: 0 };

  for (const p of photos) {
    if (local.has(p.id) && !remotePaths.has(p.path)) {
      const row = await db.photoBlobs.get(p.id);
      if (!row) continue;
      await putBytes(config, p.path, new Uint8Array(row.bytes), undefined, `Progress photo, ${p.date}, ${p.angle}`);
      report.uploaded++;
    } else if (!local.has(p.id) && remotePaths.has(p.path)) {
      const bytes = await getBytes(config, p.path);
      await db.photoBlobs.put({ id: p.id, bytes: bytes.buffer, type: 'image/jpeg' });
      report.downloaded++;
    }
  }

  const wanted = new Set(photos.map((p) => p.path));
  for (const e of remote) {
    if (wanted.has(e.path)) continue;
    await deleteFile(config, e.path, e.sha, 'Remove a deleted progress photo');
    report.removed++;
  }
  return report;
}
