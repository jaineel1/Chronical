/**
 * The mind web as prompt text: the most important (then most recently seen) nodes with their
 * running summary and last three facts, and the links among them, capped by a token budget. Pure.
 */
import type { WebEdge, WebNode } from '@/data/types';
import { estimateTokens } from '@/lib/prompt/shared';

export const WEB_EXCERPT_TOKENS = 2_500;
export const WEB_EXCERPT_NODES = 25;
export const WEB_FACTS_SHOWN = 3;

export interface WebExcerptOptions {
  /** At most this many nodes (default 25). */
  maxNodes?: number;
  /** Token cap for the whole block, header included (default 2,500). */
  maxTokens?: number;
  /** Section header (default "Mind web"). */
  title?: string;
}

/** Importance first, then the most recently seen, then the most mentioned. */
export function rankNodes(nodes: readonly WebNode[]): WebNode[] {
  return [...nodes].sort(
    (a, b) => b.importance - a.importance || b.lastSeen.localeCompare(a.lastSeen) || b.mentions - a.mentions || a.label.localeCompare(b.label),
  );
}

function oneLine(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function nodeBlock(n: WebNode): string {
  const seen = n.mentions > 0 ? `, ${n.mentions} ${n.mentions === 1 ? 'mention' : 'mentions'}, last ${n.lastSeen}` : '';
  const summary = oneLine(n.summaryMd);
  const lines = [`- ${n.label} (${n.type}, importance ${n.importance}${seen})${summary ? `: ${summary}` : ''}`];
  for (const f of n.facts.slice(-WEB_FACTS_SHOWN)) lines.push(`  - ${f.date}: ${oneLine(f.text)}`);
  return lines.join('\n');
}

function edgeLine(e: WebEdge, labels: Map<string, string>): string {
  const note = e.note?.trim() ? ` (${oneLine(e.note)})` : '';
  return `- ${labels.get(e.from)} -> ${labels.get(e.to)}: ${oneLine(e.relation)}${note}`;
}

export function webExcerpt(nodes: readonly WebNode[], edges: readonly WebEdge[], opts: WebExcerptOptions = {}): string {
  const maxNodes = Math.max(0, Math.min(opts.maxNodes ?? WEB_EXCERPT_NODES, WEB_EXCERPT_NODES));
  const maxTokens = opts.maxTokens ?? WEB_EXCERPT_TOKENS;
  const header = `## ${opts.title ?? 'Mind web'}`;
  if (!nodes.length) return `${header}\nNothing in the web yet. Start it tonight in ## WEB.`;

  const ranked = rankNodes(nodes);
  // Sized with the longest count it can show, so the final line never pushes the block over the cap.
  const intro = (n: number) => `The ${n} ${n === 1 ? 'thread that matters' : 'threads that matter'} most right now, of ${nodes.length} in the web. Add to it in ## WEB; do not repeat what a summary already says.`;
  const fits = (parts: string[]) => estimateTokens(parts.join('\n')) <= maxTokens;

  const blocks: string[] = [];
  const shown: WebNode[] = [];
  for (const n of ranked.slice(0, maxNodes)) {
    const block = nodeBlock(n);
    if (!fits([header, intro(nodes.length), ...blocks, block])) break;
    blocks.push(block);
    shown.push(n);
  }
  if (!shown.length) return `${header}\n${nodes.length} ${nodes.length === 1 ? 'node' : 'nodes'} in the web, left out tonight to keep this prompt short.`;

  const labels = new Map(shown.map((n) => [n.id, n.label]));
  const among = [...edges]
    .filter((e) => labels.has(e.from) && labels.has(e.to))
    .sort((a, b) => b.weight - a.weight || b.lastSeen.localeCompare(a.lastSeen));
  const parts = [header, intro(shown.length), ...blocks];
  if (among.length && fits([...parts, 'Links:'])) {
    const links: string[] = [];
    for (const e of among) {
      const line = edgeLine(e, labels);
      if (!fits([...parts, 'Links:', ...links, line])) break;
      links.push(line);
    }
    if (links.length) parts.push('Links:', ...links);
  }
  return parts.join('\n');
}
