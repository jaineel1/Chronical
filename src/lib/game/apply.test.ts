import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, gameRepo, profileRepo, resetAll, stamp } from '@/data/repo';
import type { Skill, SubStatState } from '@/data/types';
import { applyNightStats, revertNightStats } from './apply';

const DATE = '2026-10-12';

async function sub(pillar: SubStatState['pillar'], name: string): Promise<number> {
  return (await db.subStatState.where('[pillar+name]').equals([pillar, name]).first())?.points ?? NaN;
}

async function snapshot() {
  const subs = await db.subStatState.toArray();
  const skills = await db.skills.toArray();
  return {
    subs: Object.fromEntries(subs.map((s) => [`${s.pillar}/${s.name}`, Math.round(s.points * 1000) / 1000])),
    skills: Object.fromEntries(skills.map((s) => [s.name, s.level])),
  };
}

describe('applyNightStats / revertNightStats', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
    for (const s of await db.subStatState.toArray()) await gameRepo.setSubStatPoints(s.pillar, s.name, 20);
    await db.skills.put(stamp<Skill>({ name: 'Running', pillar: 'BODY', level: 62, hours: 0, milestones: [], sortOrder: 0 }));
    await dayLogRepo.update(DATE, {
      routineStats: [
        { target: 'Body/Strength', delta: 3 },
        { target: 'Work/Focus', delta: -1.5 },
      ],
      stats: [
        { target: 'Body', delta: 2 },
        { target: 'Mind/Calm', delta: 1 },
        { target: 'Running', from: 62, to: 64 },
        { target: 'Swimming', from: 10, to: 12 },
        { target: 'Skin', delta: 0 },
      ],
    });
  });

  it('applies routine and reply lines, sets skills and stamps the log', async () => {
    const report = await applyNightStats(DATE);
    expect(await sub('BODY', 'Strength')).toBe(25); // +3 routine, +2 pillar
    expect(await sub('BODY', 'Endurance')).toBe(22);
    expect(await sub('WORK', 'Focus')).toBe(18.5);
    expect(await sub('MIND', 'Calm')).toBe(21);
    expect(await sub('SKIN', 'Routine')).toBe(20);
    const pillars = await gameRepo.pillars();
    expect(pillars.BODY.points).toBeCloseTo(22.75, 6);
    const running = await db.skills.where('pillar').equals('BODY').first();
    expect(running?.level).toBe(64);
    expect(running?.lastAssessedAt).toBeTruthy();
    expect(report.unknown).toEqual(['Swimming']);
    expect(report.applied.map((l) => l.target)).toEqual(['Body/Strength', 'Work/Focus', 'Body', 'Mind/Calm', 'Running']);
    const log = await dayLogRepo.get(DATE);
    expect(log?.statsAppliedAt).toBeTruthy();
    expect(log?.stats.find((s) => s.target === 'Running')).toEqual({ target: 'Running', from: 62, to: 64 });
  });

  it('reverts exactly, including the skill level it replaced', async () => {
    const before = await snapshot();
    // The app thinks Running is 63 even though Claude wrote 62 -> 64; the revert must restore 63.
    const running = (await db.skills.toArray())[0]!;
    await db.skills.put({ ...running, level: 63 });
    const base = await snapshot();
    await applyNightStats(DATE);
    expect((await db.skills.toArray())[0]?.level).toBe(64);
    await revertNightStats(DATE);
    expect(await snapshot()).toEqual(base);
    expect(before.subs).toEqual(base.subs);
    expect((await dayLogRepo.get(DATE))?.statsAppliedAt).toBeUndefined();
  });

  it('never counts a night twice', async () => {
    await applyNightStats(DATE);
    const once = await snapshot();
    await applyNightStats(DATE);
    expect(await snapshot()).toEqual(once);
    await revertNightStats(DATE);
    await revertNightStats(DATE);
    expect(await sub('BODY', 'Strength')).toBe(20);
  });

  it('re-pasting a reply is revert, save, apply', async () => {
    await applyNightStats(DATE);
    await revertNightStats(DATE);
    await dayLogRepo.update(DATE, { stats: [{ target: 'Body', delta: -1 }] });
    await applyNightStats(DATE);
    expect(await sub('BODY', 'Strength')).toBe(22); // 20 + 3 routine - 1 pillar
    expect(await sub('MIND', 'Calm')).toBe(20);
    expect((await db.skills.toArray())[0]?.level).toBe(62);
  });

  it('leaves a skill alone on revert if something else moved it since', async () => {
    await applyNightStats(DATE);
    const running = (await db.skills.toArray())[0]!;
    await db.skills.put({ ...running, level: 70 });
    await revertNightStats(DATE);
    expect((await db.skills.toArray())[0]?.level).toBe(70);
  });

  it('is a no-op for a day without a log', async () => {
    expect(await applyNightStats('2026-01-01')).toEqual({ applied: [], unknown: [] });
    await revertNightStats('2026-01-01');
  });
});
