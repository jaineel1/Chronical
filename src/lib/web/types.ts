/**
 * The shapes the nightly reply's ## PEOPLE and ## WEB sections parse into, shared by the parser
 * (lib/parse/reply.ts) and the writer (data/webRepo.ts).
 */
import type { WebNodeType } from '@/data/types';

export const WEB_NODE_TYPES: readonly WebNodeType[] = ['person', 'goal', 'routine', 'book', 'skill', 'place', 'topic', 'event', 'habit'];

export function webNodeTypeFrom(text: string): WebNodeType | undefined {
  const t = text.trim().toLowerCase().replace(/s$/, '');
  return (WEB_NODE_TYPES as readonly string[]).includes(t) ? (t as WebNodeType) : undefined;
}

/** `- node: Type | Label | fact for today` */
export interface WebNodeUpdate {
  type: WebNodeType;
  label: string;
  fact: string;
}

/** `- link: Label A -> Label B | relation | note` */
export interface WebLinkUpdate {
  from: string;
  to: string;
  relation: string;
  note?: string;
}

/** `- summary: Label | a one-line rewrite of the node's running summary` */
export interface WebSummaryUpdate {
  label: string;
  summary: string;
}

export interface WebUpdates {
  nodes: WebNodeUpdate[];
  links: WebLinkUpdate[];
  summaries: WebSummaryUpdate[];
}

/** `- Name | circle | one line of what the log said` */
export interface PersonUpdate {
  name: string;
  /** As Claude wrote it; webRepo maps it onto a Circle. */
  circle?: string;
  note: string;
}

/** Case- and space-insensitive key for labels and names. */
export function labelKey(label: string): string {
  return label.trim().replace(/\s+/g, ' ').toLowerCase();
}
