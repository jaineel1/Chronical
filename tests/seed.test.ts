import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, gameRepo, profileRepo, resetAll, exportBackup, importBackup } from '@/data/repo';
import { DEMO_DAY, DEMO_REPLY_MD, seedDemo, startOwnGame } from '@/data/seed';
import { addDays, dayNumber, todayKey } from '@/lib/dates';
import { displayLevel } from '@/lib/game/level';

describe('data foundation', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('ensures a profile with the five pillars and twenty sub-stats', async () => {
    const p = await profileRepo.ensure('Test');
    expect(p.id).toBe('me');
    expect(await db.pillarState.count()).toBe(5);
    expect(await db.subStatState.count()).toBe(20);
  });

  it('derives pillar points from sub-stats', async () => {
    await profileRepo.ensure('Test');
    await gameRepo.addPoints('BODY', 'Endurance', 8);
    let pillars = await gameRepo.pillars();
    expect(pillars.BODY.points).toBeCloseTo(2, 6);
    await gameRepo.addPoints('BODY', undefined, 2);
    pillars = await gameRepo.pillars();
    expect(pillars.BODY.points).toBeCloseTo(4, 6);
    await gameRepo.addPoints('BODY', undefined, -100);
    pillars = await gameRepo.pillars();
    expect(pillars.BODY.points).toBe(0);
  });

  it('seeds the demo at Day 23 with a parsed reply for last night', async () => {
    await seedDemo();
    const p = await profileRepo.get();
    expect(p?.onboardedAt).toBeTruthy();
    expect(p?.settings.demo).toBe(true);
    expect(dayNumber(p!.startedAt, p!.settings.rolloverHour)).toBe(DEMO_DAY);
    const lastNight = await dayLogRepo.get(addDays(todayKey(), -1));
    expect(lastNight?.briefMd).toContain('Day 23');
    expect(lastNight?.quests).toHaveLength(3);
    expect(lastNight?.stats.find((s) => s.target === 'Work')?.delta).toBe(3);
    expect(DEMO_REPLY_MD).toContain('## BRIEF');
    const pillars = await gameRepo.pillars();
    expect(displayLevel(pillars.WORK.points)).toBeGreaterThan(displayLevel(pillars.DOPAMINE.points));
    expect(await db.routines.count()).toBe(8);
    expect(await db.people.count()).toBe(8);
  });

  it('round-trips a backup and can start over', async () => {
    await seedDemo();
    const backup = await exportBackup();
    await startOwnGame();
    expect(await db.routines.count()).toBe(0);
    expect((await profileRepo.get())?.onboardedAt).toBeUndefined();
    await importBackup(backup);
    expect(await db.routines.count()).toBe(8);
    expect((await profileRepo.get())?.settings.demo).toBe(true);
  });
});
