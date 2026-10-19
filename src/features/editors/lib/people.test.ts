import { describe, expect, it } from 'vitest';
import type { Person } from '@/data/types';
import { daysQuiet, mostOverdue, overdueBy, personMeta, personTone, quietNote, sortForTree, treeMeta } from './people';

const TODAY = '2026-10-19';

function person(name: string, daysAgo: number | null, extra: Partial<Person> = {}): Person {
  const d = new Date(2026, 9, 19 - (daysAgo ?? 0), 12);
  const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return {
    id: name,
    createdAt: '2026-09-01T12:00:00.000Z',
    updatedAt: '2026-09-01T12:00:00.000Z',
    name,
    circle: 'close',
    closeness: 3,
    wantCloser: false,
    contactEveryDays: 7,
    lastContact: daysAgo === null ? undefined : key,
    ...extra,
  };
}

describe('person tone', () => {
  it('follows the 7 / 14 day thresholds', () => {
    expect(personTone(0)).toBe('ink');
    expect(personTone(7)).toBe('ink');
    expect(personTone(8)).toBe('mid');
    expect(personTone(14)).toBe('mid');
    expect(personTone(15)).toBe('red');
    expect(personTone(null)).toBe('faint');
  });
  it('counts days from a day key or an ISO timestamp, never negative', () => {
    expect(daysQuiet({ lastContact: '2026-10-18' }, TODAY)).toBe(1);
    expect(daysQuiet({ lastContact: '2026-10-03T12:00:00.000Z' }, TODAY)).toBe(16);
    expect(daysQuiet({ lastContact: '2026-10-25' }, TODAY)).toBe(0);
    expect(daysQuiet({ lastContact: undefined }, TODAY)).toBeNull();
    expect(daysQuiet({ lastContact: 'not a date' }, TODAY)).toBeNull();
  });
  it('writes the second line of a node', () => {
    expect(personMeta(person('Mom', 1, { circle: 'family' }), TODAY)).toBe('1 day, family');
    expect(personMeta(person('Crew', 12, { circle: 'college' }), TODAY)).toBe('12 days, college');
    expect(personMeta(person('Mentor', 21, { circle: 'other' }), TODAY)).toBe('21 days, fading');
    expect(personMeta(person('New', null, { circle: 'gym' }), TODAY)).toBe('never, gym');
  });
});

describe('tree order and summary', () => {
  it('sorts by days quiet, never-contacted last, stable on ties', () => {
    const people = [person('Mentor', 21), person('New', null), person('Mom', 1), person('Dad', 2), person('Co-founder', 1)];
    expect(sortForTree(people, TODAY).map((p) => p.name)).toEqual(['Mom', 'Co-founder', 'Dad', 'Mentor', 'New']);
  });
  it('counts branches and fading ones', () => {
    expect(treeMeta([person('a', 1), person('b', 16), person('c', 21), person('d', null)], TODAY)).toBe('4 branches, 2 fading');
    expect(treeMeta([person('a', 1)], TODAY)).toBe('1 branch, 0 fading');
  });
});

describe('reach out today', () => {
  const demo = [
    person('Mom', 1, { contactEveryDays: 2 }),
    person('Dad', 2, { contactEveryDays: 3 }),
    person('Co-founder', 1, { contactEveryDays: 1 }),
    person('Aarav', 4, { contactEveryDays: 5, wantCloser: true }),
    person('Gym buddy', 9, { contactEveryDays: 7 }),
    person('College crew', 12, { contactEveryDays: 10, wantCloser: true }),
    person('Retail client', 16, { contactEveryDays: 10 }),
    person('Mentor', 21, { contactEveryDays: 14, wantCloser: true }),
  ];
  it('picks the most overdue person', () => {
    expect(overdueBy(demo[7]!, TODAY)).toBe(7);
    expect(mostOverdue(demo, TODAY)?.name).toBe('Mentor');
  });
  it('moves on once that person is contacted', () => {
    const after = demo.map((p) => (p.name === 'Mentor' ? { ...p, lastContact: TODAY } : p));
    expect(mostOverdue(after, TODAY)?.name).toBe('Retail client');
  });
  it('breaks ties in favour of people the player wants closer', () => {
    const tie = [person('Gym buddy', 9, { contactEveryDays: 7 }), person('College crew', 12, { contactEveryDays: 10, wantCloser: true })];
    expect(mostOverdue(tie, TODAY)?.name).toBe('College crew');
    expect(mostOverdue([...tie].reverse(), TODAY)?.name).toBe('College crew');
  });
  it('counts never-contacted people from the day they were added', () => {
    const fresh = person('New', null, { createdAt: '2026-10-09T12:00:00.000Z', contactEveryDays: 7 });
    expect(overdueBy(fresh, TODAY)).toBe(3);
    expect(quietNote(fresh, TODAY)).toBe('never contacted');
  });
  it('writes the section note', () => {
    expect(quietNote(demo[7]!, TODAY)).toBe('21 days quiet');
    expect(quietNote(person('Dad', 1, { contactEveryDays: 4 }), TODAY)).toBe('due in 3 days');
    expect(mostOverdue([], TODAY)).toBeUndefined();
  });
});
