/**
 * Applies a pasted skill-ranking reply: new levels, Claude's next milestones, one Assessment row
 * per ranked skill, and the reply attached to its Prompt row.
 */
import { db } from '@/data/db';
import { promptRepo, stamp } from '@/data/repo';
import type { Assessment, Skill } from '@/data/types';
import { nowIso } from '@/lib/dates';
import { parseSkillRankReply, type SkillRankParse } from '@/lib/parse/skill';
import { formatSkillLevel } from '@/features/editors/lib/skills';
import type { HandoffResult } from '@/ui/PromptHandoff';

export interface RankChange {
  skillId: string;
  name: string;
  from: number;
  to: number;
}

/** "Rankings updated: Running 62 → 64, Frontend 71 → 71." plus any skipped lines. */
export function rankMessage(changes: readonly RankChange[], notes: readonly string[] = []): string {
  const list = changes.map((c) => `${c.name} ${formatSkillLevel(c.from)} → ${formatSkillLevel(c.to)}`).join(', ');
  return [`Rankings updated: ${list}.`, ...notes].join(' ');
}

export async function applySkillRankReply(
  replyMd: string,
  promptId: string | undefined,
): Promise<HandoffResult & { parsed: SkillRankParse; changes: RankChange[] }> {
  const skills = (await db.skills.toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
  const parsed = parseSkillRankReply(replyMd, skills.map((s) => s.name));
  if (!parsed.ok) {
    if (promptId) await promptRepo.attachReply(promptId, replyMd, false);
    return { ok: false, error: `${parsed.errors[0] ?? 'Could not read that reply.'} Nothing was changed.`, parsed, changes: [] };
  }
  const byName = new Map(skills.map((s) => [s.name, s]));
  const changes: RankChange[] = [];
  await db.transaction('rw', db.skills, db.assessments, async () => {
    const now = nowIso();
    for (const a of parsed.assessments) {
      const skill = byName.get(a.name);
      if (!skill) continue;
      const milestones = parsed.milestones.filter((m) => m.name === a.name).map((m) => m.text);
      const next: Skill = {
        ...skill,
        level: a.level,
        milestones: milestones.length ? milestones : skill.milestones,
        lastAssessedAt: now,
        updatedAt: now,
      };
      await db.skills.put(next);
      await db.assessments.put(
        stamp<Assessment>({
          skillId: skill.id,
          level: a.level,
          percentileGeneral: a.percentileGeneral,
          percentilePractitioners: a.percentilePractitioners,
          reasoning: a.reasoning,
          promptId,
        }),
      );
      changes.push({ skillId: skill.id, name: skill.name, from: skill.level, to: a.level });
    }
  });
  if (promptId) await promptRepo.attachReply(promptId, replyMd, true);
  // Keep the player's order in the message, not Claude's.
  const order = new Map(skills.map((s, i) => [s.id, i]));
  changes.sort((x, y) => (order.get(x.skillId) ?? 0) - (order.get(y.skillId) ?? 0));
  return { ok: true, message: rankMessage(changes, parsed.errors), parsed, changes };
}
