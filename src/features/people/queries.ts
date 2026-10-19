import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { Person } from '@/data/types';

/** Everyone on the tree, oldest branch first (the tree sorts by recency itself). */
export function usePeople(): Person[] | undefined {
  return useLiveQuery(async () => (await db.people.toArray()).sort((a, b) => a.createdAt.localeCompare(b.createdAt)), []);
}
