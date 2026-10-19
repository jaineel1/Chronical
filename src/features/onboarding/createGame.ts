/**
 * Writes that turn an accepted origin reply into a game. Not a screen: it uses `db` directly with
 * `stamp<T>` so the whole Day 0 lands in one transaction (all or nothing).
 */
import { db } from '@/data/db';
import { dayLogRepo, profileRepo, promptRepo, stamp } from '@/data/repo';
import type { Assessment, Goal, Prompt, Routine, Skill } from '@/data/types';
import { addDays, nowIso, todayKey, weekKey } from '@/lib/dates';
import { compileOriginSheet } from '@/lib/compile/originSheet';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import type { OriginGoal, OriginRoutine, OriginSkill } from '@/lib/parse/origin';
import type { Answers } from './questions';

export interface Accepted {
  skills: OriginSkill[];
  routines: OriginRoutine[];
  goals: OriginGoal[];
}

export interface AddedCounts {
  skills: number;
  routines: number;
  goals: number;
}

const GAME_TABLES = () => [db.profile, db.pillarState, db.subStatState, db.routines, db.skills, db.assessments, db.goals, db.dayLogs];

async function nextSortOrder(table: 'routines' | 'skills'): Promise<number> {
  const last = await db.table(table).orderBy('sortOrder').last();
  return last ? (last as { sortOrder: number }).sortOrder + 1 : 0;
}

/**
 * Create the accepted skills (with Claude's first assessment), routines and goals. Sort order
 * continues after anything that already exists, so the Vault can add suggestions to a live game.
 */
export async function addSuggestions(accepted: Accepted, opts: { promptId?: string; rolloverHour?: number } = {}): Promise<AddedCounts> {
  const now = nowIso();
  const week = weekKey(todayKey(opts.rolloverHour));
  let skillOrder = await nextSortOrder('skills');
  let routineOrder = await nextSortOrder('routines');

  for (const s of accepted.skills) {
    const skill = stamp<Skill>({ name: s.name.trim(), pillar: s.pillar, level: s.level, hours: 0, milestones: [], lastAssessedAt: now, sortOrder: skillOrder++ });
    await db.skills.put(skill);
    await db.assessments.put(stamp<Assessment>({ skillId: skill.id, level: s.level, reasoning: s.why, promptId: opts.promptId }));
  }
  for (const r of accepted.routines) {
    await db.routines.put(
      stamp<Routine>({
        name: r.name.trim(),
        pillar: r.pillar,
        subStat: r.subStat,
        weight: r.weight,
        days: [...r.days],
        window: r.window,
        upside: r.upside,
        cost: r.cost,
        streak: 0,
        shields: 1,
        shieldWeek: week,
        archived: false,
        sortOrder: routineOrder++,
      }),
    );
  }
  for (const g of accepted.goals) {
    await db.goals.put(stamp<Goal>({ pillar: g.pillar, title: g.title.trim(), why: g.why, targetDate: g.targetDate, status: 'active' }));
  }
  return { skills: accepted.skills.length, routines: accepted.routines.length, goals: accepted.goals.length };
}

export interface CreateGameInput {
  accepted: Accepted;
  stateOfMeMd: string;
  briefMd: string;
  affirmations: string[];
  originSheetMd: string;
  promptId?: string;
}

export interface CreatedGame extends AddedCounts {
  /** Day key of the DayLog that holds the first letter (yesterday). */
  letterDate: string;
}

/**
 * Day 0 → Day 1: rows for everything accepted, the State of Me and Origin Sheet on the profile,
 * the first letter on yesterday's DayLog (the Morning screen shows the latest log with a brief),
 * and `onboardedAt` / `startedAt` set to now.
 */
export async function createGame(input: CreateGameInput): Promise<CreatedGame> {
  return db.transaction('rw', GAME_TABLES(), async () => {
    const profile = await profileRepo.ensure();
    const rollover = profile.settings.rolloverHour;
    const now = nowIso();
    const counts = await addSuggestions(input.accepted, { promptId: input.promptId, rolloverHour: rollover });
    const letterDate = addDays(todayKey(rollover), -1);
    await dayLogRepo.update(letterDate, {
      briefMd: input.briefMd,
      affirmations: [...input.affirmations],
      promptId: input.promptId,
      repliedAt: now,
      quests: [],
      stats: [],
    });
    await profileRepo.update({
      stateOfMeMd: input.stateOfMeMd,
      stateOfMeAt: now,
      originSheetMd: input.originSheetMd,
      onboardedAt: now,
      startedAt: now,
    });
    return { ...counts, letterDate };
  });
}

/** "Skip Claude for now": keep the compiled sheet, start the game without a letter. */
export async function startWithoutClaude(originSheetMd: string): Promise<void> {
  const now = nowIso();
  await profileRepo.update({ originSheetMd, onboardedAt: now, startedAt: now });
}

/** Re-compile the sheet from the stored answers with the current money setting (Vault edits, money toggle). */
export async function recompileOriginSheet(answers?: Answers): Promise<string | undefined> {
  const profile = await profileRepo.ensure();
  const source = answers ?? profile.onboardingAnswers;
  if (!source || Object.keys(source).length === 0) return undefined;
  const md = compileOriginSheet(source, { excludeMoney: profile.settings.excludeMoney, displayName: profile.displayName });
  await profileRepo.update({ originSheetMd: md });
  return md;
}

/**
 * The origin prompt row for this exact text: reuse an unanswered one (copying twice, or after a
 * reload, must not fill the Archive with duplicates), else create it.
 */
export async function recordOriginPrompt(promptMd: string): Promise<Prompt> {
  const existing = await db.prompts
    .where('kind')
    .equals('origin')
    .filter((p) => !p.replyMd && p.promptMd === promptMd)
    .first();
  if (existing) return existing;
  return promptRepo.create('origin', MODEL_LABEL.origin, promptMd, 'origin');
}

/** The most recent origin prompt whose reply parsed, to rebuild the review after a reload. */
export async function latestParsedOrigin(): Promise<Prompt | undefined> {
  const rows = await db.prompts.where('kind').equals('origin').toArray();
  return rows.filter((p) => p.replyMd && p.parsedOk).sort((a, b) => (a.repliedAt ?? '').localeCompare(b.repliedAt ?? '')).pop();
}
