import { useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import { photoRepo } from '@/data/repo';
import type { Photo } from '@/data/types';

export function usePhotos(): Photo[] | undefined {
  return useLiveQuery(() => photoRepo.list(), []);
}

/** The newest weight logged on or before `date`, with the day it was logged. */
export function useLatestWeight(date: string): { kg: number; date: string } | null | undefined {
  return useLiveQuery(async () => {
    const logs = await db.dayLogs.where('date').belowOrEqual(date).toArray();
    const hit = logs.filter((l) => typeof l.weightKg === 'number').sort((a, b) => b.date.localeCompare(a.date))[0];
    return hit ? { kg: hit.weightKg as number, date: hit.date } : null;
  }, [date]);
}

/**
 * An object URL for a photo's image, revoked when it changes or the view goes. `missing` is true when
 * this device does not have the image yet (taken elsewhere; the next sync brings it).
 */
export function usePhotoUrl(id: string): { url?: string; missing: boolean } {
  const row = useLiveQuery(async () => (await db.photoBlobs.get(id)) ?? null, [id]);
  const [url, setUrl] = useState<string>();
  useEffect(() => {
    if (!row) {
      setUrl(undefined);
      return;
    }
    const u = URL.createObjectURL(new Blob([row.bytes], { type: row.type }));
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [row]);
  return { url, missing: row === null };
}
