import { useEffect } from 'react';
import { syncNow } from '@/data/sync';
import { getSyncState } from '@/data/syncState';

/**
 * Syncs a linked device when the app opens, comes back to the foreground, goes to the background, or
 * gets its connection back. Failures are recorded in the sync state, which the shell shows in red.
 */
export function AutoSync() {
  useEffect(() => {
    const run = () => {
      const s = getSyncState();
      if (!s.linked || s.running || !navigator.onLine) return;
      syncNow().catch((e: unknown) => console.error('Chronicle sync failed', e));
    };
    run();
    document.addEventListener('visibilitychange', run);
    window.addEventListener('online', run);
    return () => {
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('online', run);
    };
  }, []);
  return null;
}
