import { describe, expect, it } from 'vitest';
import type { Achievement, Assessment } from '@/data/types';
import { parseSkillRankReply } from '@/lib/parse/skill';
import { GAME_MASTER_PREAMBLE, VOICE_RULES } from './shared';
import { buildSkillRankPrompt, type SkillForRank } from './skill';

const base = { createdAt: '2026-10-01T12:00:00.000Z', updatedAt: '2026-10-01T12:00:00.000Z' };

function ach(id: string, date: string, text: string, value?: number, unit?: string): Achievement {
  return { ...base, id, skillId: 's1', date, text, value, unit };
}

const running: SkillForRank = {
  ...base,
  id: 's1',
  name: 'Running',
  pillar: 'BODY',
  level: 62.4,
  hours: 216,
  goal: 'Sub-4 marathon',
  milestones: ['62 to 70: a half marathon under 1:55'],
  lastAssessedAt: '2026-10-13T12:00:00.000Z',
  sortOrder: 0,
  achievements: [
    ach('a1', '2026-10-11', 'Long run 22 km', 22, 'km'),
    ach('a2', '2026-10-18', '8 km at 5:52 pace', 8, 'km'),
    ach('a3', '2026-09-01', 'First 10 km'),
    ach('a4', '2026-09-02', 'x4'),
    ach('a5', '2026-09-03', 'x5'),
    ach('a6', '2026-09-04', 'x6'),
  ],
  lastAssessment: { ...base, id: 'as1', skillId: 's1', level: 62, reasoning: 'Steady 8 km runs.', createdAt: '2026-10-13T12:00:00.000Z' } as Assessment,
};

const speaking: SkillForRank = {
  ...base,
  id: 's2',
  name: 'Public speaking',
  pillar: 'MIND',
  level: 31,
  hours: 20,
  milestones: [],
  sortOrder: 1,
  achievements: [],
};

describe('buildSkillRankPrompt', () => {
  const md = buildSkillRankPrompt({ displayName: 'Jaineel', stateOfMeMd: '# State of Me\nFinal-year student. Salary ₹40,000 a month.', skills: [running, speaking], today: '2026-10-19' });

  it('starts with the shared preamble and voice, then the task and the exact reply format', () => {
    expect(md.startsWith(GAME_MASTER_PREAMBLE)).toBe(true);
    expect(md).toContain(VOICE_RULES);
    expect(md).toContain('## ASSESSMENT\nName | level | percentile among everyone | percentile among practitioners | one-line reasoning');
    expect(md).toContain('## NEXT_MILESTONES\nName | from -> to: what would prove it');
    expect(md).toMatch(/never inflate/i);
    expect(md.indexOf('---')).toBeGreaterThan(md.indexOf('## NEXT_MILESTONES'));
  });

  it('includes hours, previous level, goal, milestones and the five newest achievements per skill', () => {
    expect(md).toContain('## Running');
    expect(md).toContain('Level now: 62.4. Previous ranking: 62, on 13 Oct.');
    expect(md).toContain('Hours logged in total: 216');
    expect(md).toContain('What it is for: Sub-4 marathon');
    expect(md).toContain('Next milestones on record: 62 to 70: a half marathon under 1:55');
    expect(md).toContain('18 Oct: 8 km at 5:52 pace (8 km)');
    expect(md.indexOf('18 Oct: 8 km')).toBeLessThan(md.indexOf('11 Oct: Long run'));
    expect(md).not.toContain('First 10 km');
  });

  it('marks a never-ranked skill and an empty achievement list', () => {
    expect(md).toContain("Level now: 31, the player's own starting guess. Never ranked by you.");
    expect(md).toContain('Recent achievements: none logged');
  });

  it('carries the player, the date and the State of Me; strips money when asked', () => {
    expect(md).toContain('Jaineel. Today is 19 Oct 2026.');
    expect(md).toContain('Final-year student.');
    const noMoney = buildSkillRankPrompt({ displayName: 'J', stateOfMeMd: 'Final-year student.\nSalary ₹40,000 a month.', skills: [], excludeMoney: true, today: '2026-10-19' });
    expect(noMoney).not.toContain('40,000');
    expect(noMoney).toContain('(No skills yet.)');
  });

  it('round-trips with the parser on a reply in the asked format', () => {
    const reply = '## ASSESSMENT\nRunning | 64 | 92 | 55 | ok\nPublic speaking | 31 | 50 | 20 | ok\n## NEXT_MILESTONES\nRunning | 64 -> 70: half under 1:55';
    const r = parseSkillRankReply(reply, [running.name, speaking.name]);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
  });
});
