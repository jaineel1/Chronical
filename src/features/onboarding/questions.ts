/**
 * The Origin Sheet: 118 questions in ten parts. Pure data, no React, so the compiler in
 * `src/lib/compile/originSheet.ts` and the tests can read it.
 *
 * Answer storage (`profile.onboardingAnswers`, keyed by question id):
 *   S, M  → string            T → string[] (chosen options) + `${id}:other` string
 *   L     → number 1-5         N → number (+ `${id}:unit` string when `unitFree`)
 */
import type { OnboardingAnswer } from '@/data/types';

export type QuestionType = 'S' | 'M' | 'T' | 'L' | 'N';

export type PartId = 'identity' | 'body' | 'skin' | 'mind' | 'dopamine' | 'work' | 'money' | 'people' | 'goals' | 'today';

export interface Part {
  id: PartId;
  /** 1-based position, shown as "Part 3 of 10". */
  n: number;
  name: string;
  /** One line under the part header. */
  intro: string;
  /** Rough minutes to answer the whole part. */
  minutes: number;
}

export interface Question {
  /** `<part>-NN`, e.g. 'body-03'. */
  id: string;
  part: PartId;
  text: string;
  type: QuestionType;
  hint?: string;
  placeholder?: string;
  /** T: the chips. */
  options?: string[];
  /** T: also offer a free "something else" line. */
  allowOther?: boolean;
  /** N: unit shown after the number and written into the sheet ("72 kg"). */
  unit?: string;
  /** N: the player types the unit (currencies). */
  unitFree?: boolean;
  min?: number;
  max?: number;
  step?: number;
  /** L: five short labels, 1 to 5. */
  labels?: readonly [string, string, string, string, string];
  required?: boolean;
}

export type Answers = Record<string, OnboardingAnswer>;

export const PARTS: readonly Part[] = [
  { id: 'identity', n: 1, name: 'Identity', intro: 'Who is playing. Short answers are fine, and all of it can be changed later.', minutes: 3 },
  { id: 'body', n: 2, name: 'Body', intro: 'Numbers where you have them, honest guesses where you do not.', minutes: 5 },
  { id: 'skin', n: 3, name: 'Skin', intro: 'Skin, hair and grooming. Product names if you know them; "nothing" is a fine answer.', minutes: 3 },
  { id: 'mind', n: 4, name: 'Mind', intro: 'Reading, calm and the people you lean on. Answer for a normal week, not your best one.', minutes: 4 },
  { id: 'dopamine', n: 5, name: 'Dopamine', intro: 'Attention and the phone. Open your screen-time page before the first question.', minutes: 3 },
  { id: 'work', n: 6, name: 'Work', intro: 'What you build, what you study, and what gets in the way.', minutes: 5 },
  { id: 'money', n: 7, name: 'Money', intro: 'With Leave money out on, this part never leaves the device; without it, it goes to Claude like the rest.', minutes: 3 },
  { id: 'people', n: 8, name: 'People', intro: 'The people who shape your days. The game grows them into a tree you can look after.', minutes: 4 },
  { id: 'goals', n: 9, name: 'Goals', intro: 'Three horizons. Goals you could tick off, with numbers, not wishes.', minutes: 5 },
  { id: 'today', n: 10, name: 'Today', intro: 'Day zero. These answers are the first entry in your log.', minutes: 2 },
];

export const QUESTIONS: readonly Question[] = [
  /* ------------------------------ 1 Identity (10) ------------------------------ */
  { id: 'identity-01', part: 'identity', type: 'S', text: 'What should the game call you?', placeholder: 'Your name', required: true },
  { id: 'identity-02', part: 'identity', type: 'N', text: 'How old are you?', unit: 'years', min: 10, max: 100, step: 1 },
  { id: 'identity-03', part: 'identity', type: 'S', text: 'Where do you live? A city is enough.', placeholder: 'Ahmedabad' },
  { id: 'identity-04', part: 'identity', type: 'S', text: 'What fills most of your weekdays right now?', hint: 'Studying, a job, both, or between things.' },
  { id: 'identity-05', part: 'identity', type: 'S', text: 'If you study: what, where, and which year?', placeholder: 'CS, year 2 of 4' },
  { id: 'identity-06', part: 'identity', type: 'T', text: 'Who do you live with?', options: ['Alone', 'Parents', 'Siblings', 'Partner', 'Roommates', 'Hostel'], allowOther: true },
  { id: 'identity-07', part: 'identity', type: 'S', text: 'Three words the people closest to you would use for you' },
  { id: 'identity-08', part: 'identity', type: 'S', text: 'Three words you want to be true of you a year from now' },
  {
    id: 'identity-09',
    part: 'identity',
    type: 'T',
    text: 'How should the morning letters talk to you?',
    options: ['Blunt', 'Warm', 'Short', 'Detailed', 'Numbers first', 'A little funny'],
    allowOther: true,
  },
  { id: 'identity-10', part: 'identity', type: 'M', text: 'Why are you starting this? A sentence or two.' },

  /* -------------------------------- 2 Body (18) -------------------------------- */
  { id: 'body-01', part: 'body', type: 'N', text: 'Height', unit: 'cm', min: 100, max: 230, step: 1 },
  { id: 'body-02', part: 'body', type: 'N', text: 'Weight this morning, roughly', unit: 'kg', min: 25, max: 250, step: 0.1, required: true },
  { id: 'body-03', part: 'body', type: 'N', text: 'The weight you would like to be at, if you have one', unit: 'kg', min: 25, max: 250, step: 0.1 },
  { id: 'body-04', part: 'body', type: 'N', text: 'Days a week you actually train, not plan to', unit: 'days', min: 0, max: 7, step: 1, required: true },
  {
    id: 'body-05',
    part: 'body',
    type: 'T',
    text: 'What does your training look like?',
    options: ['Gym', 'Running', 'Cycling', 'Swimming', 'A sport', 'Yoga', 'Home workouts', 'Walking', 'Nothing yet'],
    allowOther: true,
  },
  { id: 'body-06', part: 'body', type: 'M', text: 'Your best current lifts or run times, with numbers', placeholder: 'Squat 70 kg × 5. 5 km in 27:40.' },
  { id: 'body-07', part: 'body', type: 'S', text: 'One physical goal with a number and a date', placeholder: 'Sub-4 marathon by March' },
  { id: 'body-08', part: 'body', type: 'N', text: 'Hours of sleep on a normal weeknight', unit: 'h', min: 0, max: 14, step: 0.5 },
  { id: 'body-09', part: 'body', type: 'S', text: 'When do you usually fall asleep and wake up?', placeholder: '1:00 and 7:30' },
  { id: 'body-10', part: 'body', type: 'L', text: 'How rested you feel on most mornings', labels: ['Wrecked', 'Tired', 'Okay', 'Fresh', 'Sharp'] },
  { id: 'body-11', part: 'body', type: 'N', text: 'Steps on a normal day, if your phone counts them', unit: 'steps', min: 0, max: 60000, step: 100 },
  { id: 'body-12', part: 'body', type: 'N', text: 'Glasses of water on a normal day', unit: 'glasses', min: 0, max: 30, step: 1 },
  { id: 'body-13', part: 'body', type: 'M', text: 'A normal day of eating, meal by meal', placeholder: 'Oats and a banana. Dal rice. Chai at 5. Paneer wrap.' },
  { id: 'body-14', part: 'body', type: 'N', text: 'Protein a day, roughly, if you know it', unit: 'g', min: 0, max: 400, step: 5 },
  {
    id: 'body-15',
    part: 'body',
    type: 'T',
    text: 'What is in a normal week?',
    options: ['Coffee', 'Tea', 'Energy drinks', 'Sugar most days', 'Alcohol', 'Smoking or vaping', 'None of these'],
    allowOther: true,
  },
  {
    id: 'body-16',
    part: 'body',
    type: 'T',
    text: 'What usually breaks the training streak?',
    options: ['Travel', 'Exams', 'Late nights', 'Illness', 'No partner', 'Nothing yet'],
    allowOther: true,
  },
  { id: 'body-17', part: 'body', type: 'S', text: 'Injuries, pain or conditions the game should plan around', placeholder: 'None, or e.g. left knee on stairs' },
  { id: 'body-18', part: 'body', type: 'S', text: 'The last time you felt properly fit: when, and what were you doing?' },

  /* -------------------------------- 3 Skin (10) -------------------------------- */
  { id: 'skin-01', part: 'skin', type: 'T', text: 'Your skin type, as far as you know', options: ['Oily', 'Dry', 'Combination', 'Normal', 'Sensitive', 'Not sure'] },
  {
    id: 'skin-02',
    part: 'skin',
    type: 'T',
    text: 'What you want to fix or protect',
    options: ['Acne', 'Marks and spots', 'Oiliness', 'Dryness', 'Dullness', 'Tanning', 'Dark circles', 'Hair fall'],
    allowOther: true,
  },
  { id: 'skin-03', part: 'skin', type: 'M', text: 'Your morning routine, product by product', placeholder: 'Face wash, moisturiser, sunscreen. Or just water.' },
  { id: 'skin-04', part: 'skin', type: 'M', text: 'Your evening routine, product by product' },
  { id: 'skin-05', part: 'skin', type: 'N', text: 'Days a week you wear sunscreen', unit: 'days', min: 0, max: 7, step: 1, required: true },
  { id: 'skin-06', part: 'skin', type: 'N', text: 'Nights a week you actually do the evening routine', unit: 'nights', min: 0, max: 7, step: 1 },
  { id: 'skin-07', part: 'skin', type: 'S', text: 'Last dermatologist visit, and what they said', hint: 'Never is a fine answer.' },
  { id: 'skin-08', part: 'skin', type: 'S', text: 'What you do for hair, beard or nails in a normal week' },
  { id: 'skin-09', part: 'skin', type: 'S', text: 'What makes your skin worse, if you have noticed', placeholder: 'Sugar, short sleep, the gym towel' },
  { id: 'skin-10', part: 'skin', type: 'S', text: 'What you want your skin to look like, and by when', placeholder: 'No new breakouts by January' },

  /* -------------------------------- 4 Mind (14) -------------------------------- */
  { id: 'mind-01', part: 'mind', type: 'N', text: 'Books finished this year', unit: 'books', min: 0, max: 500, step: 1, required: true },
  { id: 'mind-02', part: 'mind', type: 'S', text: 'What you are reading now', placeholder: 'Title, and how far in' },
  { id: 'mind-03', part: 'mind', type: 'S', text: 'A book that changed how you act, and what you took from it' },
  { id: 'mind-04', part: 'mind', type: 'N', text: 'Minutes you read on a normal day', unit: 'min', min: 0, max: 600, step: 5 },
  { id: 'mind-05', part: 'mind', type: 'L', text: 'Journaling habit', labels: ['Never', 'Tried once', 'Some weeks', 'Most days', 'Every day'] },
  {
    id: 'mind-06',
    part: 'mind',
    type: 'T',
    text: 'What actually calms you down',
    options: ['A walk', 'Music', 'Training', 'Prayer', 'Talking to someone', 'Writing', 'Sleep', 'Nothing reliable yet'],
    allowOther: true,
  },
  { id: 'mind-07', part: 'mind', type: 'L', text: 'Stress in a normal week', labels: ['Calm', 'Light', 'Steady', 'Heavy', 'Crushing'] },
  {
    id: 'mind-08',
    part: 'mind',
    type: 'T',
    text: 'What weighs on you most right now',
    options: ['Exams', 'Money', 'Family', 'Work', 'Health', 'The future', 'One person'],
    allowOther: true,
  },
  { id: 'mind-09', part: 'mind', type: 'S', text: 'Who you talk to when it is bad' },
  { id: 'mind-10', part: 'mind', type: 'S', text: 'Last time you were bored for an hour without a screen' },
  { id: 'mind-11', part: 'mind', type: 'S', text: 'Something you are learning outside class or work' },
  { id: 'mind-12', part: 'mind', type: 'S', text: 'A belief about yourself you would like to test this year', placeholder: 'I cannot keep a habit past two weeks' },
  { id: 'mind-13', part: 'mind', type: 'L', text: 'How often you feel lonely', labels: ['Never', 'Rarely', 'Sometimes', 'Often', 'Most days'] },
  { id: 'mind-14', part: 'mind', type: 'M', text: 'What you want to understand better by this time next year' },

  /* ------------------------------ 5 Dopamine (10) ------------------------------ */
  {
    id: 'dopamine-01',
    part: 'dopamine',
    type: 'N',
    text: 'Screen time yesterday, in minutes',
    unit: 'min',
    min: 0,
    max: 1440,
    step: 5,
    hint: 'Screen Time on iPhone, Digital Wellbeing on Android. 3 h 10 m is 190.',
    required: true,
  },
  { id: 'dopamine-02', part: 'dopamine', type: 'N', text: 'Times you picked up the phone yesterday, if it tells you', unit: 'pickups', min: 0, max: 1000, step: 1 },
  {
    id: 'dopamine-03',
    part: 'dopamine',
    type: 'T',
    text: 'The three apps that eat the most',
    options: ['Instagram', 'YouTube', 'WhatsApp', 'Reddit', 'X', 'Snapchat', 'Netflix', 'Games', 'LinkedIn'],
    allowOther: true,
  },
  {
    id: 'dopamine-04',
    part: 'dopamine',
    type: 'T',
    text: 'When the scrolling usually happens',
    options: ['Right after waking', 'In bed at night', 'Between classes', 'While eating', 'During work blocks', 'In the bathroom'],
    allowOther: true,
  },
  { id: 'dopamine-05', part: 'dopamine', type: 'N', text: 'Minutes after waking before you first check the phone', unit: 'min', min: 0, max: 600, step: 1 },
  { id: 'dopamine-06', part: 'dopamine', type: 'S', text: 'First thing you reach for when bored' },
  { id: 'dopamine-07', part: 'dopamine', type: 'S', text: 'Your last phone-free evening', placeholder: 'Last Sunday, or cannot remember' },
  { id: 'dopamine-08', part: 'dopamine', type: 'S', text: 'One habit you would drop tomorrow if it cost nothing' },
  { id: 'dopamine-09', part: 'dopamine', type: 'L', text: 'How in charge of your phone you feel', labels: ['Not at all', 'Barely', 'Half', 'Mostly', 'Fully'] },
  { id: 'dopamine-10', part: 'dopamine', type: 'M', text: 'What you would do with two extra hours a day' },

  /* -------------------------------- 6 Work (16) -------------------------------- */
  { id: 'work-01', part: 'work', type: 'M', text: 'What you build, and for whom', placeholder: 'A booking site for a local gym. My own budgeting app.', required: true },
  { id: 'work-02', part: 'work', type: 'S', text: 'The project due next, and its date', placeholder: 'Invoicing module, 24 October' },
  { id: 'work-03', part: 'work', type: 'N', text: 'Realistic deep-work hours a day', unit: 'h', min: 0, max: 16, step: 0.5, hint: 'Phone away, one task. Not hours at the desk.' },
  { id: 'work-04', part: 'work', type: 'S', text: 'When in the day your best focus happens', placeholder: '9 to 11, before messages' },
  {
    id: 'work-05',
    part: 'work',
    type: 'T',
    text: 'What gets in the way of focus',
    options: ['Phone', 'Messages', 'Meetings', 'Noise', 'Tiredness', 'Unclear next step', 'Too many projects'],
    allowOther: true,
  },
  { id: 'work-06', part: 'work', type: 'N', text: 'CGPA now, if you study', min: 0, max: 10, step: 0.01, hint: "On your college's scale." },
  { id: 'work-07', part: 'work', type: 'N', text: 'The CGPA you are aiming for', min: 0, max: 10, step: 0.01 },
  { id: 'work-08', part: 'work', type: 'N', text: 'Hours of classes or lectures a week', unit: 'h', min: 0, max: 80, step: 1 },
  { id: 'work-09', part: 'work', type: 'S', text: 'The thing you are best at, professionally, right now' },
  { id: 'work-10', part: 'work', type: 'S', text: 'The skill you most want to level up this year' },
  { id: 'work-11', part: 'work', type: 'M', text: 'Things you have shipped that you are proud of, with numbers', placeholder: 'Agency site, 3 clients. A CLI tool, 120 stars.' },
  {
    id: 'work-12',
    part: 'work',
    type: 'T',
    text: 'Tools you use most',
    options: ['VS Code', 'Figma', 'Notion', 'GitHub', 'Excel or Sheets', 'Claude or ChatGPT', 'Pen and paper'],
    allowOther: true,
  },
  { id: 'work-13', part: 'work', type: 'L', text: 'How organised your week feels', labels: ['Chaos', 'Messy', 'Okay', 'Planned', 'Tight'] },
  { id: 'work-14', part: 'work', type: 'S', text: 'What you are putting off right now' },
  { id: 'work-15', part: 'work', type: 'S', text: 'Someone whose work you would love to be doing in five years' },
  { id: 'work-16', part: 'work', type: 'S', text: 'Where you want your work to be in three years' },

  /* -------------------------------- 7 Money (12) ------------------------------- */
  { id: 'money-01', part: 'money', type: 'M', text: 'Where your money comes from, every source', placeholder: 'Pocket money. Two agency clients. Freelance gigs.' },
  { id: 'money-02', part: 'money', type: 'N', text: 'Roughly what comes in a month', unitFree: true, min: 0, step: 100 },
  { id: 'money-03', part: 'money', type: 'N', text: 'Roughly what you spend a month', unitFree: true, min: 0, step: 100 },
  {
    id: 'money-04',
    part: 'money',
    type: 'T',
    text: 'Where most of it goes',
    options: ['Food', 'Rent', 'Travel', 'Subscriptions', 'Going out', 'Family', 'Gear', 'Courses'],
    allowOther: true,
  },
  { id: 'money-05', part: 'money', type: 'N', text: 'Months you could live on your savings', unit: 'months', min: 0, max: 600, step: 0.5 },
  { id: 'money-06', part: 'money', type: 'S', text: 'Debts, or none', placeholder: 'None, or e.g. laptop instalments until March' },
  { id: 'money-07', part: 'money', type: 'S', text: 'Do you track spending? Where?', placeholder: 'No, a sheet, or an app' },
  { id: 'money-08', part: 'money', type: 'S', text: 'The last thing you bought and regret' },
  { id: 'money-09', part: 'money', type: 'S', text: 'The best money you spent this year' },
  { id: 'money-10', part: 'money', type: 'L', text: 'How often money is on your mind', labels: ['Never', 'Monthly', 'Weekly', 'Daily', 'Constantly'] },
  { id: 'money-11', part: 'money', type: 'M', text: 'What you want to earn, by when, and how' },
  { id: 'money-12', part: 'money', type: 'M', text: 'What money is for in your life' },

  /* ------------------------------- 8 People (10) ------------------------------- */
  {
    id: 'people-01',
    part: 'people',
    type: 'M',
    text: 'Up to eight people who matter, and how often you talk',
    placeholder: 'Mom, daily. Aarav, every few days. Mentor, once a month.',
    required: true,
  },
  { id: 'people-02', part: 'people', type: 'S', text: 'Who is fading' },
  { id: 'people-03', part: 'people', type: 'S', text: 'Who you want closer' },
  { id: 'people-04', part: 'people', type: 'S', text: 'Who makes you worse' },
  { id: 'people-05', part: 'people', type: 'S', text: 'Who you would call at 3 AM' },
  { id: 'people-06', part: 'people', type: 'N', text: 'Friends you saw in person last week', unit: 'people', min: 0, max: 100, step: 1 },
  { id: 'people-07', part: 'people', type: 'S', text: 'Someone you owe a message, a thank-you or an apology' },
  { id: 'people-08', part: 'people', type: 'S', text: 'Who is in your corner for the work you do', placeholder: 'A mentor, a cofounder, a teacher' },
  { id: 'people-09', part: 'people', type: 'L', text: 'How your social life feels', labels: ['Empty', 'Thin', 'Okay', 'Good', 'Full'] },
  { id: 'people-10', part: 'people', type: 'S', text: 'Someone new you would like to know this year, by name or by kind', placeholder: 'A founder who has shipped' },

  /* -------------------------------- 9 Goals (10) ------------------------------- */
  {
    id: 'goals-01',
    part: 'goals',
    type: 'M',
    text: 'Three goals for the next 90 days',
    placeholder: 'Run 10 km under 55 minutes. Ship the invoicing module. Read 4 books.',
    required: true,
  },
  { id: 'goals-02', part: 'goals', type: 'M', text: 'Three goals for the next year' },
  { id: 'goals-03', part: 'goals', type: 'M', text: 'Three goals for someday' },
  { id: 'goals-04', part: 'goals', type: 'M', text: 'If you did everything right for a year, what would you have?' },
  { id: 'goals-05', part: 'goals', type: 'S', text: 'The one goal that would make the others easier' },
  { id: 'goals-06', part: 'goals', type: 'S', text: 'A goal you dropped before, and why it slipped' },
  { id: 'goals-07', part: 'goals', type: 'T', text: 'The pillar that needs the most work', options: ['Body', 'Skin', 'Mind', 'Work', 'Dopamine'] },
  { id: 'goals-08', part: 'goals', type: 'S', text: 'The habit you most want to run on autopilot' },
  { id: 'goals-09', part: 'goals', type: 'S', text: 'What you are willing to give up to get there' },
  { id: 'goals-10', part: 'goals', type: 'S', text: 'How you will know, 90 days from now, that this is working' },

  /* -------------------------------- 10 Today (8) ------------------------------- */
  { id: 'today-01', part: 'today', type: 'M', text: 'How today went, in a few lines', required: true },
  { id: 'today-02', part: 'today', type: 'N', text: 'Weight now, or this morning', unit: 'kg', min: 25, max: 250, step: 0.1 },
  { id: 'today-03', part: 'today', type: 'N', text: 'Hours you slept last night', unit: 'h', min: 0, max: 16, step: 0.5 },
  { id: 'today-04', part: 'today', type: 'L', text: 'Mood right now', labels: ['Low', 'Flat', 'Okay', 'Good', 'Great'] },
  { id: 'today-05', part: 'today', type: 'L', text: 'Energy right now', labels: ['Empty', 'Low', 'Okay', 'Good', 'Charged'] },
  { id: 'today-06', part: 'today', type: 'S', text: 'What you are proud of today' },
  { id: 'today-07', part: 'today', type: 'S', text: 'What you would do differently if you had today again' },
  { id: 'today-08', part: 'today', type: 'S', text: 'One thing you will do tomorrow, before anything else' },
];

/* ------------------------------------------------------------------ */
/* Lookups and answer helpers                                          */
/* ------------------------------------------------------------------ */

export const NAME_QUESTION_ID = 'identity-01';
export const PART_COUNT = PARTS.length;
export const QUESTION_COUNT = QUESTIONS.length;

export function partByNumber(n: number): Part | undefined {
  return PARTS.find((p) => p.n === n);
}

export function partById(id: PartId): Part {
  return PARTS.find((p) => p.id === id)!;
}

export function questionsForPart(id: PartId): Question[] {
  return QUESTIONS.filter((q) => q.part === id);
}

/** Key of the free "something else" line under a T question. */
export function otherKey(id: string): string {
  return `${id}:other`;
}

/** Key of the typed unit of a `unitFree` N question. */
export function unitKey(id: string): string {
  return `${id}:unit`;
}

function text(v: OnboardingAnswer | undefined): string {
  return typeof v === 'string' ? v.trim() : '';
}

/** Chosen chips plus the "something else" line, in display order. */
export function choiceValues(q: Question, answers: Answers): string[] {
  const raw = answers[q.id];
  const picked = Array.isArray(raw) ? raw.filter((s) => typeof s === 'string' && s.trim()) : [];
  // Keep the options' order so the sheet reads the same however they were tapped.
  const ordered = q.options ? [...q.options.filter((o) => picked.includes(o)), ...picked.filter((p) => !q.options!.includes(p))] : picked;
  const other = q.allowOther ? text(answers[otherKey(q.id)]) : '';
  return other ? [...ordered, other] : ordered;
}

export function numberValue(v: OnboardingAnswer | undefined): number | undefined {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '' && Number.isFinite(Number(v))) return Number(v);
  return undefined;
}

export function likertValue(v: OnboardingAnswer | undefined): number | undefined {
  const n = numberValue(v);
  return n !== undefined && n >= 1 && n <= 5 ? Math.round(n) : undefined;
}

export function isAnswered(q: Question, answers: Answers): boolean {
  switch (q.type) {
    case 'S':
    case 'M':
      return text(answers[q.id]) !== '';
    case 'T':
      return choiceValues(q, answers).length > 0;
    case 'L':
      return likertValue(answers[q.id]) !== undefined;
    case 'N':
      return numberValue(answers[q.id]) !== undefined;
  }
}

export function answeredCount(answers: Answers | undefined, part?: PartId): number {
  if (!answers) return 0;
  return QUESTIONS.filter((q) => (!part || q.part === part) && isAnswered(q, answers)).length;
}

/** Required questions of a part that are still empty. */
export function missingRequired(part: PartId, answers: Answers): Question[] {
  return questionsForPart(part).filter((q) => q.required && !isAnswered(q, answers));
}
