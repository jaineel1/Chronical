import { describe, expect, it } from 'vitest';
import { ORIGIN_REPLY_HEADERS, buildOriginPrompt } from './origin';
import { GAME_MASTER_PREAMBLE, VOICE_RULES } from './shared';
import { SUBSTATS } from '@/data/types';

const SHEET = `# Origin Sheet — Riya, Monday, 19 October 2026

## Part 2: Body
**Q** Weight this morning, roughly
**A** 61 kg

## Part 7: Money
**Q** Roughly what comes in a month
**A** ₹18,000 from two clients
**Q** Debts, or none
**A** a loan for the laptop
`;

describe('buildOriginPrompt', () => {
  const md = buildOriginPrompt({ displayName: 'Riya', originSheetMd: SHEET, today: '2026-10-19' });

  it('starts with the preamble and voice rules, then the task, the format, a rule and the data', () => {
    expect(md.startsWith(GAME_MASTER_PREAMBLE)).toBe(true);
    expect(md.indexOf(VOICE_RULES)).toBeGreaterThan(0);
    const rule = md.indexOf('\n---\n');
    expect(rule).toBeGreaterThan(md.indexOf('## Reply format'));
    expect(md.indexOf('# Origin Sheet — Riya')).toBeGreaterThan(rule);
    expect(md.endsWith(SHEET)).toBe(true);
  });

  it('asks for the six exact headers in order', () => {
    const positions = ORIGIN_REPLY_HEADERS.map((h) => md.indexOf(`\n## ${h}\n`));
    for (const p of positions) expect(p).toBeGreaterThan(0);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    expect(md).toContain('Name | Pillar | Level 1-100 | one line why');
    expect(md).toContain('Name | Pillar | SubStat | weight 1-5 | days | window | upside | cost');
    expect(md).toContain('Title | Pillar | why | target date YYYY-MM-DD or none');
    for (const sub of ['### Where I am', '### Patterns the game master has noticed', '### People', '### Voice']) expect(md).toContain(sub);
  });

  it('includes the whole sub-stat vocabulary and the date', () => {
    for (const subs of Object.values(SUBSTATS)) for (const s of subs) expect(md).toContain(s);
    expect(md).toContain('- Body: Strength, Endurance, Recovery, Nutrition');
    expect(md).toContain('Today is Monday, 19 October 2026 (2026-10-19), Day 1 of the game');
    expect(md).toContain('Riya has just finished the Origin Sheet');
  });

  it('keeps money in by default and strips it when the player excludes money', () => {
    expect(md).toContain('₹18,000');
    const lean = buildOriginPrompt({ displayName: 'Riya', originSheetMd: SHEET, today: '2026-10-19', excludeMoney: true });
    expect(lean).not.toContain('₹18,000');
    expect(lean).not.toContain('loan');
    expect(lean).toContain('**A** 61 kg');
    expect(lean).toContain('keeps money out of this game');
    expect(md).not.toContain('keeps money out of this game');
  });

  it('is deterministic and never shouts', () => {
    expect(buildOriginPrompt({ displayName: 'Riya', originSheetMd: SHEET, today: '2026-10-19' })).toBe(md);
    const instructions = md.slice(0, md.indexOf('\n---\n'));
    expect(instructions).not.toMatch(/!/);
  });

  it('copes with an empty name', () => {
    expect(buildOriginPrompt({ displayName: '  ', originSheetMd: SHEET, today: '2026-10-19' })).toContain('The player has just finished');
  });
});
