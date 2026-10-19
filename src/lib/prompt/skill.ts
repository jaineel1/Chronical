/**
 * Skill ranking prompt. One prompt ranks every skill at once so Claude sees the whole character
 * and keeps the scale consistent between skills. The reply is parsed by `parseSkillRankReply`.
 */
import { PILLAR_LABEL, type Achievement, type Assessment, type Skill } from '@/data/types';
import { formatShortDate, toDayKey } from '@/lib/dates';
import { GAME_MASTER_PREAMBLE, RULE, VOICE_RULES, joinBlocks, stripMoney } from './shared';

export type SkillForRank = Skill & { achievements: Achievement[]; lastAssessment?: Assessment };

export interface SkillRankPromptInput {
  displayName: string;
  stateOfMeMd?: string;
  skills: SkillForRank[];
  /** Strip money figures from the State of Me (the player's `excludeMoney` setting). */
  excludeMoney?: boolean;
  /** Day key for "today"; defaults to the current local day. */
  today?: string;
}

/** Achievements listed per skill, newest first. */
export const RANK_ACHIEVEMENTS_PER_SKILL = 5;

export const SKILL_RANK_TASK = `# Task: rank every skill

Rank each of the player's skills below from 1 to 100. Weigh every skill twice: against the general population, and against people who actively practise it. The level you give is the one the game keeps until the next ranking.

- Be honest and specific. Base every number on the evidence below: hours, achievements, measured results. Never inflate. When the evidence is thin, rank conservatively and say what evidence is missing.
- The game's bands: Beginner 1-19, Capable 20-39, Solid 40-59, Advanced 60-79, Expert 80-94, Elite 95-100.
- A level can go down. Moving a skill more than 5 points needs a concrete reason from the log.
- Percentiles run from 0 to 100: 90 means better than 90 percent of that group.
- Then write one or two next milestones per skill: the level it would move to and the single observable result that would prove it.
- Rank every skill listed, one line each, using the names exactly as written.`;

export const SKILL_RANK_REPLY_FORMAT = `# Reply format

Reply ONLY with these two sections, with these exact headers. One line per skill, fields separated by " | ".

## ASSESSMENT
Name | level | percentile among everyone | percentile among practitioners | one-line reasoning

## NEXT_MILESTONES
Name | from -> to: what would prove it`;

function dayLabel(isoOrKey: string | undefined): string | undefined {
  if (!isoOrKey) return undefined;
  const key = /^\d{4}-\d{2}-\d{2}$/.test(isoOrKey) ? isoOrKey : toDayKey(new Date(isoOrKey));
  return formatShortDate(key);
}

function formatLevel(n: number): string {
  return String(Math.round(n * 10) / 10);
}

function skillBlock(s: SkillForRank): string {
  const lines: string[] = [`## ${s.name}`, `- Pillar: ${PILLAR_LABEL[s.pillar]}`];
  const prev = s.lastAssessment;
  if (prev) {
    const when = dayLabel(prev.createdAt);
    lines.push(`- Level now: ${formatLevel(s.level)}. Previous ranking: ${formatLevel(prev.level)}${when ? `, on ${when}` : ''}.`);
    if (prev.reasoning) lines.push(`- Reasoning last time: ${prev.reasoning}`);
  } else if (s.lastAssessedAt) {
    lines.push(`- Level now: ${formatLevel(s.level)}. Last ranked ${dayLabel(s.lastAssessedAt)}.`);
  } else {
    lines.push(`- Level now: ${formatLevel(s.level)}, the player's own starting guess. Never ranked by you.`);
  }
  lines.push(`- Hours logged in total: ${Math.round(s.hours * 10) / 10}`);
  if (s.goal) lines.push(`- What it is for: ${s.goal}`);
  if (s.milestones.length) lines.push(`- Next milestones on record: ${s.milestones.join('; ')}`);
  const recent = [...s.achievements].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)).slice(0, RANK_ACHIEVEMENTS_PER_SKILL);
  if (recent.length) {
    lines.push('- Recent achievements:');
    for (const a of recent) {
      const value = a.value !== undefined ? ` (${a.value}${a.unit ? ` ${a.unit}` : ''})` : '';
      lines.push(`  - ${dayLabel(a.date) ?? a.date}: ${a.text}${value}`);
    }
  } else {
    lines.push('- Recent achievements: none logged');
  }
  return lines.join('\n');
}

export function buildSkillRankPrompt(input: SkillRankPromptInput): string {
  const today = input.today ?? toDayKey(new Date());
  const name = input.displayName.trim() || 'The player';
  const stateOfMe = input.stateOfMeMd?.trim() ? (input.excludeMoney ? stripMoney(input.stateOfMeMd) : input.stateOfMeMd).trim() : '';
  const skills = input.skills.length ? input.skills.map(skillBlock).join('\n\n') : '(No skills yet.)';
  const data = joinBlocks(
    `# Player\n${name}. Today is ${formatShortDate(today)} ${today.slice(0, 4)}.`,
    stateOfMe ? `# State of Me\n${stateOfMe.replace(/^#\s+State of Me\s*\n/i, '')}` : null,
    `# Skills (${input.skills.length})\n\n${skills}`,
  );
  return joinBlocks(GAME_MASTER_PREAMBLE, VOICE_RULES, SKILL_RANK_TASK, SKILL_RANK_REPLY_FORMAT, RULE, data);
}
