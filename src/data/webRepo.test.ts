import { beforeEach, describe, expect, it } from 'vitest';
import { db } from './db';
import { resetAll, stamp } from './repo';
import type { Book, Goal, Person, Routine, Skill, WebNode } from './types';
import { circleFrom, webRepo } from './webRepo';

const D1 = '2026-10-18';
const D2 = '2026-10-19';

const NO_WEB = { nodes: [], links: [], summaries: [] };

async function nodeBy(label: string): Promise<WebNode | undefined> {
  return db.webNodes.filter((n) => n.label.toLowerCase() === label.toLowerCase()).first();
}

beforeEach(async () => {
  await resetAll();
});

describe('webRepo.applyWeb', () => {
  it('creates nodes with a dated fact and one mention', async () => {
    const r = await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'person', label: 'Riya', fact: 'lent her Maths notes' }] });
    expect(r.added).toEqual(['Riya']);
    const riya = await nodeBy('Riya');
    expect(riya).toMatchObject({ type: 'person', facts: [{ date: D1, text: 'lent her Maths notes' }], mentions: 1, firstSeen: D1, lastSeen: D1, importance: 2 });
  });

  it('upserts by type and label case-insensitively, dedupes facts on a date, and counts one mention a night', async () => {
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'person', label: 'Riya', fact: 'lent notes' }] });
    const again = await webRepo.applyWeb(D1, {
      ...NO_WEB,
      nodes: [
        { type: 'person', label: 'riya', fact: 'Lent notes' },
        { type: 'person', label: 'RIYA', fact: 'runs on Sundays' },
      ],
    });
    expect(again.added).toEqual([]);
    expect(again.updated).toEqual(['Riya']);
    await webRepo.applyWeb(D2, { ...NO_WEB, nodes: [{ type: 'person', label: 'Riya', fact: 'lent notes' }] });
    const riya = (await db.webNodes.toArray()).filter((n) => n.type === 'person');
    expect(riya).toHaveLength(1);
    expect(riya[0]!.facts.map((f) => `${f.date} ${f.text}`)).toEqual([`${D1} lent notes`, `${D1} runs on Sundays`, `${D2} lent notes`]);
    expect(riya[0]!.mentions).toBe(2);
    expect(riya[0]!.lastSeen).toBe(D2);
  });

  it('keeps the same label of another type as its own node', async () => {
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'place', label: 'Library', fact: 'quiet' }, { type: 'habit', label: 'Library', fact: 'every evening' }] });
    expect(await db.webNodes.count()).toBe(2);
  });

  it('rewrites summaries, and reports labels it cannot find', async () => {
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'goal', label: 'Sub-4 marathon', fact: '22 km long run' }] });
    const r = await webRepo.applyWeb(D2, { ...NO_WEB, summaries: [{ label: 'sub-4 Marathon', summary: '11 weeks out, long run at 22 km' }, { label: 'Ghost', summary: 'x' }] });
    expect(r.unmatched).toEqual(['Ghost']);
    expect(r.updated).toEqual(['Sub-4 marathon']);
    expect((await nodeBy('Sub-4 marathon'))?.summaryMd).toBe('11 weeks out, long run at 22 km');
    expect(await db.webNodes.count()).toBe(1);
  });

  it('upserts links by (from, to), makes topics for unknown ends, and adds weight once per new night', async () => {
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'person', label: 'Riya', fact: 'x' }] });
    const first = await webRepo.applyWeb(D1, { ...NO_WEB, links: [{ from: 'riya', to: 'Running', relation: 'runs with', note: 'Sundays' }] });
    expect(first.createdTopics).toEqual(['Running']);
    expect(first.links).toEqual(['Riya -> Running']);
    expect((await nodeBy('Running'))?.type).toBe('topic');
    await webRepo.applyWeb(D1, { ...NO_WEB, links: [{ from: 'Riya', to: 'Running', relation: 'runs with' }] });
    expect((await db.webEdges.toArray())[0]).toMatchObject({ weight: 1, note: 'Sundays' });
    await webRepo.applyWeb(D2, { ...NO_WEB, links: [{ from: 'Riya', to: 'Running', relation: 'trains with' }] });
    const edges = await db.webEdges.toArray();
    expect(edges).toHaveLength(1);
    expect(edges[0]).toMatchObject({ relation: 'trains with', weight: 2, firstSeen: D1, lastSeen: D2 });
    // The reverse direction is its own edge.
    await webRepo.applyWeb(D2, { ...NO_WEB, links: [{ from: 'Running', to: 'Riya', relation: 'brought them together' }] });
    expect(await db.webEdges.count()).toBe(2);
  });

  it('gives a new person node the refId of the Person with that name', async () => {
    const p = stamp<Person>({ name: 'Mentor', circle: 'close', closeness: 4, wantCloser: true, contactEveryDays: 14 });
    await db.people.put(p);
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'person', label: 'mentor', fact: 'replied' }] });
    expect(await nodeBy('Mentor')).toMatchObject({ refId: p.id, label: 'Mentor' });
  });

  it('writes nothing for an empty update and never deletes', async () => {
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'topic', label: 'A', fact: 'x' }] });
    const r = await webRepo.applyWeb(D2, NO_WEB);
    expect(r).toEqual({ added: [], updated: [], createdTopics: [], links: [], unmatched: [] });
    expect(await db.webNodes.count()).toBe(1);
  });
});

describe('webRepo.applyPeople', () => {
  it('creates new people with the defaults, a contact for the day and a mirrored node', async () => {
    const r = await webRepo.applyPeople(D1, [
      { name: 'Riya', circle: 'college', note: 'lent her notes' },
      { name: 'Dev', circle: 'acquaintance', note: 'met at the gym' },
    ]);
    expect(r.added).toEqual(['Riya', 'Dev']);
    const people = await db.people.toArray();
    const riya = people.find((p) => p.name === 'Riya')!;
    const dev = people.find((p) => p.name === 'Dev')!;
    expect(riya).toMatchObject({ circle: 'college', closeness: 2, wantCloser: false, contactEveryDays: 14, lastContact: D1 });
    expect(dev.circle).toBe('other');
    const contacts = await db.contacts.where('personId').equals(riya.id).toArray();
    expect(contacts).toMatchObject([{ date: D1, kind: 'other', note: 'lent her notes' }]);
    const node = await nodeBy('Riya');
    expect(node).toMatchObject({ type: 'person', refId: riya.id, mentions: 1, facts: [{ date: D1, text: 'lent her notes' }] });
  });

  it('matches existing people by name, moves lastContact forward, and is safe to re-paste', async () => {
    const p = stamp<Person>({ name: 'Mentor', circle: 'close', closeness: 4, wantCloser: true, contactEveryDays: 14, lastContact: '2026-09-30' });
    await db.people.put(p);
    const r = await webRepo.applyPeople(D1, [{ name: 'mentor', circle: 'family', note: 'finally replied' }]);
    expect(r).toEqual({ added: [], updated: ['Mentor'] });
    await webRepo.applyPeople(D1, [{ name: 'Mentor', note: 'finally replied' }]);
    expect(await db.people.count()).toBe(1);
    expect(await db.people.get(p.id)).toMatchObject({ circle: 'close', closeness: 4, lastContact: D1 });
    expect(await db.contacts.count()).toBe(1);
    expect(await db.webNodes.count()).toBe(1);
    expect((await nodeBy('Mentor'))?.mentions).toBe(1);
  });

  it('adopts an existing person node without a refId instead of making a second one', async () => {
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'person', label: 'Riya', fact: 'x' }] });
    await webRepo.applyPeople(D1, [{ name: 'Riya', note: 'y' }]);
    const nodes = await db.webNodes.toArray();
    expect(nodes).toHaveLength(1);
    expect(nodes[0]!.refId).toBe((await db.people.toArray())[0]!.id);
    expect(nodes[0]!.mentions).toBe(1);
  });
});

describe('webRepo.linkExisting', () => {
  it('makes a node for every current goal, active routine, book being read, skill and person', async () => {
    const goal = stamp<Goal>({ pillar: 'BODY', title: 'Sub-4 marathon', why: 'prove it', status: 'active' });
    const paused = stamp<Goal>({ pillar: 'MIND', title: 'Old goal', why: '', status: 'paused' });
    const routine = stamp<Routine>({ name: 'Gym', pillar: 'BODY', subStat: 'Strength', weight: 3, days: [], upside: '', cost: '', streak: 0, shields: 1, archived: false, sortOrder: 0 });
    const archived = stamp<Routine>({ ...routine, id: 'arch', name: 'Archived', archived: true });
    const book = stamp<Book>({ title: 'Deep Work', author: 'Cal Newport', status: 'reading' });
    const done = stamp<Book>({ title: 'Finished', status: 'done' });
    const skill = stamp<Skill>({ name: 'Running', pillar: 'BODY', level: 62, hours: 10, milestones: [], sortOrder: 0 });
    const person = stamp<Person>({ name: 'Mentor', circle: 'close', closeness: 4, wantCloser: true, contactEveryDays: 14 });
    await db.goals.bulkPut([goal, paused]);
    await db.routines.bulkPut([routine, archived]);
    await db.books.bulkPut([book, done]);
    await db.skills.put(skill);
    await db.people.put(person);
    // A node Claude made earlier for the goal is adopted, not duplicated.
    await webRepo.applyWeb(D1, { ...NO_WEB, nodes: [{ type: 'goal', label: 'sub-4 marathon', fact: '22 km' }] });

    const r = await webRepo.linkExisting(D1);
    expect(r).toEqual({ created: 4, updated: 1 });
    const nodes = await db.webNodes.toArray();
    expect(nodes.map((n) => `${n.type}:${n.label}:${n.refId}`).sort()).toEqual(
      [`book:Deep Work:${book.id}`, `goal:Sub-4 marathon:${goal.id}`, `person:Mentor:${person.id}`, `routine:Gym:${routine.id}`, `skill:Running:${skill.id}`].sort(),
    );
    expect(nodes.find((n) => n.refId === goal.id)?.facts).toHaveLength(1);
    expect(nodes.find((n) => n.refId === book.id)?.summaryMd).toBe('Reading now, by Cal Newport.');

    expect(await webRepo.linkExisting(D1)).toEqual({ created: 0, updated: 0 });
    await db.routines.put({ ...routine, name: 'Gym, upper body' });
    expect(await webRepo.linkExisting(D2)).toEqual({ created: 0, updated: 1 });
    expect((await db.webNodes.filter((n) => n.refId === routine.id).first())?.label).toBe('Gym, upper body');
  });
});

describe('circleFrom', () => {
  it('keeps the app circles and maps the rest', () => {
    expect(circleFrom('College')).toBe('college');
    expect(circleFrom('friend')).toBe('close');
    expect(circleFrom('acquaintance')).toBe('other');
    expect(circleFrom('work')).toBe('other');
    expect(circleFrom(undefined)).toBe('other');
  });
});
