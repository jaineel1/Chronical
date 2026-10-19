import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { dayLogRepo, patch, profileRepo, resetAll, routineLogRepo, routineRepo } from '@/data/repo';

/**
 * Screens save fields independently (a debounced name, a toggle, a number tile), so two writes to
 * the same row can be in flight at once. Every read-modify-write must keep both changes.
 */
describe('repositories under concurrent writes', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Test');
  });

  it('dayLogRepo.update on a new day keeps every change in one row', async () => {
    const date = '2026-10-18';
    await Promise.all([dayLogRepo.update(date, { mood: 3 }), dayLogRepo.update(date, { energy: 4 }), dayLogRepo.update(date, { sleepHours: 7 })]);
    const rows = await db.dayLogs.where('date').equals(date).toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ mood: 3, energy: 4, sleepHours: 7 });
  });

  it('dayLogRepo.update on an existing day keeps both changes', async () => {
    const date = '2026-10-18';
    await dayLogRepo.ensure(date);
    await Promise.all([dayLogRepo.update(date, { mood: 2 }), dayLogRepo.update(date, { feltLine: 'Steady.' })]);
    expect(await dayLogRepo.get(date)).toMatchObject({ mood: 2, feltLine: 'Steady.' });
  });

  it('dayLogRepo.ensure twice at once creates one row', async () => {
    const [a, b] = await Promise.all([dayLogRepo.ensure('2026-10-19'), dayLogRepo.ensure('2026-10-19')]);
    expect(a.id).toBe(b.id);
    expect(await db.dayLogs.count()).toBe(1);
  });

  it('profileRepo.update and updateSettings at once keep both changes', async () => {
    await Promise.all([profileRepo.update({ displayName: 'Riya' }), profileRepo.updateSettings({ deepMode: true }), profileRepo.updateSettings({ excludeMoney: true })]);
    const p = await profileRepo.get();
    expect(p?.displayName).toBe('Riya');
    expect(p?.settings.deepMode).toBe(true);
    expect(p?.settings.excludeMoney).toBe(true);
  });

  it('patch keeps two changes to one row made at once', async () => {
    const r = await routineRepo.create({
      name: 'Gym',
      pillar: 'BODY',
      subStat: 'Strength',
      weight: 3,
      days: [],
      upside: 'legs',
      cost: 'days',
      streak: 0,
      shields: 1,
      archived: false,
      sortOrder: 0,
    });
    await Promise.all([patch(db.routines, r.id, { name: 'Gym, legs' }), patch(db.routines, r.id, { weight: 4 })]);
    expect(await db.routines.get(r.id)).toMatchObject({ name: 'Gym, legs', weight: 4 });
  });

  it('routineLogRepo.set twice at once writes one log for the day', async () => {
    await Promise.all([routineLogRepo.set('r1', '2026-10-18', true), routineLogRepo.set('r1', '2026-10-18', true)]);
    expect(await db.routineLogs.where('[routineId+date]').equals(['r1', '2026-10-18']).count()).toBe(1);
  });
});
