import { useSyncExternalStore } from 'react';
import type { GitHubRepo } from '@/lib/sync/github';
import type { SyncBase } from '@/lib/sync/merge';

/**
 * Per-device sync settings, kept in localStorage on purpose: the token and the last-sync base belong
 * to this device and must never travel inside the synced data or a backup.
 */
const CONFIG_KEY = 'chronicle.sync.config';
const BASE_KEY = 'chronicle.sync.base';
const RESULT_KEY = 'chronicle.sync.result';

export interface SyncState {
  config: GitHubRepo | null;
  /** True once this device has chosen which data to keep and synced at least once. */
  linked: boolean;
  running: boolean;
  lastSyncAt?: string;
  error?: string;
}

function read<T>(key: string): T | null {
  const raw = localStorage.getItem(key);
  return raw === null ? null : (JSON.parse(raw) as T);
}

function write(key: string, value: unknown): void {
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, JSON.stringify(value));
}

let state: SyncState | null = null;
const listeners = new Set<() => void>();

function load(): SyncState {
  const result = read<{ lastSyncAt?: string; error?: string }>(RESULT_KEY);
  return { config: read<GitHubRepo>(CONFIG_KEY), linked: read<SyncBase>(BASE_KEY) !== null, running: false, ...result };
}

function current(): SyncState {
  if (!state) state = load();
  return state;
}

function set(next: Partial<SyncState>): void {
  state = { ...current(), ...next };
  for (const l of listeners) l();
}

export function getSyncState(): SyncState {
  return current();
}

export function useSyncState(): SyncState {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
  );
}

/** Saving a different repo (or null) unlinks this device: its base no longer describes that repo. */
export function setSyncConfig(config: GitHubRepo | null): void {
  const prev = current().config;
  write(CONFIG_KEY, config);
  if (prev?.repo !== config?.repo) {
    write(BASE_KEY, null);
    write(RESULT_KEY, null);
    set({ config, linked: false, lastSyncAt: undefined, error: undefined });
  } else {
    set({ config });
  }
}

export function getSyncBase(): SyncBase | null {
  return read<SyncBase>(BASE_KEY);
}

export function setSyncBase(base: SyncBase): void {
  write(BASE_KEY, base);
  set({ linked: true });
}

export function setSyncRunning(running: boolean): void {
  set({ running });
}

export function recordSyncResult(result: { lastSyncAt: string } | { error: string }): void {
  const next = 'error' in result ? { lastSyncAt: current().lastSyncAt, error: result.error } : { lastSyncAt: result.lastSyncAt, error: undefined };
  write(RESULT_KEY, next);
  set(next);
}
