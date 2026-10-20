/**
 * The night's writes, in one place: sending the log (closing the night), re-scoring a closed
 * night when a routine is ticked late, and saving a pasted reply. Every flow runs through one
 * queue so a fast double tap can never revert and apply the same night out of order.
 */
import { dayLogRepo, mealRepo, promptRepo, routineRepo } from '@/data/repo';
import type { PromptKind } from '@/data/types';
import { nowIso } from '@/lib/dates';
import { applyNightStats, revertNightStats } from '@/lib/game/apply';
import { closeNight } from '@/lib/game/streaks';
import { parseNightlyReply } from '@/lib/parse/reply';
import { isPeriodQuest, isPeriodWarning } from '@/lib/parse/weekly';
import type { HandoffResult } from '@/ui/PromptHandoff';

let queue: Promise<unknown> = Promise.resolve();

function serial<T>(task: () => Promise<T>): Promise<T> {
  const run = queue.then(task, task);
  queue = run.catch(() => undefined);
  return run;
}

export interface SendContext {
  promptMd: string;
  /** Human model name, e.g. "Haiku". */
  model: string;
  kind: Extract<PromptKind, 'nightly' | 'deep'>;
}

export const SAVED_MESSAGE = 'Letter saved. See you in the morning.';

async function closeAndScore(date: string, ctx: SendContext): Promise<{ warnings: string[] }> {
  await revertNightStats(date);
  const { warnings, routineStats } = await closeNight(date);
  const prompt = await promptRepo.create(ctx.kind, ctx.model, ctx.promptMd, date);
  const now = nowIso();
  await dayLogRepo.update(date, { routineStats, closedAt: now, compiledMd: ctx.promptMd, promptId: prompt.id, sentAt: now });
  await applyNightStats(date);
  return { warnings };
}

/** "Send tonight's log": close the night, keep exactly what was sent, and score the routines. */
export function sendNight(date: string, ctx: SendContext): Promise<{ warnings: string[] }> {
  return serial(() => closeAndScore(date, ctx));
}

/** A routine changed on a night that is already closed: score the night again. */
export function rescoreNight(date: string): Promise<void> {
  return serial(async () => {
    const log = await dayLogRepo.get(date);
    if (!log?.closedAt) return;
    await revertNightStats(date);
    const { routineStats } = await closeNight(date);
    await dayLogRepo.update(date, { routineStats });
    await applyNightStats(date);
  });
}

/**
 * Parse and save a pasted reply. On success the letter, quests, stats and the rest land on the
 * night's DayLog and the pillars move (a re-paste reverts the old stats first). On failure the
 * text is kept as `rawDraft` and nothing else changes.
 */
export function acceptReply(date: string, replyMd: string, ctx: SendContext & { knownNouns: string[] }): Promise<HandoffResult> {
  return serial(async () => {
    const parsed = parseNightlyReply(replyMd, { knownNouns: ctx.knownNouns });
    const before = await dayLogRepo.ensure(date);
    if (!parsed.ok) {
      await dayLogRepo.update(date, { rawDraft: replyMd });
      if (before.promptId) await promptRepo.attachReply(before.promptId, replyMd, false);
      return { ok: false, error: parsed.errors[0] };
    }

    // The copy was blocked or the prompt was copied by hand: it was still sent, so close the night now.
    if (!before.closedAt) await closeAndScore(date, ctx);

    await revertNightStats(date);
    const log = await dayLogRepo.ensure(date);
    // A routine already in the game (added from an earlier paste of this reply) is not suggested again.
    const existing = new Set((await routineRepo.listActive()).map((r) => r.name.trim().toLowerCase()));
    const suggestion = parsed.routine && !existing.has(parsed.routine.name.trim().toLowerCase()) ? { ...parsed.routine, status: 'open' as const } : undefined;
    await dayLogRepo.update(date, {
      briefMd: parsed.briefMd,
      affirmations: parsed.affirmations,
      quests: [...parsed.quests, ...log.quests.filter(isPeriodQuest)],
      stats: parsed.stats,
      warnings: [...parsed.warnings, ...log.warnings.filter(isPeriodWarning)],
      insights: parsed.insights,
      lessonMd: parsed.lessonMd || undefined,
      summaryMd: parsed.summaryMd || undefined,
      routineSuggestion: suggestion,
      extraSections: parsed.extraSections.length ? parsed.extraSections : undefined,
      rawDraft: undefined,
      repliedAt: nowIso(),
    });
    if (log.promptId) await promptRepo.attachReply(log.promptId, replyMd, true);
    const report = await applyNightStats(date);
    const unmatchedMeals = await mealRepo.applyEstimates(date, parsed.meals);

    const notes: string[] = [];
    if (unmatchedMeals.length) notes.push(`No logged meal called ${unmatchedMeals.join(' or ')}, so ${unmatchedMeals.length === 1 ? 'its numbers were' : 'their numbers were'} skipped.`);
    if (!parsed.quests.length) notes.push('No quests came with it.');
    if (report.unknown.length) notes.push(`No skill called ${report.unknown.join(' or ')}, so ${report.unknown.length === 1 ? 'that line was' : 'those lines were'} skipped.`);
    return { ok: true, message: [SAVED_MESSAGE, ...notes].join(' ') };
  });
}
