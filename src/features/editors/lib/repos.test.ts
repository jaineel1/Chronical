import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/data/db';
import { resetAll } from '@/data/repo';
import { seedDemo, type DemoIds } from '@/data/seed';
import { goalRepo, personRepo, routineOrderRepo, skillRepo } from './repos';

describe('world repositories', () => {
  let ids: DemoIds;
  beforeEach(async () => {
    await resetAll();
    ids = await seedDemo();
  });

  it('moves a routine and renumbers the active list', async () => {
    const gym = ids.routines.gym!;
    await routineOrderRepo.move(gym, 1);
    const active = (await db.routines.filter((r) => !r.archived).toArray()).sort((a, b) => a.sortOrder - b.sortOrder);
    expect(active.map((r) => r.sortOrder)).toEqual(active.map((_, i) => i));
    expect(active[1]!.id).toBe(gym);
    await routineOrderRepo.move(active[0]!.id, -1); // already first: no-op
    expect((await db.routines.get(active[0]!.id))?.sortOrder).toBe(0);
  });

  it('archives and restores a routine to the end of the list', async () => {
    const gym = ids.routines.gym!;
    await routineOrderRepo.archive(gym);
    expect((await db.routines.get(gym))?.archived).toBe(true);
    await routineOrderRepo.restore(gym);
    const r = await db.routines.get(gym);
    expect(r?.archived).toBe(false);
    expect(r?.sortOrder).toBe(8);
  });

  it('saves a goal with milestone and vision diffs', async () => {
    const goalId = ids.goals.marathon!;
    const ms = await db.milestones.where('goalId').equals(goalId).toArray();
    const keep = ms[0]!;
    const goal = (await db.goals.get(goalId))!;
    await goalRepo.save(
      { id: goalId, pillar: goal.pillar, title: 'Sub-4 marathon, Mumbai', why: goal.why, status: 'active', targetDate: goal.targetDate },
      [{ ...keep, current: 118 }, { title: 'Taper week', metricName: undefined, target: undefined, current: undefined, unit: undefined, dueDate: undefined, doneAt: undefined }],
      [],
    );
    const after = await db.milestones.where('goalId').equals(goalId).toArray();
    expect(after).toHaveLength(2);
    expect(after.find((m) => m.id === keep.id)?.current).toBe(118);
    expect(after.some((m) => m.title === 'Taper week')).toBe(true);
    expect(await db.visionItems.where('goalId').equals(goalId).count()).toBe(0);
    expect((await db.goals.get(goalId))?.title).toBe('Sub-4 marathon, Mumbai');
  });

  it('creates a new goal and removes it, unlinking routines', async () => {
    const g = await goalRepo.save({ pillar: 'MIND', title: 'Meditate', why: 'Calm', status: 'active' }, [{ title: 'Ten days', target: 10, current: 0, unit: 'days' }], [
      { title: 'Calm mornings', gives: 'Room to think', habitCost: 'Ten minutes a day' },
    ]);
    expect(await db.milestones.where('goalId').equals(g.id).count()).toBe(1);
    expect(await db.visionItems.where('goalId').equals(g.id).count()).toBe(1);
    const squat = ids.goals.squat!;
    await goalRepo.remove(squat);
    expect(await db.goals.get(squat)).toBeUndefined();
    expect(await db.milestones.where('goalId').equals(squat).count()).toBe(0);
    expect((await db.routines.get(ids.routines.gym!))?.goalId).toBeUndefined();
  });

  it('logs skill hours at +0.1 level per hour', async () => {
    const s = await skillRepo.logHours(ids.skills.running!, 3);
    expect(s?.hours).toBe(215);
    expect(s?.level).toBe(62.3);
  });

  it('logs a contact, moves lastContact, and falls back when it is removed', async () => {
    const mentor = ids.people.mentor!;
    const before = (await db.people.get(mentor))!.lastContact;
    const c = await personRepo.logContact(mentor, 'call', '2026-12-01', '  coffee ');
    expect(c.note).toBe('coffee');
    expect((await db.people.get(mentor))?.lastContact).toBe('2026-12-01');
    await personRepo.removeContact(c.id);
    expect((await db.people.get(mentor))?.lastContact).toBe(before);
  });

  it('removes a skill with its achievements', async () => {
    const running = ids.skills.running!;
    await skillRepo.remove(running);
    expect(await db.skills.get(running)).toBeUndefined();
    expect(await db.achievements.where('skillId').equals(running).count()).toBe(0);
  });
});
