import { describe, expect, it } from 'vitest';
import { formatDays, originReplyProblem, parseDays, parseOriginReply, parseTargetDate, parseWindow, readPillar } from './origin';
import { ORIGIN_REPLY_FIXTURE } from './origin.fixture';

const MIN_BRIEF = '## BRIEF\nDay 1. Start small.\n';
const MIN_STATE = '## STATE_OF_ME\n**Riya**, 20.\n';

describe('parseOriginReply on a realistic reply', () => {
  const r = parseOriginReply(ORIGIN_REPLY_FIXTURE);

  it('reads every section with no notes', () => {
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.missing).toEqual([]);
    expect(r.skills).toHaveLength(6);
    expect(r.routines).toHaveLength(8);
    expect(r.goals).toHaveLength(6);
    expect(r.affirmations).toHaveLength(2);
    expect(r.briefMd.startsWith('Day 1. You answered the whole sheet')).toBe(true);
    expect(r.briefMd).toContain('these letters get sharper every week.');
  });

  it('keeps the State of Me in the seeded shape, with its four sub-sections', () => {
    expect(r.stateOfMeMd.startsWith('# State of Me\n\n**Riya**, 20, Ahmedabad.')).toBe(true);
    for (const h of ['## Where I am', '## Patterns the game master has noticed', '## People', '## Voice']) expect(r.stateOfMeMd).toContain(`\n${h}\n`);
    expect(r.stateOfMeMd).toContain('- None yet.');
    expect(r.stateOfMeMd).not.toContain('SKILLS');
    expect(r.stateOfMeMd).not.toContain('###');
  });

  it('reads routine fields, days and windows', () => {
    const byName = Object.fromEntries(r.routines.map((x) => [x.name, x]));
    expect(byName['Deep work on Streaks']).toEqual({
      name: 'Deep work on Streaks',
      pillar: 'WORK',
      subStat: 'Focus',
      weight: 3,
      days: [1, 2, 3, 4, 5],
      window: '10:00-12:00',
      upside: 'Streaks beta ships on 30 November',
      cost: 'each missed block pushes the beta back half a day',
    });
    expect(byName['Evening skincare']!.days).toEqual([]);
    expect(byName['Sunscreen before leaving']!.window).toBeUndefined();
    expect(byName['Run 3 km easy']!.days).toEqual([2, 4, 6]);
    expect(byName['Protein at breakfast']!.days).toEqual([1, 2, 3, 4, 5, 6]);
    expect(byName['Phone in another room after 23:00']).toMatchObject({ pillar: 'DOPAMINE', subStat: 'Restraint', window: '23:00-07:00' });
  });

  it('reads skills and goals', () => {
    expect(r.skills[0]).toEqual({ name: 'Frontend (React)', pillar: 'WORK', level: 46, why: 'ships client sites and a React Native beta on her own' });
    expect(r.goals.find((g) => g.title === 'Streaks beta live')).toEqual({ title: 'Streaks beta live', pillar: 'WORK', why: '100 people using an app she built', targetDate: '2026-11-30' });
    expect(r.goals.find((g) => g.title === 'Screen time under 2 hours')!.targetDate).toBeUndefined();
    expect(r.affirmations[0]).toBe('Two paying clients at 20 is not luck; it is the 2 hours you already give your work every day.');
  });
});

describe('parseOriginReply when something is missing or malformed', () => {
  it('rejects a reply without a BRIEF and says so', () => {
    const r = parseOriginReply(ORIGIN_REPLY_FIXTURE.replace(/## BRIEF[\s\S]*?## AFFIRMATIONS/, '## AFFIRMATIONS'));
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['BRIEF']);
    expect(r.errors[0]).toBe('No ## BRIEF section.');
    expect(r.routines).toHaveLength(8);
    expect(originReplyProblem(r)).toContain('## BRIEF');
  });

  it('rejects a reply without a STATE_OF_ME', () => {
    const r = parseOriginReply(ORIGIN_REPLY_FIXTURE.replace(/## STATE_OF_ME[\s\S]*?## SKILLS/, '## SKILLS'));
    expect(r.ok).toBe(false);
    expect(r.missing).toEqual(['STATE_OF_ME']);
    expect(r.skills).toHaveLength(6);
  });

  it('survives empty input and plain prose without throwing', () => {
    for (const input of ['', '   \n\n', 'Sure, happy to help with that.', '## STATE_OF_ME\n\n## BRIEF\n']) {
      const r = parseOriginReply(input);
      expect(r.ok).toBe(false);
      expect(r.missing).toEqual(['STATE_OF_ME', 'BRIEF']);
      expect(r.skills).toEqual([]);
    }
  });

  it('tolerates only the two required sections', () => {
    const r = parseOriginReply(MIN_STATE + MIN_BRIEF);
    expect(r.ok).toBe(true);
    expect(r).toMatchObject({ skills: [], routines: [], goals: [], affirmations: [], errors: [] });
    expect(r.stateOfMeMd).toBe('# State of Me\n\n**Riya**, 20.\n');
  });

  it('accepts header variants: lower case, bold, colon, numbered, aliases', () => {
    const md = [
      'Here is your setup.',
      '# 1. State of me',
      'Notes.',
      '**SKILLS**',
      'Running | body | 30 | runs',
      'Routines:',
      'Gym | BODY | strength | 3 | Mon-Fri | none | legs | days',
      '### Goals',
      'Half marathon | Body | because | 2027-03-01',
      '## Morning letter',
      'Day 1. Hello.',
      '## Affirmation',
      '- 3 runs a week.',
    ].join('\n');
    const r = parseOriginReply(md);
    expect(r.ok).toBe(true);
    expect(r.stateOfMeMd).toBe('# State of Me\n\nNotes.\n');
    expect(r.skills).toEqual([{ name: 'Running', pillar: 'BODY', level: 30, why: 'runs' }]);
    expect(r.routines[0]).toMatchObject({ pillar: 'BODY', subStat: 'Strength', days: [1, 2, 3, 4, 5] });
    expect(r.goals[0]!.targetDate).toBe('2027-03-01');
    expect(r.briefMd).toBe('Day 1. Hello.');
    expect(r.affirmations).toEqual(['3 runs a week.']);
  });

  it('matches sub-stats case-insensitively and falls back to the first one with a note', () => {
    const md = `${MIN_STATE}${MIN_BRIEF}## ROUTINES
Deep work | Work | focus | 3 | weekdays | 09:00-11:00 | ships | slips
Meditate | Mind | Mindfulness | 1 | daily | none | calm | noise
Stretch | Mind | Recovery | 1 | daily | none | loose | stiff
Plan the week | Work | | 2 | Sun | none | clear | chaos`;
    const r = parseOriginReply(md);
    expect(r.ok).toBe(true);
    expect(r.routines.map((x) => `${x.pillar}/${x.subStat}`)).toEqual(['WORK/Focus', 'MIND/Calm', 'MIND/Calm', 'WORK/Focus']);
    expect(r.errors).toHaveLength(3);
    expect(r.errors[0]).toContain('"Mindfulness" is not a Mind sub-stat');
    expect(r.errors[1]).toContain('Recovery is a Body sub-stat');
    expect(r.errors[2]).toContain('no sub-stat given');
  });

  it('maps wrong-case and loose pillar names, and skips rows with no pillar', () => {
    const md = `${MIN_STATE}${MIN_BRIEF}## SKILLS
Lifting | BODY | 40 | squat 70 kg
Sketching | art | 20 | draws weekly
Running | Fitness | 25 | 5 km
## GOALS
Pitch Streaks | career | investors see it | none
Paint | Hobby | fun | none`;
    const r = parseOriginReply(md);
    expect(r.skills.map((s) => [s.name, s.pillar])).toEqual([
      ['Lifting', 'BODY'],
      ['Running', 'BODY'],
    ]);
    expect(r.goals).toEqual([{ title: 'Pitch Streaks', pillar: 'WORK', why: 'investors see it', targetDate: undefined }]);
    expect(r.errors.some((e) => e.includes('Skipped the skill "Sketching"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('Read "Fitness" as Body'))).toBe(true);
    expect(r.errors.some((e) => e.includes('Skipped the goal "Paint"'))).toBe(true);
  });

  it('reads markdown tables, skipping header and separator rows', () => {
    const md = `${MIN_STATE}${MIN_BRIEF}## SKILLS
| Name | Pillar | Level | Why |
|------|--------|-------|-----|
| **Frontend** | Work | 55 | ships weekly |
| UI design | work | 48/100 | client work |`;
    const r = parseOriginReply(md);
    expect(r.skills).toEqual([
      { name: 'Frontend', pillar: 'WORK', level: 55, why: 'ships weekly' },
      { name: 'UI design', pillar: 'WORK', level: 48, why: 'client work' },
    ]);
    expect(r.errors).toEqual([]);
  });

  it('unwraps a reply Claude put inside a code fence', () => {
    const r = parseOriginReply('Here you go:\n\n```markdown\n' + ORIGIN_REPLY_FIXTURE + '```\n');
    expect(r.ok).toBe(true);
    expect(r.routines).toHaveLength(8);
    expect(r.briefMd.startsWith('Day 1.')).toBe(true);
  });

  it('drops horizontal rules between sections and prose lines inside lists', () => {
    const md = `${MIN_STATE}\n---\n\n## SKILLS\nHere are your skills:\nRunning | Body | 20 | 5 km\n\n---\n\n## BRIEF\nDay 1. Go.\n\n---\n\n## AFFIRMATIONS\n- 5 km is a start.\n`;
    const r = parseOriginReply(md);
    expect(r.briefMd).toBe('Day 1. Go.');
    expect(r.stateOfMeMd).not.toContain('---');
    expect(r.skills).toHaveLength(1);
    expect(r.errors).toEqual([]);
  });

  it('clamps levels and weights, defaults what is missing, and notes it', () => {
    const md = `${MIN_STATE}${MIN_BRIEF}## SKILLS
Running | Body | 140 | very fast
Chess | Mind | | plays online
## ROUTINES
Gym | Body | Strength | 9 | daily | none | legs | days
Walk | Body | Endurance | | daily | none | steps | none`;
    const r = parseOriginReply(md);
    expect(r.skills.map((s) => s.level)).toEqual([100, 10]);
    expect(r.routines.map((x) => x.weight)).toEqual([5, 2]);
    expect(r.errors.some((e) => e.includes('outside 1-100'))).toBe(true);
    expect(r.errors.some((e) => e.includes('No level for the skill "Chess"'))).toBe(true);
    expect(r.errors.some((e) => e.includes('"Walk": no weight given'))).toBe(true);
  });

  it('handles a pillar and sub-stat sharing one cell', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## ROUTINES\nRun | Body/Endurance | 3 | Mon,Wed | 06:00-07:00 | pace | slower\n`);
    expect(r.routines[0]).toMatchObject({ pillar: 'BODY', subStat: 'Endurance', weight: 3, days: [1, 3], window: '06:00-07:00', upside: 'pace', cost: 'slower' });
  });

  it('folds sub-headings inside list sections and ignores extras after AFFIRMATIONS', () => {
    const md = `${MIN_STATE}${MIN_BRIEF}## ROUTINES
### Body
Gym | Body | Strength | 3 | Mon-Sat | 06:00-07:30 | legs | days
### Mind
Read | Mind | Learning | 1 | daily | none | books | lost
## AFFIRMATIONS
- 6 days of gym.
## NOTES
- Anything else`;
    const r = parseOriginReply(md);
    expect(r.routines.map((x) => x.name)).toEqual(['Gym', 'Read']);
    expect(r.affirmations).toEqual(['6 days of gym.']);
    expect(r.errors).toEqual(['Left out an extra section after AFFIRMATIONS: "NOTES".']);
  });

  it('keeps the first of duplicate names', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## GOALS\nRun a 10k | Body | a | none\nrun a 10K | Body | b | none\n`);
    expect(r.goals).toHaveLength(1);
    expect(r.goals[0]!.why).toBe('a');
    expect(r.errors[0]).toContain('appeared twice');
  });

  it('notes unreadable days and windows instead of failing', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## ROUTINES\nStretch | Body | Recovery | 1 | sometimes | after dinner | loose | stiff\n`);
    expect(r.routines[0]).toMatchObject({ days: [], window: undefined });
    expect(r.errors).toEqual(['"Stretch": could not read the days "sometimes"; set to daily.', '"Stretch": could not read the window "after dinner"; left it open.']);
  });
});

describe('parseOriginReply on replies Claude writes in the wild', () => {
  it('keeps a closing remark out of the affirmations', () => {
    const plain = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## AFFIRMATIONS\n- 61 kg is a start.\n- 2 clients at 20.\n\nLet me know if you would like me to adjust anything.`);
    expect(plain.affirmations).toEqual(['61 kg is a start.', '2 clients at 20.']);
    const ruled = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## AFFIRMATIONS\n1. 61 kg is a start.\n2. 2 clients at 20.\n\n---\n\n*Want me to change the routines?*`);
    expect(ruled.affirmations).toEqual(['61 kg is a start.', '2 clients at 20.']);
    const unmarked = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## AFFIRMATIONS\n61 kg is a start.\n2 clients at 20.`);
    expect(unmarked.affirmations).toEqual(['61 kg is a start.', '2 clients at 20.']);
  });

  it('reads a level written with its band', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## SKILLS\nRunning | Body | 34 (Capable) | 5 km in 29:10\nCooking | Body | 22 — capable | dal rice\nReading | Mind | Level 41, solid | 12 books`);
    expect(r.skills.map((s) => [s.name, s.level, s.why])).toEqual([
      ['Running', 34, '5 km in 29:10'],
      ['Cooking', 22, 'dal rice'],
      ['Reading', 41, '12 books'],
    ]);
    expect(r.errors).toEqual([]);
  });

  it('reads "Body (Endurance)" as a pillar with its sub-stat', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## ROUTINES\nRun | Body (Endurance) | 3 | Mon,Wed | 06:00-07:00 | pace | slower`);
    expect(r.routines[0]).toMatchObject({ name: 'Run', pillar: 'BODY', subStat: 'Endurance', weight: 3, days: [1, 3], upside: 'pace', cost: 'slower' });
  });

  it('drops a numbered first column', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## SKILLS\n| # | Skill | Pillar | Level | Why |\n|---|---|---|---|---|\n| 1 | Running | Body | 34 | 5 km |\n| 2 | Cooking | Body | 22 | dal |`);
    expect(r.skills.map((s) => [s.name, s.level])).toEqual([
      ['Running', 34],
      ['Cooking', 22],
    ]);
    expect(r.errors).toEqual([]);
  });

  it('keeps upside and cost in place when the window cell is left out', () => {
    const r = parseOriginReply(`${MIN_STATE}${MIN_BRIEF}## ROUTINES\nGym | Body | Strength | 3 | Mon-Sat | squat 80 kg arrives on schedule | each miss adds 4 days`);
    expect(r.routines[0]).toMatchObject({ window: undefined, upside: 'squat 80 kg arrives on schedule', cost: 'each miss adds 4 days' });
    expect(r.errors).toEqual([]);
  });
});

describe('field readers', () => {
  it('parseDays understands the common ways of writing days', () => {
    const cases: [string, number[]][] = [
      ['daily', []],
      ['Every day', []],
      ['weekdays', [1, 2, 3, 4, 5]],
      ['Mon-Fri', [1, 2, 3, 4, 5]],
      ['Monday to Friday', [1, 2, 3, 4, 5]],
      ['Mon – Sat', [1, 2, 3, 4, 5, 6]],
      ['Mon,Wed,Fri', [1, 3, 5]],
      ['Tue/Thu', [2, 4]],
      ['Tue & Thu', [2, 4]],
      ['Mon-Wed, Sat', [1, 2, 3, 6]],
      ['Fri-Mon', [0, 1, 5, 6]],
      ['weekends', [0, 6]],
      ['Sun', [0]],
      ['Mon-Sun', []],
    ];
    for (const [input, days] of cases) expect(parseDays(input), input).toEqual({ days, ok: true });
    expect(parseDays('3x a week')).toEqual({ days: [1, 3, 5], ok: true, spread: true });
    expect(parseDays('4 times per week')).toEqual({ days: [1, 2, 4, 6], ok: true, spread: true });
    expect(parseDays('daily except Sunday')).toEqual({ days: [1, 2, 3, 4, 5, 6], ok: true });
    expect(parseDays('every day but Sat and Sun')).toEqual({ days: [1, 2, 3, 4, 5], ok: true });
    expect(parseDays('weekdays except Wed')).toEqual({ days: [1, 2, 4, 5], ok: true });
    expect(parseDays('sometimes').ok).toBe(false);
    expect(parseDays(undefined).ok).toBe(false);
    expect(formatDays([])).toBe('daily');
    expect(formatDays([1, 2, 3, 4, 5])).toBe('weekdays');
    expect(formatDays([2, 4, 6])).toBe('Tue, Thu, Sat');
  });

  it('parseWindow normalises 12- and 24-hour ranges', () => {
    expect(parseWindow('06:00-07:30')).toEqual({ window: '06:00-07:30', ok: true });
    expect(parseWindow('6-7:30am')).toEqual({ window: '06:00-07:30', ok: true });
    expect(parseWindow('9:00 to 11:00')).toEqual({ window: '09:00-11:00', ok: true });
    expect(parseWindow('10pm–11pm')).toEqual({ window: '22:00-23:00', ok: true });
    expect(parseWindow('22.30-22.45')).toEqual({ window: '22:30-22:45', ok: true });
    expect(parseWindow('none')).toEqual({ ok: true });
    expect(parseWindow('')).toEqual({ ok: true });
    expect(parseWindow('25:00-26:00').ok).toBe(false);
    expect(parseWindow('after dinner').ok).toBe(false);
  });

  it('parseTargetDate reads ISO dates, written dates and "none"', () => {
    expect(parseTargetDate('2027-2-4')).toEqual({ date: '2027-02-04', ok: true });
    expect(parseTargetDate('by 2027-02-14')).toEqual({ date: '2027-02-14', ok: true });
    expect(parseTargetDate('31 January 2027')).toEqual({ date: '2027-01-31', ok: true });
    expect(parseTargetDate('none')).toEqual({ ok: true });
    expect(parseTargetDate('31/03/2027')).toEqual({ date: '2027-03-31', ok: true });
    expect(parseTargetDate('soon').ok).toBe(false);
    expect(parseTargetDate('2027-13-01').ok).toBe(false);
  });

  it('readPillar maps labels, brackets, synonyms and sub-stats', () => {
    expect(readPillar('[Mind]')).toEqual({ pillar: 'MIND' });
    expect(readPillar('dopamine pillar')).toEqual({ pillar: 'DOPAMINE' });
    expect(readPillar('Skin: Protection')).toEqual({ pillar: 'SKIN', subStat: 'Protection' });
    expect(readPillar('Health')).toEqual({ pillar: 'BODY', loose: 'Health' });
    expect(readPillar('academics')).toEqual({ pillar: 'WORK', subStat: 'Academics', loose: 'academics' });
    expect(readPillar('Money')).toEqual({});
  });
});
