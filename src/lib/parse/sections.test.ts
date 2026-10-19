import { describe, expect, it } from 'vitest';
import { bullets, num, pairs, section, splitSections } from './sections';

describe('splitSections', () => {
  it('splits on ## headers and normalises titles', () => {
    const s = splitSections('intro\n## BRIEF\nhello\n\n## Quests\n- [Body] run | reward: legs\n### state of me\nx');
    expect(s.map((x) => x.title)).toEqual(['', 'BRIEF', 'QUESTS', 'STATE_OF_ME']);
    expect(section(s, 'BRIEF')?.body).toBe('hello');
    expect(section(s, 'QUESTS')?.body).toBe('- [Body] run | reward: legs');
  });
  it('accepts bold and colon headers and aliases', () => {
    const s = splitSections('**AFFIRMATION**\n- a\nWARNING:\n- b\n## Morning letter\ntext');
    expect(s.map((x) => x.title)).toEqual(['AFFIRMATIONS', 'WARNINGS', 'BRIEF']);
  });
  it('ignores headers inside code fences', () => {
    const s = splitSections('## BRIEF\n```\n## NOT A HEADER\n```\nafter');
    expect(s).toHaveLength(1);
    expect(s[0]!.body).toContain('## NOT A HEADER');
  });
  it('handles CRLF and trailing hashes', () => {
    const s = splitSections('## STATS ##\r\nBody +2\r\nMind -1\r\n');
    expect(s[0]!.title).toBe('STATS');
    expect(bullets(s[0]!.body)).toEqual(['Body +2', 'Mind -1']);
  });
});

describe('helpers', () => {
  it('bullets strips markers', () => {
    expect(bullets('- a\n* b\n• c\n1. d\n2) e\n\nplain')).toEqual(['a', 'b', 'c', 'd', 'e', 'plain']);
  });
  it('pairs reads key: value and key | value', () => {
    expect(pairs('- Level: 62\n- **Why** | steady 8 km runs')).toEqual({ level: '62', why: 'steady 8 km runs' });
  });
  it('num parses signed decimals with units', () => {
    expect(num('+2')).toBe(2);
    expect(num('-1.5 kg')).toBe(-1.5);
    expect(num('1,240 pts')).toBe(1240);
    expect(num('none')).toBeUndefined();
  });
});
