import { describe, expect, it } from 'vitest';
import { parseLoreReply } from '@/lib/parse/lore';
import { GAME_MASTER_PREAMBLE } from './shared';
import { LORE_UPDATE_FIELDS, buildLorePrompt } from './lore';

describe('buildLorePrompt', () => {
  const skill = buildLorePrompt({ type: 'skill', name: 'Running', summaryLines: ['Level 62 of 100 (Advanced)', '212 hours logged'] }, 'Ran 22 km last Sunday.', { today: '2026-10-19' });

  it('starts with the preamble and has the five exact headers in order', () => {
    expect(skill.startsWith(GAME_MASTER_PREAMBLE)).toBe(true);
    const order = ['## FACTS', '## ACHIEVEMENTS', '## LESSONS', '## UPDATES', '## REPLY'].map((h) => skill.indexOf(h));
    expect(order.every((i) => i > 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(skill).toContain('YYYY-MM-DD or none | what they did | value unit or none');
  });

  it('puts the data after the rule: summary, the note and today', () => {
    const rule = skill.indexOf('\n---\n');
    expect(rule).toBeGreaterThan(skill.indexOf('## REPLY'));
    expect(skill.indexOf('- Level 62 of 100 (Advanced)')).toBeGreaterThan(rule);
    expect(skill).toContain('# What the player wrote\nRan 22 km last Sunday.');
    expect(skill).toContain('Today is 2026-10-19 (19 Oct).');
  });

  it('lists only the allowed update fields per type', () => {
    expect(skill).toContain('- level:');
    expect(skill).toContain('- goal:');
    expect(skill).not.toContain('- closeness:');
    const person = buildLorePrompt({ type: 'person', name: 'Mentor', summaryLines: [] }, 'x');
    for (const f of LORE_UPDATE_FIELDS.person) expect(person).toContain(`- ${f.key}:`);
    expect(person).not.toContain('- level:');
    expect(person).toContain('- Nothing yet.');
  });

  it('asks for lessons only for books and achievements only for skills', () => {
    const book = buildLorePrompt({ type: 'book', name: 'Deep Work', summaryLines: [] }, 'x');
    expect(book).toContain('One bullet per lesson');
    expect(book).toContain('Write none. Achievements belong to skills.');
    expect(skill).toContain('Write none. Lessons belong to books.');
    expect(skill).toContain('One line per concrete result');
  });

  it('round-trips with the parser', () => {
    const r = parseLoreReply('## FACTS\n- Ran 22 km on 2026-10-18.\n## ACHIEVEMENTS\n2026-10-18 | Long run 22 km | 22 km\n## LESSONS\nnone\n## UPDATES\nnone\n## REPLY\nKept.');
    expect(r.ok).toBe(true);
    expect(r.achievements).toHaveLength(1);
  });
});
