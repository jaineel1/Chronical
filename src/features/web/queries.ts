/** Read-only live queries for the mind web. */
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/data/db';
import type { WebEdge, WebNode, WebNodeType } from '@/data/types';

export interface WebGraph {
  nodes: WebNode[];
  edges: WebEdge[];
}

export function useWebGraph(): WebGraph | undefined {
  return useLiveQuery(async () => {
    const [nodes, edges] = await Promise.all([db.webNodes.toArray(), db.webEdges.toArray()]);
    return { nodes, edges };
  }, []);
}

/** Most important first, then most recently seen, then label so the order is stable. */
export function sortNodes(nodes: readonly WebNode[]): WebNode[] {
  return [...nodes].sort((a, b) => b.importance - a.importance || b.lastSeen.localeCompare(a.lastSeen) || a.label.localeCompare(b.label));
}

export function filterNodes(nodes: readonly WebNode[], type: WebNodeType | 'all', query: string): WebNode[] {
  const q = query.trim().toLowerCase();
  return nodes.filter((n) => (type === 'all' || n.type === type) && (!q || n.label.toLowerCase().includes(q) || n.summaryMd.toLowerCase().includes(q)));
}
