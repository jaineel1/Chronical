import { describe, expect, it } from 'vitest';
import { DEMO_REPLY_MD } from '@/data/seed';
import { parseNightlyReply, parsePersonLine, parsePlanLine, parseTimeRange } from './reply';

const BRIEF = '## BRIEF\nDay 23. You ran 8 km.\n\n';

const V2 = `${BRIEF}## RIGHT
- 8 km run at 5:52, the 15th day of the streak.
- Two hours of deep work before 11.

## BETTER
- Lights out by 23:00; tonight was 00:40.
- Phone in the drawer at 21:30.

## FOOD
- good: 120 g protein, 20 short of the target
- better: water 1.8 L of 3 L; two bottles before lunch

## RANT
The project is not a mess because of you.

Write the one message that unblocks it, and send it before 10.

## PEOPLE
- Riya | college | sat with you in Maths and lent her notes
- Mentor | close | you finally replied
- Dev | acquaintance | met at the gym

## WEB
- node: Person | Riya | lent you her Maths notes
- link: Riya -> Sub-4 marathon | runs with | Sunday long runs
- summary: Sub-4 marathon | 22 of 30 km long run done, 11 weeks out

## PLAN
- 06:30-07:00 | Easy 5 km | Body
- 09:00-11:00 | Deep work on invoicing | Work
- 21:30-22:00 | Phone in the drawer, read 20 pages | Dopamine
`;

describe('the v2 sections', () => {
  const r = parseNightlyReply(V2);

  it('reads RIGHT and BETTER', () => {
    expect(r.ok).toBe(true);
    expect(r.right).toEqual(['8 km run at 5:52, the 15th day of the streak.', 'Two hours of deep work before 11.']);
    expect(r.better).toEqual(['Lights out by 23:00; tonight was 00:40.', 'Phone in the drawer at 21:30.']);
  });

  it('reads FOOD good and better lines', () => {
    expect(r.food).toEqual({ good: ['120 g protein, 20 short of the target'], better: ['water 1.8 L of 3 L; two bottles before lunch'] });
    expect(r.meals).toEqual([]);
  });

  it('keeps the RANT paragraphs', () => {
    expect(r.rantMd).toBe('The project is not a mess because of you.\n\nWrite the one message that unblocks it, and send it before 10.');
  });

  it('reads PEOPLE with their circle as written', () => {
    expect(r.people).toEqual([
      { name: 'Riya', circle: 'college', note: 'sat with you in Maths and lent her notes' },
      { name: 'Mentor', circle: 'close', note: 'you finally replied' },
      { name: 'Dev', circle: 'acquaintance', note: 'met at the gym' },
    ]);
  });

  it('reads WEB nodes, links and summaries', () => {
    expect(r.web).toEqual({
      nodes: [{ type: 'person', label: 'Riya', fact: 'lent you her Maths notes' }],
      links: [{ from: 'Riya', to: 'Sub-4 marathon', relation: 'runs with', note: 'Sunday long runs' }],
      summaries: [{ label: 'Sub-4 marathon', summary: '22 of 30 km long run done, 11 weeks out' }],
    });
  });

  it('reads PLAN blocks in order with their pillars', () => {
    expect(r.plan).toEqual([
      { start: '06:30', end: '07:00', text: 'Easy 5 km', pillar: 'BODY' },
      { start: '09:00', end: '11:00', text: 'Deep work on invoicing', pillar: 'WORK' },
      { start: '21:30', end: '22:00', text: 'Phone in the drawer, read 20 pages', pillar: 'DOPAMINE' },
    ]);
    expect(r.errors.filter((e) => /PLAN|WEB|PEOPLE|FOOD/.test(e))).toEqual([]);
  });

  it('keeps none of them as extra sections', () => {
    expect(r.extraSections).toEqual([]);
  });
});

describe('aliases', () => {
  it.each([
    ['WENT_RIGHT', 'right'],
    ['Wins', 'right'],
    ['DO_BETTER', 'better'],
    ['Improve', 'better'],
  ] as const)('## %s is read as %s', (header, field) => {
    expect(parseNightlyReply(`${BRIEF}## ${header}\n- one line`)[field]).toEqual(['one line']);
  });

  it('INTAKE and NUTRITION_NOTES are FOOD; NUTRITION and MEALS are still meals', () => {
    expect(parseNightlyReply(`${BRIEF}## INTAKE\n- good: protein`).food.good).toEqual(['protein']);
    expect(parseNightlyReply(`${BRIEF}## NUTRITION_NOTES\n- better: water`).food.better).toEqual(['water']);
    expect(parseNightlyReply(`${BRIEF}## NUTRITION\n- Lunch | Dal rice | 600 kcal`).meals).toEqual([{ slot: 'lunch', name: 'Dal rice', kcal: 600 }]);
    expect(parseNightlyReply(`${BRIEF}## NUTRITION\n- Lunch | Dal rice | 600 kcal`).food).toEqual({ good: [], better: [] });
  });

  it('meal rows under ## FOOD still fill the meals, as before v2', () => {
    const r = parseNightlyReply(`${BRIEF}## FOOD\n- Lunch | Dal rice | 400 g | 600 kcal\n- good: protein held`);
    expect(r.meals).toEqual([{ slot: 'lunch', name: 'Dal rice', grams: 400, kcal: 600 }]);
    expect(r.food.good).toEqual(['protein held']);
  });

  it('RANT_REPLY, PERSONS, MIND_WEB, GRAPH, TOMORROW and SCHEDULE', () => {
    expect(parseNightlyReply(`${BRIEF}## RANT_REPLY\nIt is fair.`).rantMd).toBe('It is fair.');
    expect(parseNightlyReply(`${BRIEF}## PERSONS\n- Riya | college | notes`).people).toHaveLength(1);
    expect(parseNightlyReply(`${BRIEF}## MIND WEB\n- node: place | Library | quiet floor`).web.nodes).toHaveLength(1);
    expect(parseNightlyReply(`${BRIEF}## GRAPH\n- node: place | Library | quiet floor`).web.nodes).toHaveLength(1);
    expect(parseNightlyReply(`${BRIEF}## TOMORROW\n- 06:30-07:00 | Run | Body`).plan).toHaveLength(1);
    expect(parseNightlyReply(`${BRIEF}## Schedule\n- 06:30-07:00 | Run | Body`).plan).toHaveLength(1);
  });
});

describe('"- None" and forgiving lines', () => {
  it('gives empty results for None everywhere', () => {
    const r = parseNightlyReply(`${BRIEF}## RIGHT\n- None\n## BETTER\n- None\n## FOOD\n- None\n## RANT\n- None\n## PEOPLE\n- None\n## WEB\n- None\n## PLAN\n- None`);
    expect(r.right).toEqual([]);
    expect(r.better).toEqual([]);
    expect(r.food).toEqual({ good: [], better: [] });
    expect(r.rantMd).toBe('');
    expect(r.people).toEqual([]);
    expect(r.web).toEqual({ nodes: [], links: [], summaries: [] });
    expect(r.plan).toEqual([]);
    expect(r.errors).toEqual(['No ## AFFIRMATIONS section.', 'No ## QUESTS section.', 'No ## STATS section.', 'No ## LESSON section.']);
  });

  it('reads FOOD under Good: and Better: sub-headers, and flags a line that is neither', () => {
    const r = parseNightlyReply(`${BRIEF}## FOOD\n**Good:**\n- protein 120 g\nBetter:\n- water 1.8 L\n## X\n`);
    expect(r.food).toEqual({ good: ['protein 120 g'], better: ['water 1.8 L'] });
    const loose = parseNightlyReply(`${BRIEF}## FOOD\n- ate well`);
    expect(loose.food).toEqual({ good: [], better: [] });
    expect(loose.errors.some((e) => e.includes('neither good nor better'))).toBe(true);
  });

  it('reads WEB lines without a prefix, arrows, and unknown types as topics', () => {
    const r = parseNightlyReply(`${BRIEF}## WEB\n- Person | Riya | lent notes\n- Riya → Maths | studies with\n- node: Hobby | Chess | played twice\n- what is this`);
    expect(r.web.nodes).toEqual([
      { type: 'person', label: 'Riya', fact: 'lent notes' },
      { type: 'topic', label: 'Chess', fact: 'played twice' },
    ]);
    expect(r.web.links).toEqual([{ from: 'Riya', to: 'Maths', relation: 'studies with', note: undefined }]);
    expect(r.errors.some((e) => e.includes('"Hobby" is not a web node type'))).toBe(true);
    expect(r.errors.some((e) => e.includes('Could not read a WEB line: "what is this"'))).toBe(true);
  });

  it('skips unreadable PLAN lines with a note and sorts the rest', () => {
    const r = parseNightlyReply(`${BRIEF}## PLAN\nTomorrow:\n- 18:00 to 19:00 | Gym | Body\n- sometime | Read\n- 7am-7:30am | Skincare | Skin`);
    expect(r.plan).toEqual([
      { start: '07:00', end: '07:30', text: 'Skincare', pillar: 'SKIN' },
      { start: '18:00', end: '19:00', text: 'Gym', pillar: 'BODY' },
    ]);
    expect(r.errors).toContain('Could not read a PLAN line: "sometime | Read". It was skipped.');
  });
});

describe('line helpers', () => {
  it('reads time ranges in 24-hour and 12-hour forms', () => {
    expect(parseTimeRange('06:30-07:00')).toMatchObject({ start: '06:30', end: '07:00' });
    expect(parseTimeRange('6:30 – 7:00')).toMatchObject({ start: '06:30', end: '07:00' });
    expect(parseTimeRange('06:30 to 07:00')).toMatchObject({ start: '06:30', end: '07:00' });
    expect(parseTimeRange('6:30 pm - 7:15 pm')).toMatchObject({ start: '18:30', end: '19:15' });
    expect(parseTimeRange('6:30-7:00 pm')).toMatchObject({ start: '18:30', end: '19:00' });
    expect(parseTimeRange('11-1pm')).toMatchObject({ start: '11:00', end: '13:00' });
    expect(parseTimeRange('12 pm to 1 p.m.')).toMatchObject({ start: '12:00', end: '13:00' });
    expect(parseTimeRange('7:00 meeting')).toBeUndefined();
    expect(parseTimeRange('25:00-26:00')).toBeUndefined();
  });

  it('reads a plan line without a pillar, keeping extra cells in the text', () => {
    expect(parsePlanLine('- 09:00-10:00 | Maths class')).toEqual({ start: '09:00', end: '10:00', text: 'Maths class' });
    expect(parsePlanLine('- 09:00-10:00 Maths | revise ch 3 | Work')).toEqual({ start: '09:00', end: '10:00', text: 'Maths | revise ch 3', pillar: 'WORK' });
    expect(parsePlanLine('- 09:00-10:00')).toBeUndefined();
  });

  it('reads people in a few shapes', () => {
    expect(parsePersonLine('- Riya | lent her notes')).toEqual({ name: 'Riya', note: 'lent her notes' });
    expect(parsePersonLine('- Riya (college): lent her notes')).toEqual({ name: 'Riya', circle: 'college', note: 'lent her notes' });
    expect(parsePersonLine('- Riya: lent her notes')).toEqual({ name: 'Riya', note: 'lent her notes' });
  });
});

describe('older replies', () => {
  it('DEMO_REPLY_MD parses as before, with every v2 field empty', () => {
    const r = parseNightlyReply(DEMO_REPLY_MD);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.extraSections).toEqual([]);
    expect(r.quests).toHaveLength(3);
    expect(r.right).toEqual([]);
    expect(r.better).toEqual([]);
    expect(r.food).toEqual({ good: [], better: [] });
    expect(r.rantMd).toBe('');
    expect(r.people).toEqual([]);
    expect(r.web).toEqual({ nodes: [], links: [], summaries: [] });
    expect(r.plan).toEqual([]);
  });

  it('a failed parse carries empty v2 fields', () => {
    const r = parseNightlyReply('## QUESTS\n- [Body] Run');
    expect(r.ok).toBe(false);
    expect(r.plan).toEqual([]);
    expect(r.web.nodes).toEqual([]);
  });
});
