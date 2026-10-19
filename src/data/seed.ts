/**
 * Demo world. Seeds a believable Day 23 so every screen has something to show before the player
 * has lived a single night. "Start my own game" in the Vault wipes it.
 *
 * Content mirrors the approved mockups (Morning / Campfire / You / Map / People / Desktop) so
 * screenshots can be compared against the canvas.
 */
import { db } from './db';
import { newId } from './ids';
import { gameRepo, profileRepo, resetAll, stamp } from './repo';
import { addDays, nowIso, todayKey, fromDayKey } from '@/lib/dates';
import { pointsForLevel } from '@/lib/game/level';
import {
  SUBSTATS,
  type Achievement,
  type Book,
  type Contact,
  type DayLog,
  type Food,
  type Goal,
  type Lesson,
  type Milestone,
  type Person,
  type Pillar,
  type Prompt,
  type Routine,
  type RoutineLog,
  type Skill,
  type VisionItem,
} from './types';

export const DEMO_DAY = 23;

/* ------------------------------------------------------------------ */
/* The sample Claude reply, in the exact tagged format the parser expects */
/* ------------------------------------------------------------------ */

export const DEMO_REPLY_MD = `## BRIEF
Day 23. Yesterday you ran 8 km at 5:52 and closed your first full week of evening skincare, which is the longest you have held that routine. Sleep was 6.5 hours again; three short nights in a row is where your energy ratings start to drop, and the log shows it, a 3 after every one of them.

Work took a hit. Two days without a deep-work block, and the invoicing module slips to next week if that becomes three. Today is a focus day: protect the 9 to 11 block before anything else, then an easy 5 km to keep the legs loose for Sunday's long run. You are 11 weeks out from the marathon and 20 seconds a kilometre faster than in September.

The Mentor branch has gone quiet for three weeks; one message today costs you nothing and keeps a door open.

## AFFIRMATIONS
- Twenty-three nights in a row. You are already the person you said you wanted to become.
- Your Body pillar has climbed 2.1 levels since Day 1, mostly on 6 AM starts nobody saw.

## QUESTS
- [Work] Two hours of deep work on the invoicing module | reward: ships Friday
- [Body] Easy 5 km at 6:00 pace | reward: week 11 of 22 stays on plan
- [Mind] Message Mentor, one line is enough | reward: Mind goes up by 2

## STATS
Body +2
Skin 0
Mind -1
Work +3
Dopamine +1
Running 62 -> 62

## WARNINGS
- Gym streak at risk: one shield left this week.

## INSIGHTS
- Late nights are followed by energy 3. Three of three this week.

## LESSON
From Deep Work: schedule the block, don't decide in the moment.
`;

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function daysAgoIso(days: number, hour = 6): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
}

function dayKeyAgo(days: number): string {
  return addDays(todayKey(), -days);
}

/** Deterministic pseudo-random in [0, 1) so the demo looks the same on every device. */
function seeded(n: number): number {
  const x = Math.sin(n * 9301 + 49297) * 233280;
  return x - Math.floor(x);
}

/* ------------------------------------------------------------------ */
/* Seed                                                                */
/* ------------------------------------------------------------------ */

export interface DemoIds {
  routines: Record<string, string>;
  goals: Record<string, string>;
  skills: Record<string, string>;
  people: Record<string, string>;
  books: Record<string, string>;
}

/** Wipe everything and seed the demo world. Marks the profile onboarded and `settings.demo = true`. */
export async function seedDemo(displayName = 'Jaineel'): Promise<DemoIds> {
  await resetAll();
  const profile = await profileRepo.ensure(displayName);
  const startedAt = daysAgoIso(DEMO_DAY - 1);
  await profileRepo.update({
    displayName,
    startedAt,
    onboardedAt: startedAt,
    settings: { ...profile.settings, demo: true },
    stateOfMeMd: STATE_OF_ME_MD,
    stateOfMeAt: daysAgoIso(2),
    originSheetMd: '## Part 1\n**Q** What should the game call you?\n**A** Jaineel\n\n_(Demo origin sheet. Yours is written during onboarding.)_\n',
  });

  /* ---------- pillars and sub-stats (levels from the mockups) ---------- */
  const levels: Record<Pillar, [number, number, number, number]> = {
    BODY: [6.8, 8.1, 5.9, 7.0],
    SKIN: [6.1, 5.2, 4.9, 5.8],
    MIND: [5.9, 6.6, 6.8, 5.5],
    WORK: [8.4, 7.9, 8.2, 7.5],
    DOPAMINE: [4.1, 4.4, 5.0, 4.5],
  };
  for (const pillar of Object.keys(levels) as Pillar[]) {
    const names = SUBSTATS[pillar];
    for (let i = 0; i < 4; i++) {
      await gameRepo.setSubStatPoints(pillar, names[i]!, pointsForLevel(levels[pillar][i]!));
    }
  }

  /* ---------- goals, milestones, vision ---------- */
  const goalRows: (Omit<Goal, 'id' | 'createdAt' | 'updatedAt'> & { key: string; ms: Omit<Milestone, 'id' | 'createdAt' | 'updatedAt' | 'goalId'>[] })[] = [
    {
      key: 'marathon', pillar: 'BODY', title: 'Sub-4 marathon', why: 'Proof that I can hold a hard thing for 22 weeks.', targetDate: dayKeyAgo(-77), status: 'active',
      ms: [
        { title: 'Half marathon under 1:55', metricName: 'half time', target: 115, current: 121, unit: 'min' },
        { title: 'Long run 30 km', metricName: 'long run', target: 30, current: 22, unit: 'km' },
        { title: 'Week 11 of 22', metricName: 'plan weeks', target: 22, current: 11, unit: 'weeks' },
      ],
    },
    {
      key: 'squat', pillar: 'BODY', title: 'Squat 80 kg × 5', why: 'Legs that carry the marathon and everything after.', status: 'active',
      ms: [{ title: 'Squat 80 kg for five', metricName: 'squat', target: 80, current: 70, unit: 'kg' }],
    },
    {
      key: 'invoicing', pillar: 'WORK', title: 'Invoicing module', why: 'The agency bills on time without me chasing.', targetDate: dayKeyAgo(-5), status: 'active',
      ms: [
        { title: 'Data model and migrations', doneAt: daysAgoIso(9) },
        { title: 'PDF generation', doneAt: daysAgoIso(4) },
        { title: 'Send and track', metricName: 'tasks', target: 10, current: 6, unit: 'tasks' },
      ],
    },
    {
      key: 'cgpa', pillar: 'WORK', title: 'CGPA 8.5', why: 'Options open at graduation.', status: 'active',
      ms: [{ title: 'Semester 5 at 8.5+', metricName: 'cgpa', target: 8.5, current: 7.9 }],
    },
    {
      key: 'books', pillar: 'MIND', title: 'Twelve books', why: 'Twelve lenses I did not have in January.', status: 'active',
      ms: [{ title: 'Twelve books this year', metricName: 'books', target: 12, current: 7, unit: 'books' }],
    },
    {
      key: 'friendcall', pillar: 'MIND', title: 'Weekly friend call', why: 'The tree stays alive because I water it.', status: 'active',
      ms: [{ title: 'Ten weeks in a row', metricName: 'weeks', target: 10, current: 8, unit: 'weeks' }],
    },
    {
      key: 'skin', pillar: 'SKIN', title: 'Clear skin by January', why: 'Walk into a room without thinking about my face.', targetDate: dayKeyAgo(-74), status: 'active',
      ms: [
        { title: '30 evening routines', metricName: 'routines', target: 30, current: 7, unit: 'nights' },
        { title: 'Dermatologist follow-up', dueDate: dayKeyAgo(-20) },
      ],
    },
    {
      key: 'screen', pillar: 'DOPAMINE', title: 'Under 2 h of screen a day', why: 'Evenings that belong to me.', status: 'active',
      ms: [
        { title: '7 phone-free evenings', metricName: 'evenings', target: 7, current: 1, unit: 'evenings' },
        { title: 'A week under 2 h', metricName: 'days', target: 7, current: 2, unit: 'days' },
      ],
    },
  ];
  const goals: Record<string, string> = {};
  for (const g of goalRows) {
    const { key, ms, ...rest } = g;
    const row = stamp<Goal>(rest);
    await db.goals.put(row);
    goals[key] = row.id;
    for (const m of ms) await db.milestones.put(stamp<Milestone>({ ...m, goalId: row.id }));
  }
  const vision: Omit<VisionItem, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { title: 'Finisher medal, under four hours', gives: 'Proof I can hold a 22-week plan', habitCost: 'Run 4 mornings a week', goalId: goals.marathon },
    { title: 'Agency billing itself', gives: 'Evenings back, cash on time', habitCost: 'Two deep-work hours a day', goalId: goals.invoicing },
    { title: 'Skin I do not think about', gives: 'Walk in without checking the mirror', habitCost: 'Evening routine, sunscreen daily', goalId: goals.skin },
  ];
  for (const v of vision) await db.visionItems.put(stamp<VisionItem>(v));

  /* ---------- routines ---------- */
  const MON_SAT = [1, 2, 3, 4, 5, 6];
  const DAILY: number[] = [];
  const routineRows: (Omit<Routine, 'id' | 'createdAt' | 'updatedAt'> & { key: string; donePattern: (daysAgo: number) => boolean })[] = [
    { key: 'gym', name: 'Gym', pillar: 'BODY', subStat: 'Strength', weight: 3, days: MON_SAT, window: '06:00-07:30', upside: 'Squat 80 kg arrives on schedule', cost: 'Each miss adds about 4 days to the 80 kg date', goalId: goals.squat, streak: 14, shields: 1, shieldWeek: undefined, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 0, donePattern: (d) => d <= 14 || seeded(d) > 0.3 },
    { key: 'run', name: 'Run, 8 km at 5:52', pillar: 'BODY', subStat: 'Endurance', weight: 3, days: [0, 1, 3, 5], window: '05:45-07:00', upside: 'Keeps the sub-4 plan on track', cost: 'A missed week costs about 10 seconds a kilometre', goalId: goals.marathon, streak: 6, shields: 1, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 1, donePattern: (d) => d <= 6 || seeded(d + 100) > 0.35 },
    { key: 'skincare', name: 'Evening skincare', pillar: 'SKIN', subStat: 'Routine', weight: 2, days: DAILY, window: '22:00-22:30', upside: 'Clear skin by January stays possible', cost: 'Two misses a week push January to March', goalId: goals.skin, streak: 7, shields: 1, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 2, donePattern: (d) => d <= 7 || seeded(d + 200) > 0.5 },
    { key: 'sunscreen', name: 'Sunscreen before leaving', pillar: 'SKIN', subStat: 'Protection', weight: 1, days: DAILY, upside: 'Protects every other skin routine', cost: 'One skipped day undoes a week of progress photos', goalId: goals.skin, streak: 4, shields: 0, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 3, donePattern: (d) => d <= 4 || seeded(d + 300) > 0.4 },
    { key: 'deepwork', name: 'Deep work, two hours', pillar: 'WORK', subStat: 'Focus', weight: 3, days: MON_SAT, window: '09:00-11:00', upside: 'Invoicing ships Friday', cost: 'Three misses and it slips a week', goalId: goals.invoicing, streak: 2, shields: 1, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 4, donePattern: (d) => d <= 2 || (d >= 5 && seeded(d + 400) > 0.3) },
    { key: 'journal', name: 'One line in the journal', pillar: 'MIND', subStat: 'Reflection', weight: 1, days: DAILY, window: '22:00-23:00', upside: 'The letter gets sharper every week', cost: 'A blank night is a blind spot for the game master', streak: 23, shields: 1, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 5, donePattern: () => true },
    { key: 'read', name: 'Read 20 pages', pillar: 'MIND', subStat: 'Learning', weight: 1, days: DAILY, upside: 'Twelve books by December', cost: 'A week off is a book lost', goalId: goals.books, streak: 5, shields: 1, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 6, donePattern: (d) => d <= 5 || seeded(d + 500) > 0.45 },
    { key: 'phonefree', name: 'Phone-free evening', pillar: 'DOPAMINE', subStat: 'Restraint', weight: 2, days: DAILY, window: '20:00-23:00', upside: 'Sleep 7 h and wake up wanting to run', cost: 'Every scroll night is followed by energy 3', goalId: goals.screen, streak: 3, shields: 1, lastDoneDate: dayKeyAgo(1), archived: false, sortOrder: 7, donePattern: (d) => d <= 3 || seeded(d + 600) > 0.7 },
  ];
  const routines: Record<string, string> = {};
  const logs: RoutineLog[] = [];
  for (const r of routineRows) {
    const { key, donePattern, ...rest } = r;
    const row = stamp<Routine>(rest);
    await db.routines.put(row);
    routines[key] = row.id;
    for (let d = 1; d < DEMO_DAY; d++) {
      const date = dayKeyAgo(d);
      const weekday = fromDayKey(date).getDay();
      if (rest.days.length && !rest.days.includes(weekday)) continue;
      logs.push(stamp<RoutineLog>({ routineId: row.id, date, done: donePattern(d), shielded: false }));
    }
  }
  await db.routineLogs.bulkPut(logs);

  /* ---------- day logs (last 22 nights) ---------- */
  const dayLogs: DayLog[] = [];
  for (let d = 1; d < DEMO_DAY; d++) {
    const date = dayKeyAgo(d);
    const weight = Math.round((73.1 - (DEMO_DAY - d) * 0.032 + (seeded(d) - 0.5) * 0.3) * 10) / 10;
    const sleep = Math.round((6.4 + seeded(d + 7) * 1.4) * 2) / 2;
    const mood = sleep < 6.6 ? 3 : 3 + Math.round(seeded(d + 11) * 2);
    dayLogs.push(
      stamp<DayLog>({
        date,
        weightKg: weight,
        sleepHours: sleep,
        mood,
        energy: sleep < 6.6 ? 3 : 4,
        screenMin: 100 + Math.round(seeded(d + 13) * 90),
        urgesResisted: Math.round(seeded(d + 17) * 3),
        scrollSessions: Math.round(seeded(d + 19) * 4),
        phoneFreeEvening: d <= 3,
        feltLine: FELT_LINES[d % FELT_LINES.length],
        affirmations: [],
        quests: [],
        stats: [],
        warnings: [],
        insights: [],
      }),
    );
  }
  // Last night's log carries the parsed reply that the Morning screen shows.
  const lastNight = dayLogs[0]!;
  lastNight.weightKg = 72.4;
  lastNight.sleepHours = 6.5;
  lastNight.mood = 4;
  lastNight.energy = 3;
  lastNight.screenMin = 130;
  lastNight.feltLine = 'Tired but steady. The run was the best part of the day.';
  lastNight.lessonApplied = 'Scheduled the 9 to 11 block the night before instead of deciding in the morning.';
  lastNight.compiledMd = DEMO_PROMPT_MD;
  lastNight.sentAt = daysAgoIso(1, 22);
  lastNight.repliedAt = daysAgoIso(1, 22);
  lastNight.briefMd = DEMO_REPLY_MD.split('## AFFIRMATIONS')[0]!.replace('## BRIEF\n', '').trim();
  lastNight.affirmations = [
    'Twenty-three nights in a row. You are already the person you said you wanted to become.',
    'Your Body pillar has climbed 2.1 levels since Day 1, mostly on 6 AM starts nobody saw.',
  ];
  lastNight.quests = [
    { id: newId(), pillar: 'WORK', text: 'Two hours of deep work on the invoicing module', reward: 'ships Friday', done: false },
    { id: newId(), pillar: 'BODY', text: 'Easy 5 km at 6:00 pace', reward: 'week 11 of 22 stays on plan', done: false },
    { id: newId(), pillar: 'MIND', text: 'Message Mentor, one line is enough', reward: 'Mind goes up by 2', done: false },
  ];
  lastNight.stats = [
    { target: 'Body', delta: 2 },
    { target: 'Skin', delta: 0 },
    { target: 'Mind', delta: -1 },
    { target: 'Work', delta: 3 },
    { target: 'Dopamine', delta: 1 },
    { target: 'Running', from: 62, to: 62 },
  ];
  lastNight.warnings = ['Gym streak at risk: one shield left this week.'];
  lastNight.insights = ['Late nights are followed by energy 3. Three of three this week.'];
  lastNight.lessonMd = "From Deep Work: schedule the block, don't decide in the moment.";
  const prompt = stamp<Prompt>({
    kind: 'nightly',
    model: 'Haiku',
    promptMd: DEMO_PROMPT_MD,
    replyMd: DEMO_REPLY_MD,
    parsedOk: true,
    tokensEst: Math.ceil(DEMO_PROMPT_MD.length / 4),
    sentAt: lastNight.sentAt,
    repliedAt: lastNight.repliedAt,
    subject: lastNight.date,
  });
  await db.prompts.put(prompt);
  lastNight.promptId = prompt.id;
  await db.dayLogs.bulkPut(dayLogs);

  /* ---------- skills ---------- */
  const skillRows: (Omit<Skill, 'id' | 'createdAt' | 'updatedAt'> & { key: string })[] = [
    { key: 'running', name: 'Running', pillar: 'BODY', level: 62, hours: 212, goal: 'Sub-4 marathon', milestones: ['62 to 70: a half marathon under 1:55', '70 to 78: a 30 km long run at 5:40'], lastAssessedAt: daysAgoIso(6), sortOrder: 0 },
    { key: 'frontend', name: 'Frontend', pillar: 'WORK', level: 71, hours: 1400, goal: 'Ship products people pay for', milestones: ['71 to 78: a production app with paying users', '78 to 85: a design system other developers adopt'], lastAssessedAt: daysAgoIso(6), sortOrder: 1 },
    { key: 'lifting', name: 'Lifting', pillar: 'BODY', level: 48, hours: 160, goal: 'Squat 80 kg × 5', milestones: ['48 to 55: squat 80 kg for five', '55 to 62: a bodyweight bench press'], lastAssessedAt: daysAgoIso(6), sortOrder: 2 },
    { key: 'uidesign', name: 'UI design', pillar: 'WORK', level: 66, hours: 600, goal: 'Designs people screenshot', milestones: ['66 to 72: a full app redesign shipped end to end'], lastAssessedAt: daysAgoIso(6), sortOrder: 3 },
    { key: 'speaking', name: 'Public speaking', pillar: 'MIND', level: 31, hours: 20, goal: 'Pitch without notes', milestones: ['31 to 40: a ten-minute talk to strangers'], lastAssessedAt: daysAgoIso(13), sortOrder: 4 },
    { key: 'cooking', name: 'Cooking', pillar: 'BODY', level: 44, hours: 90, goal: 'Cook my own protein every day', milestones: ['44 to 50: five dinners in a row without ordering'], lastAssessedAt: daysAgoIso(13), sortOrder: 5 },
  ];
  const skills: Record<string, string> = {};
  for (const s of skillRows) {
    const { key, ...rest } = s;
    const row = stamp<Skill>(rest);
    await db.skills.put(row);
    skills[key] = row.id;
  }
  const achievements: Omit<Achievement, 'id' | 'createdAt' | 'updatedAt'>[] = [
    { skillId: skills.running!, date: dayKeyAgo(1), text: '8 km at 5:52 pace', value: 8, unit: 'km' },
    { skillId: skills.running!, date: dayKeyAgo(8), text: 'Long run 22 km', value: 22, unit: 'km' },
    { skillId: skills.lifting!, date: dayKeyAgo(3), text: 'Squat 70 kg × 5', value: 70, unit: 'kg' },
    { skillId: skills.frontend!, date: dayKeyAgo(4), text: 'Invoice PDF generation shipped' },
    { skillId: skills.uidesign!, date: dayKeyAgo(12), text: 'Client approved the dashboard redesign in one round' },
  ];
  for (const a of achievements) await db.achievements.put(stamp<Achievement>(a));

  /* ---------- people ---------- */
  const peopleRows: (Omit<Person, 'id' | 'createdAt' | 'updatedAt'> & { key: string; daysQuiet: number })[] = [
    { key: 'mom', name: 'Mom', circle: 'family', closeness: 5, wantCloser: false, contactEveryDays: 2, daysQuiet: 1 },
    { key: 'dad', name: 'Dad', circle: 'family', closeness: 5, wantCloser: false, contactEveryDays: 3, daysQuiet: 2 },
    { key: 'cofounder', name: 'Co-founder', circle: 'partner', closeness: 4, wantCloser: false, contactEveryDays: 1, daysQuiet: 1 },
    { key: 'aarav', name: 'Aarav', circle: 'close', closeness: 4, wantCloser: true, contactEveryDays: 5, daysQuiet: 4 },
    { key: 'gymbuddy', name: 'Gym buddy', circle: 'gym', closeness: 3, wantCloser: false, contactEveryDays: 7, daysQuiet: 9 },
    { key: 'collegecrew', name: 'College crew', circle: 'college', closeness: 3, wantCloser: true, contactEveryDays: 10, daysQuiet: 12 },
    { key: 'client', name: 'Retail client', circle: 'client', closeness: 2, wantCloser: false, contactEveryDays: 10, daysQuiet: 16 },
    { key: 'mentor', name: 'Mentor', circle: 'other', closeness: 3, wantCloser: true, contactEveryDays: 14, daysQuiet: 21, notes: 'Last time: coffee. They asked about the agency.' },
  ];
  const people: Record<string, string> = {};
  for (const p of peopleRows) {
    const { key, daysQuiet, ...rest } = p;
    const row = stamp<Person>({ ...rest, lastContact: dayKeyAgo(daysQuiet) });
    await db.people.put(row);
    people[key] = row.id;
    const kinds: Contact['kind'][] = ['call', 'meet', 'text'];
    await db.contacts.put(stamp<Contact>({ personId: row.id, date: dayKeyAgo(daysQuiet), kind: kinds[daysQuiet % 3]!, note: key === 'mentor' ? 'Coffee. They asked about the agency.' : undefined }));
    if (daysQuiet < 10) await db.contacts.put(stamp<Contact>({ personId: row.id, date: dayKeyAgo(daysQuiet + 6), kind: 'text' }));
  }

  /* ---------- books and lessons ---------- */
  const bookRows: (Omit<Book, 'id' | 'createdAt' | 'updatedAt'> & { key: string; lessons: string[] })[] = [
    { key: 'deepwork', title: 'Deep Work', author: 'Cal Newport', status: 'reading', lessons: ["Schedule the block, don't decide in the moment.", 'Shallow work expands to fill the time you leave it.'] },
    { key: 'atomic', title: 'Atomic Habits', author: 'James Clear', status: 'done', lessons: ['Make it obvious: lay out gym clothes the night before.', 'Never miss twice.'] },
    { key: 'naval', title: 'The Almanack of Naval Ravikant', author: 'Eric Jorgenson', status: 'wishlist', lessons: [] },
  ];
  const books: Record<string, string> = {};
  for (const b of bookRows) {
    const { key, lessons, ...rest } = b;
    const row = stamp<Book>(rest);
    await db.books.put(row);
    books[key] = row.id;
    for (const [i, text] of lessons.entries()) {
      await db.lessons.put(stamp<Lesson>({ bookId: row.id, text, appliedCount: i === 0 ? 4 : 1, lastApplied: dayKeyAgo(i === 0 ? 1 : 6) }));
    }
  }
  if (books.deepwork) {
    const ln = await db.dayLogs.where('date').equals(lastNight.date).first();
    if (ln) await db.dayLogs.put({ ...ln, lessonBookId: books.deepwork, updatedAt: nowIso() });
  }

  /* ---------- a few foods for the Campfire meal picker ---------- */
  const foods = ['Oats, banana', 'Dal rice', 'Paneer wrap', 'Protein shake', 'Eggs, toast', 'Curd rice', 'Chicken bowl'];
  for (const name of foods) await db.foods.put(stamp<Food>({ name, tags: [] }));

  return { routines, goals, skills, people, books };
}

/** Leave the demo: wipe everything and start a fresh, not-yet-onboarded profile. */
export async function startOwnGame(): Promise<void> {
  await resetAll();
  await profileRepo.ensure('');
}

/** True when the store has never been touched on this device. */
export async function isFreshInstall(): Promise<boolean> {
  return (await db.profile.count()) === 0;
}

/* ------------------------------------------------------------------ */
/* Demo text                                                           */
/* ------------------------------------------------------------------ */

const FELT_LINES = [
  'Steady. Nothing dramatic, which is the point.',
  'Short night, long day. Still showed up.',
  'Good run, bad focus.',
  'Scrolled more than I wanted to.',
  'Felt light all day.',
  'Tired by four, pushed through the block anyway.',
  'Best day this week.',
];

export const STATE_OF_ME_MD = `# State of Me

**Jaineel**, 20, Ahmedabad. Final-year CS student who runs a two-person web agency on the side. Started Chronicle 22 days ago.

## Where I am
- Body: training for a sub-4 marathon (week 11 of 22, long run 22 km). Gym Mon-Sat, squat 70 kg. Weight 72.4 kg, down from 73.1.
- Skin: evening routine held for a week for the first time. Dermatologist follow-up next month.
- Mind: 7 of 12 books this year. Journal every night since Day 1. Weekly friend call, 8 weeks running.
- Work: invoicing module due Friday. CGPA 7.9, target 8.5.
- Dopamine: screen time 100-190 minutes a day, target under 120. Three phone-free evenings in a row.

## Patterns the game master has noticed
- Sleep under 6.5 h is followed by an energy rating of 3 every time.
- Deep work happens when the block is scheduled the night before, almost never otherwise.
- Gym streak survives travel only when the bag is packed the night before.

## People
- Family daily. Co-founder daily. Aarav every few days. Mentor fading: 3 weeks quiet.

## Voice
- Direct, warm, no exclamation marks. Numbers over adjectives. One lesson a day, never a lecture.
`;

const DEMO_PROMPT_MD = `You are the game master of Chronicle, a real-life RPG. The player logs each night; you write the next morning.

Reply ONLY in this format, with these exact headers:

## BRIEF
A letter to the player for tomorrow morning, 150-400 words, second person, direct and warm. Use the numbers.

## AFFIRMATIONS
- Two lines. Each must contain a specific number or noun from the player's own log.

## QUESTS
- [Pillar] quest text | reward: real-life reward

## STATS
Pillar +N (or -N), one per line, from the day's routines and numbers. Skills as Name A -> B when you change a ranking.

## WARNINGS
- Streaks at risk, patterns heading the wrong way.

## INSIGHTS
- One pattern you noticed across the last two weeks.

## LESSON
One sentence: a lesson from a book the player is reading, applied to tomorrow.

---

${STATE_OF_ME_MD}

---

# Last 14 days
(14 compressed day logs)

# Tonight, Day 23
- Routines done: Gym, Run 8 km at 5:52, Evening skincare, Sunscreen, One line in the journal, Read 20 pages, Phone-free evening
- Routines skipped: Deep work, two hours
- Weight 72.4 kg · Sleep 6.5 h · Mood 4/5 · Energy 3/5 · Screen 2:10
- Meals: Oats, banana · Dal rice · Paneer wrap · Protein shake
- Felt: Tired but steady. The run was the best part of the day.
- Lesson applied (Deep Work): Scheduled the 9 to 11 block the night before.
`;
