import { describe, expect, it } from 'vitest';
import { normalizeMilestoneText, normalizeSkillName, parsePercentile, parseSkillRankReply } from './skill';

const KNOWN = ['Running', 'Frontend', 'Lifting', 'UI design', 'Public speaking', 'Cooking'];

const CANONICAL = `## ASSESSMENT
Running | 64 | 92 | 55 | 8 km at 5:52 and a 22 km long run put you ahead of most club runners.
Frontend | 71 | 97 | 70 | Shipped invoicing PDFs; production work with paying users.
Lifting | 48 | 75 | 40 | Squat 70 kg x 5 at 72 kg bodyweight is solid, not yet strong.
UI design | 66 | 95 | 60 | A client approved a redesign in one round.
Public speaking | 30 | 55 | 20 | Twenty hours, no talks to strangers yet.
Cooking | 44 | 70 | 35 | Cooks protein most days, still orders out under stress.

## NEXT_MILESTONES
Running | 64 -> 70: a half marathon under 1:55
Running | 70 -> 78: a 30 km long run at 5:40
Frontend | 71 -> 78: a production app with paying users
Lifting | 48 -> 55: squat 80 kg for five
UI design | 66 -> 72: a full app redesign shipped end to end
Public speaking | 30 -> 40: a ten-minute talk to strangers
Cooking | 44 -> 50: five dinners in a row without ordering
`;

describe('parseSkillRankReply', () => {
  it('parses the canonical reply', () => {
    const r = parseSkillRankReply(CANONICAL, KNOWN);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.assessments).toHaveLength(6);
    expect(r.assessments[0]).toEqual({
      name: 'Running',
      level: 64,
      percentileGeneral: 92,
      percentilePractitioners: 55,
      reasoning: '8 km at 5:52 and a 22 km long run put you ahead of most club runners.',
    });
    expect(r.milestones.filter((m) => m.name === 'Running').map((m) => m.text)).toEqual([
      '64 to 70: a half marathon under 1:55',
      '70 to 78: a 30 km long run at 5:40',
    ]);
  });

  it('matches names case-insensitively and ignores punctuation', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nui-DESIGN | 67 | 90 | 50 | ok\n**public speaking:** | 33 | 50 | 25 | better', KNOWN);
    expect(r.assessments.map((a) => a.name)).toEqual(['UI design', 'Public speaking']);
  });

  it('accepts the unicode arrow and "to" in milestones', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 64 | 90 | 50 | x\n## NEXT_MILESTONES\nRunning | 64 → 70: half under 1:55\nRunning | 70 to 78 - 30 km at 5:40', KNOWN);
    expect(r.milestones).toEqual([
      { name: 'Running', text: '64 to 70: half under 1:55', from: 64, to: 70 },
      { name: 'Running', text: '70 to 78: 30 km at 5:40', from: 70, to: 78 },
    ]);
  });

  it('reads a markdown table with header and rule rows', () => {
    const md = `## ASSESSMENT
| Name | Level | Everyone | Practitioners | Reasoning |
|---|---|---|---|---|
| Running | 63 | 91 | 52 | Consistent 8 km runs |
| Cooking | 45 | 70 | 30 | Steady |`;
    const r = parseSkillRankReply(md, KNOWN);
    expect(r.ok).toBe(true);
    expect(r.assessments.map((a) => [a.name, a.level, a.reasoning])).toEqual([
      ['Running', 63, 'Consistent 8 km runs'],
      ['Cooking', 45, 'Steady'],
    ]);
    expect(r.errors).toEqual(['Not ranked: Frontend, Lifting, UI design, Public speaking.']);
  });

  it('clamps levels to 1-100', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 140 | 99 | 99 | elite\nCooking | 0 | 1 | 1 | none yet\nLifting | -5 | 1 | 1 | hmm', KNOWN);
    expect(r.assessments.map((a) => a.level)).toEqual([100, 1, 1]);
  });

  it('keeps one decimal and reads levels written as 64/100 or with a band', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 64.37/100 | 90 | 50 | x\nCooking | 45 (Solid) | 70 | 30 | y', KNOWN);
    expect(r.assessments.map((a) => a.level)).toEqual([64.4, 45]);
  });

  it('reads the new level when the level cell shows the change', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 62 -> 64 | 92 | 55 | long run\nCooking | 44 → 46 (Solid) | 70 | 30 | dinners\nLifting | from 48 to 50 | 75 | 40 | squat', KNOWN);
    expect(r.assessments.map((a) => [a.name, a.level])).toEqual([
      ['Running', 64],
      ['Cooking', 46],
      ['Lifting', 50],
    ]);
  });

  it('skips a table header and bold labels without noise', () => {
    const md = `## ASSESSMENT
| Skill | Rank | Everyone | Practitioners | Why |
|---|---|---|---|---|
| Running | 63 | 91 | 52 | steady |
- **Cooking:** 45 — five dinners a week`;
    const r = parseSkillRankReply(md, ['Running', 'Cooking']);
    expect(r.assessments.map((a) => [a.name, a.level, a.reasoning])).toEqual([
      ['Running', 63, 'steady'],
      ['Cooking', 45, 'five dinners a week'],
    ]);
    expect(r.errors).toEqual([]);
  });

  it('reads milestones written as separate from and to columns', () => {
    const md = `## ASSESSMENT
Running | 64 | 92 | 55 | ok
## NEXT_MILESTONES
| Skill | From | To | What would prove it |
|---|---|---|---|
| Running | 64 | 70 | a half marathon under 1:55 |`;
    const r = parseSkillRankReply(md, ['Running']);
    expect(r.milestones).toEqual([{ name: 'Running', text: '64 to 70: a half marathon under 1:55', from: 64, to: 70 }]);
    expect(r.errors).toEqual([]);
  });

  it('reads "top N%" and ordinal percentiles', () => {
    expect(parsePercentile('top 8%')).toBe(92);
    expect(parsePercentile('92nd')).toBe(92);
    expect(parsePercentile('85%')).toBe(85);
    expect(parsePercentile('120')).toBe(100);
    expect(parsePercentile('n/a')).toBeUndefined();
    expect(parsePercentile('')).toBeUndefined();
  });

  it('treats a missing percentile as undefined and keeps the reasoning', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 64 | n/a | 55 | steady\nCooking | 44 | Cooks most days, 5 dinners a week', KNOWN);
    expect(r.assessments[0]).toMatchObject({ percentileGeneral: undefined, percentilePractitioners: 55, reasoning: 'steady' });
    expect(r.assessments[1]).toMatchObject({ percentileGeneral: undefined, percentilePractitioners: undefined, reasoning: 'Cooks most days, 5 dinners a week' });
  });

  it('keeps pipes that belong to the reasoning', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 64 | 90 | 50 | fast | but short on long runs', KNOWN);
    expect(r.assessments[0]!.reasoning).toBe('fast | but short on long runs');
  });

  it('skips unknown skills with a readable error', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nSwimming | 40 | 60 | 30 | pool\nRunning | 64 | 90 | 50 | ok', KNOWN);
    expect(r.ok).toBe(true);
    expect(r.assessments.map((a) => a.name)).toEqual(['Running']);
    expect(r.errors[0]).toBe('"Swimming" is not one of your skills; skipped.');
  });

  it('rejects a reply without an ASSESSMENT section', () => {
    const r = parseSkillRankReply('Here is my ranking: Running is about 64.', KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors).toContain('No ## ASSESSMENT section in the reply.');
  });

  it('rejects an ASSESSMENT section with no readable line', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nI could not rank these without more data.', KNOWN);
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toMatch(/no line in the/);
  });

  it('ignores an echoed format line', () => {
    const r = parseSkillRankReply(
      '## ASSESSMENT\nName | level | percentile among everyone | percentile among practitioners | one-line reasoning\nRunning | 64 | 90 | 50 | ok\n## NEXT_MILESTONES\nName | from -> to: what would prove it\nRunning | 64 -> 70: half',
      KNOWN,
    );
    expect(r.errors).toEqual(['Not ranked: Frontend, Lifting, UI design, Public speaking, Cooking.']);
    expect(r.milestones).toHaveLength(1);
  });

  it('parses a reply pasted inside a code fence, with bullets and bold headers', () => {
    const md = '```markdown\n**ASSESSMENT**\n- Running | 64 | 90 | 50 | ok\n- Cooking | 44 | 70 | 30 | fine\n\nNEXT MILESTONES:\n1. Cooking | 44 -> 50: five dinners in a row\n```';
    const r = parseSkillRankReply(md, KNOWN);
    expect(r.assessments.map((a) => a.name)).toEqual(['Running', 'Cooking']);
    expect(r.milestones).toEqual([{ name: 'Cooking', text: '44 to 50: five dinners in a row', from: 44, to: 50 }]);
  });

  it('falls back to "Name: level" lines without pipes', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning: 64, ahead of most club runners\nPublic-speaking - 32', KNOWN);
    expect(r.assessments).toEqual([
      { name: 'Running', level: 64, percentileGeneral: undefined, percentilePractitioners: undefined, reasoning: 'ahead of most club runners' },
      { name: 'Public speaking', level: 32, percentileGeneral: undefined, percentilePractitioners: undefined, reasoning: '' },
    ]);
  });

  it('reports a line with no level', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | high | 90 | 50 | x\nCooking | 44 | 70 | 30 | y', KNOWN);
    expect(r.assessments.map((a) => a.name)).toEqual(['Cooking']);
    expect(r.errors).toContain('No level for "Running".');
  });

  it('is fine without NEXT_MILESTONES and with CRLF line endings', () => {
    const r = parseSkillRankReply('## ASSESSMENT\r\nRunning | 64 | 90 | 50 | ok\r\n', ['Running']);
    expect(r.ok).toBe(true);
    expect(r.milestones).toEqual([]);
    expect(r.errors).toEqual([]);
  });

  it('accepts any name when no known names are given', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nChess | 40 | 70 | 20 | club level', []);
    expect(r.assessments[0]!.name).toBe('Chess');
  });

  it('lets a later duplicate line win', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 60 | 90 | 50 | first\nrunning | 63 | 90 | 50 | corrected', KNOWN);
    expect(r.assessments).toHaveLength(1);
    expect(r.assessments[0]).toMatchObject({ level: 63, reasoning: 'corrected' });
  });

  it('handles empty and whitespace-only input', () => {
    expect(parseSkillRankReply('', KNOWN).ok).toBe(false);
    expect(parseSkillRankReply('   \n\n', KNOWN).ok).toBe(false);
  });

  it('skips milestones for unknown skills and keeps free-form milestone text', () => {
    const r = parseSkillRankReply('## ASSESSMENT\nRunning | 64 | 90 | 50 | ok\n## NEXT_MILESTONES\nRunning | run a sub-25 5 km\nGolf | 10 -> 20: a round under 100', KNOWN);
    expect(r.milestones).toEqual([{ name: 'Running', text: 'run a sub-25 5 km' }]);
    expect(r.errors.some((e) => e.includes('Golf'))).toBe(true);
  });
});

describe('skill name and milestone helpers', () => {
  it('normalizes names for matching', () => {
    expect(normalizeSkillName('**UI Design** (visual)')).toBe('uidesign');
    expect(normalizeSkillName('Public-speaking')).toBe(normalizeSkillName('public speaking'));
  });
  it('normalizes milestone arrows', () => {
    expect(normalizeMilestoneText('62 -> 70: a half marathon under 1:55').text).toBe('62 to 70: a half marathon under 1:55');
    expect(normalizeMilestoneText('62→70').text).toBe('62 to 70');
    expect(normalizeMilestoneText('just keep going').text).toBe('just keep going');
  });
});
