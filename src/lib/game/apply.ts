/**
 * Moving the pillars for a night.
 *
 * A night's effect is `routineStats` (scored by the app when the night closes) plus `stats`
 * (Claude's judgment calls from the reply). Both are applied together and stamped with
 * `statsAppliedAt`; anything that changes either list reverts first and applies again, so a
 * re-pasted reply or a routine ticked late never counts twice.
 *
 * Line kinds: "Body +2" moves all four Body sub-stats; "Body/Endurance +1" moves one; "Running
 * 62 -> 64" sets that skill to 64 (the level it replaced is stored as `from` so a revert can put it
 * back). Names that match nothing are ignored and reported.
 */
import { db } from '@/data/db';
import { gameRepo } from '@/data/repo';
import type { DayLog, StatDelta } from '@/data/types';
import { nowIso } from '@/lib/dates';
import { resolveTarget } from './daily';

export interface ApplyReport {
  /** Lines that moved a pillar, sub-stat or skill. Skill lines carry the real from/to. */
  applied: StatDelta[];
  /** Targets that matched no pillar, sub-stat or skill. They stay on the log and change nothing. */
  unknown: string[];
}

const SKILL_MIN = 1;
const SKILL_MAX = 100;

function clampSkill(n: number): number {
  return Math.round(Math.min(SKILL_MAX, Math.max(SKILL_MIN, n)) * 10) / 10;
}

function tables() {
  return [db.dayLogs, db.pillarState, db.subStatState, db.skills];
}

async function getLog(date: string): Promise<DayLog | undefined> {
  return db.dayLogs.where('date').equals(date).first();
}

/** Move points for a pillar or sub-stat line. Returns false for skill lines and zero deltas. */
async function movePoints(line: StatDelta, sign: 1 | -1): Promise<boolean> {
  if (typeof line.delta !== 'number' || !Number.isFinite(line.delta) || line.delta === 0) return false;
  const t = resolveTarget(line.target);
  if (t.kind === 'pillar') {
    await gameRepo.addPoints(t.pillar, undefined, sign * line.delta);
    return true;
  }
  if (t.kind === 'sub') {
    await gameRepo.addPoints(t.pillar, t.sub, sign * line.delta);
    return true;
  }
  return false;
}

async function applyLog(log: DayLog): Promise<ApplyReport> {
  const applied: StatDelta[] = [];
  const unknown: string[] = [];
  for (const line of log.routineStats ?? []) {
    if (await movePoints(line, 1)) applied.push(line);
  }

  const skills = new Map((await db.skills.toArray()).map((s) => [s.name.trim().toLowerCase(), s]));
  const now = nowIso();
  const stats: StatDelta[] = [];
  for (const line of log.stats) {
    const t = resolveTarget(line.target);
    if (t.kind !== 'other') {
      if (await movePoints(line, 1)) applied.push(line);
      stats.push(line);
      continue;
    }
    const key = t.name.toLowerCase();
    const skill = skills.get(key);
    const hasChange = typeof line.to === 'number' || typeof line.delta === 'number';
    if (!skill || !hasChange) {
      unknown.push(line.target);
      stats.push(line);
      continue;
    }
    const from = skill.level;
    const to = clampSkill(typeof line.to === 'number' ? line.to : from + (line.delta ?? 0));
    const next = { ...skill, level: to, lastAssessedAt: now, updatedAt: now };
    await db.skills.put(next);
    skills.set(key, next);
    stats.push({ ...line, from });
    applied.push({ target: skill.name, from, to });
  }

  await db.dayLogs.put({ ...log, stats, statsAppliedAt: now, updatedAt: now });
  return { applied, unknown };
}

async function revertLog(log: DayLog): Promise<void> {
  for (const line of log.routineStats ?? []) await movePoints(line, -1);
  const skills = new Map((await db.skills.toArray()).map((s) => [s.name.trim().toLowerCase(), s]));
  for (const line of log.stats) {
    const t = resolveTarget(line.target);
    if (t.kind !== 'other') {
      await movePoints(line, -1);
      continue;
    }
    const skill = skills.get(t.name.toLowerCase());
    if (!skill || typeof line.from !== 'number') continue;
    const setTo = clampSkill(typeof line.to === 'number' ? line.to : line.from + (line.delta ?? 0));
    // Someone (a skill ranking, an edit) has moved it since; leave their value alone.
    if (skill.level !== setTo) continue;
    await db.skills.put({ ...skill, level: line.from, updatedAt: nowIso() });
  }
  await db.dayLogs.put({ ...log, statsAppliedAt: undefined, updatedAt: nowIso() });
}

/**
 * Apply the night's routineStats + stats and stamp `statsAppliedAt`. If they were already applied
 * they are reverted first, so calling this twice never counts twice.
 */
export async function applyNightStats(date: string): Promise<ApplyReport> {
  return db.transaction('rw', tables(), async () => {
    let log = await getLog(date);
    if (!log) return { applied: [], unknown: [] };
    if (log.statsAppliedAt) {
      await revertLog(log);
      log = (await getLog(date)) ?? log;
    }
    return applyLog(log);
  });
}

/** Subtract exactly what `applyNightStats` added and clear `statsAppliedAt`. No-op if nothing is applied. */
export async function revertNightStats(date: string): Promise<void> {
  await db.transaction('rw', tables(), async () => {
    const log = await getLog(date);
    if (log?.statsAppliedAt) await revertLog(log);
  });
}
