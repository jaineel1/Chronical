import { describe, expect, it } from 'vitest';
import type { WebEdge, WebNode } from '@/data/types';
import { estimateTokens } from '@/lib/prompt/shared';
import { rankNodes, webExcerpt } from './excerpt';

function node(id: string, over: Partial<WebNode> = {}): WebNode {
  return {
    id,
    createdAt: '',
    updatedAt: '',
    type: 'topic',
    label: id,
    summaryMd: '',
    facts: [],
    firstSeen: '2026-10-01',
    lastSeen: '2026-10-10',
    mentions: 1,
    importance: 2,
    ...over,
  };
}

function edge(from: string, to: string, over: Partial<WebEdge> = {}): WebEdge {
  return { id: `${from}-${to}`, createdAt: '', updatedAt: '', from, to, relation: 'helps', weight: 1, firstSeen: '2026-10-01', lastSeen: '2026-10-10', ...over };
}

describe('rankNodes', () => {
  it('orders by importance, then the most recently seen', () => {
    const ranked = rankNodes([node('a', { importance: 2, lastSeen: '2026-10-18' }), node('b', { importance: 5 }), node('c', { importance: 2, lastSeen: '2026-10-19' })]);
    expect(ranked.map((n) => n.id)).toEqual(['b', 'c', 'a']);
  });
});

describe('webExcerpt', () => {
  it('invites the first entries when the web is empty', () => {
    expect(webExcerpt([], [])).toBe('## Mind web\nNothing in the web yet. Start it tonight in ## WEB.');
  });

  it('shows the summary, the last three facts and the links among the nodes shown', () => {
    const riya = node('riya', {
      label: 'Riya',
      type: 'person',
      importance: 4,
      mentions: 5,
      lastSeen: '2026-10-18',
      summaryMd: 'Classmate in Maths.\nLends notes.',
      facts: ['01', '02', '03', '04'].map((d) => ({ date: `2026-10-${d}`, text: `fact ${d}` })),
    });
    const goal = node('goal', { label: 'Sub-4 marathon', type: 'goal', importance: 4 });
    const lone = node('lone', { importance: 1 });
    const md = webExcerpt([riya, goal, lone], [edge('riya', 'goal', { relation: 'runs with', note: 'Sundays' }), edge('riya', 'ghost')], { maxNodes: 2 });
    expect(md).toContain('## Mind web\nThe 2 threads that matter most right now, of 3 in the web.');
    expect(md).toContain('- Riya (person, importance 4, 5 mentions, last 2026-10-18): Classmate in Maths. Lends notes.');
    expect(md).not.toContain('fact 01');
    expect(md).toContain('  - 2026-10-02: fact 02\n  - 2026-10-03: fact 03\n  - 2026-10-04: fact 04');
    expect(md).toContain('- Sub-4 marathon (goal, importance 4, 1 mention, last 2026-10-10)');
    expect(md).not.toContain('lone');
    expect(md).toContain('Links:\n- Riya -> Sub-4 marathon: runs with (Sundays)');
    expect(md).not.toContain('ghost');
  });

  it('never shows more than 25 nodes and stays under its token cap', () => {
    const many = Array.from({ length: 60 }, (_, i) => node(`n${i}`, { summaryMd: 's'.repeat(100) }));
    expect((webExcerpt(many, []).match(/^- n/gm) ?? []).length).toBe(25);
    expect((webExcerpt(many, [], { maxNodes: 40 }).match(/^- n/gm) ?? []).length).toBe(25);
    const big = Array.from({ length: 25 }, (_, i) => node(`b${i}`, { summaryMd: 'x'.repeat(1200) }));
    const edges = big.slice(1).map((n) => edge('b0', n.id));
    const md = webExcerpt(big, edges, { maxTokens: 1200 });
    expect(estimateTokens(md)).toBeLessThanOrEqual(1200);
    expect((md.match(/^- b\d+ \(/gm) ?? []).length).toBe(3);
  });

  it('says the web was left out when not even one node fits', () => {
    expect(webExcerpt([node('a')], [], { maxNodes: 0 })).toBe('## Mind web\n1 node in the web, left out tonight to keep this prompt short.');
  });
});
