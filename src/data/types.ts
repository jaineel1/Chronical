/**
 * Chronicle data model. Mirrors the Prisma schema in the spec so the same shapes can later
 * sync to Postgres. Every row has an id, createdAt and updatedAt (ISO strings).
 */

export type Pillar = 'BODY' | 'SKIN' | 'MIND' | 'WORK' | 'DOPAMINE';
export const PILLARS: readonly Pillar[] = ['BODY', 'SKIN', 'MIND', 'WORK', 'DOPAMINE'] as const;

export const PILLAR_LABEL: Record<Pillar, string> = {
  BODY: 'Body',
  SKIN: 'Skin',
  MIND: 'Mind',
  WORK: 'Work',
  DOPAMINE: 'Dopamine',
};

/** The four sub-stats under each pillar. Order matters: it is the display order. */
export const SUBSTATS: Record<Pillar, readonly [string, string, string, string]> = {
  BODY: ['Strength', 'Endurance', 'Recovery', 'Nutrition'],
  SKIN: ['Routine', 'Protection', 'Progress', 'Grooming'],
  MIND: ['Calm', 'Connection', 'Learning', 'Reflection'],
  WORK: ['Focus', 'Output', 'Craft', 'Academics'],
  DOPAMINE: ['Attention', 'Restraint', 'Presence', 'Joy'],
};

export function pillarFromLabel(label: string): Pillar | undefined {
  const key = label.trim().toUpperCase();
  return (PILLARS as readonly string[]).includes(key) ? (key as Pillar) : undefined;
}

export interface Base {
  id: string;
  createdAt: string;
  updatedAt: string;
}

/* ---------------------------------- profile --------------------------------- */

export interface Settings {
  /** Nightly prompt also includes the last 90 day logs and the Origin Sheet. */
  deepMode: boolean;
  /** Strip money figures from anything sent to Claude. */
  excludeMoney: boolean;
  /** Hour (0-23) at which the game day rolls over. 4 = a 1 AM log counts as the night before. */
  rolloverHour: number;
  /** Optional Anthropic API key for one-tap nights. Stored locally only. */
  apiKey?: string;
  /** Model ids per prompt kind when the API key path is used. */
  models: { nightly: string; weekly: string; deep: string };
  reminders: { morning: string; night: string };
  /** Show seeded demo content. Cleared by "Start my own game". */
  demo: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  deepMode: false,
  excludeMoney: false,
  rolloverHour: 4,
  models: { nightly: 'claude-haiku-4-5', weekly: 'claude-sonnet-4-5', deep: 'claude-sonnet-4-5' },
  reminders: { morning: '06:30', night: '22:00' },
  demo: false,
};

export interface Profile extends Base {
  id: 'me';
  displayName: string;
  /** ISO timestamp of the first game day. Day numbers count from here. */
  startedAt: string;
  originSheetMd?: string;
  stateOfMeMd?: string;
  stateOfMeAt?: string;
  onboardedAt?: string;
  /** Wizard progress so the 118 questions can be resumed. */
  onboardingStep?: number;
  onboardingAnswers?: Record<string, OnboardingAnswer>;
  settings: Settings;
}

export type OnboardingAnswer = string | number | string[] | null;

/* ---------------------------------- game state ------------------------------- */

export interface PillarState extends Base {
  pillar: Pillar;
  /** Accumulated points. Level is derived: 10 × log2(1 + points / 50). */
  points: number;
}

export interface SubStatState extends Base {
  pillar: Pillar;
  name: string;
  points: number;
}

/* ---------------------------------- routines --------------------------------- */

export interface Routine extends Base {
  name: string;
  pillar: Pillar;
  /** One of SUBSTATS[pillar]. */
  subStat: string;
  /** 1-5. */
  weight: number;
  /** Weekdays it applies, 0 = Sunday … 6 = Saturday. */
  days: number[];
  /** Optional time window shown as a hint, e.g. "05:30-07:00". */
  window?: string;
  /** Real upside line shown on the routine, e.g. "keeps the marathon plan on track". */
  upside: string;
  /** Real cost line, e.g. "each miss adds about 4 days to the sub-4 date". */
  cost: string;
  goalId?: string;
  streak: number;
  /** Shields left this week and which week that count belongs to. */
  shields: number;
  shieldWeek?: string;
  lastDoneDate?: string;
  archived: boolean;
  sortOrder: number;
}

export interface RoutineLog extends Base {
  routineId: string;
  /** Day key. */
  date: string;
  done: boolean;
  shielded: boolean;
  note?: string;
}

/* ---------------------------------- goals ------------------------------------ */

export type GoalStatus = 'active' | 'done' | 'paused';

export interface Goal extends Base {
  pillar: Pillar;
  title: string;
  why: string;
  targetDate?: string;
  status: GoalStatus;
}

export interface Milestone extends Base {
  goalId: string;
  title: string;
  metricName?: string;
  target?: number;
  current?: number;
  unit?: string;
  dueDate?: string;
  doneAt?: string;
}

export interface VisionItem extends Base {
  title: string;
  imageDataUrl?: string;
  /** What it would do for me. */
  gives: string;
  /** What it costs in routines. */
  habitCost: string;
  goalId?: string;
  unlockedAt?: string;
}

/* ---------------------------------- days ------------------------------------- */

export interface Quest {
  id: string;
  pillar?: Pillar;
  text: string;
  reward?: string;
  done: boolean;
}

export interface StatDelta {
  /** "Body", "Body/Endurance", or a skill name like "Running". */
  target: string;
  delta?: number;
  from?: number;
  to?: number;
}

export interface DayLog extends Base {
  /** Day key, unique. */
  date: string;
  weightKg?: number;
  mood?: number;
  energy?: number;
  sleepHours?: number;
  screenMin?: number;
  urgesResisted: number;
  scrollSessions: number;
  phoneFreeEvening?: boolean;
  feltLine?: string;
  /** Rotating-question answers keyed by question id. */
  answers?: Record<string, string>;
  /** Lesson applied today: book id + free text. */
  lessonBookId?: string;
  lessonApplied?: string;
  /** Exactly what was sent to Claude. */
  compiledMd?: string;
  promptId?: string;
  /** Set when "Send tonight's log" was pressed: the night is closed, routine deltas computed. */
  closedAt?: string;
  sentAt?: string;
  repliedAt?: string;
  /** Deltas the app computed from routines (Σ done − 0.5 × Σ skipped, floor −5 per pillar). */
  routineStats?: StatDelta[];
  /** When routineStats + stats were applied to the pillars, so a re-paste can revert and re-apply. */
  statsAppliedAt?: string;
  /** Parsed sections of the reply. */
  briefMd?: string;
  affirmations: string[];
  quests: Quest[];
  stats: StatDelta[];
  warnings: string[];
  insights: string[];
  lessonMd?: string;
  /** Sections the parser did not recognise, kept verbatim. */
  extraSections?: { title: string; body: string }[];
  /** Raw reply kept when parsing failed, so nothing is lost. */
  rawDraft?: string;
  /* More of today. All optional: days logged before these existed simply have none. */
  waterL?: number;
  steps?: number;
  workoutType?: string;
  workoutMin?: number;
  caffeineCups?: number;
  alcoholDrinks?: number;
  deepWorkHours?: number;
  topWin?: string;
  /** 1-5. */
  stress?: number;
  gratitude?: string;
  /** ## SUMMARY of the reply: a short recap of the day. */
  summaryMd?: string;
  /** ## ROUTINE of the reply: at most one suggested routine, until the player adds or dismisses it. */
  routineSuggestion?: RoutineDraft & { status: 'open' | 'added' | 'dismissed' };
}

/** A routine proposed by Claude, before it is in the game. */
export interface RoutineDraft {
  name: string;
  pillar: Pillar;
  subStat: string;
  weight: number;
  /** 0 = Sunday. Empty = every day. */
  days: number[];
  window?: string;
  upside: string;
  cost: string;
}

export interface StarredAffirmation extends Base {
  text: string;
  date: string;
}

/* ---------------------------------- food ------------------------------------- */

/** One portion: its weight, energy and macros. Any part can be unknown. */
export interface Nutrition {
  grams?: number;
  kcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
}

/** Where a portion's numbers came from: Claude's estimate, or typed by the player (never overwritten). */
export type NutritionSource = 'claude' | 'you';

/** A saved meal. `nutrition` is its usual portion, reused the next time it is logged. */
export interface Food extends Base {
  name: string;
  tags: string[];
  nutrition?: Nutrition;
  nutritionFrom?: NutritionSource;
}

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snack';

export interface Meal extends Base {
  date: string;
  slot: MealSlot;
  foodId: string;
  /** 1-5, how you felt after. */
  feltAfter?: number;
  /** This portion. Copied from the saved meal when logged, filled in by Claude's ## MEALS otherwise. */
  nutrition?: Nutrition;
  nutritionFrom?: NutritionSource;
}

/* ------------------------------- progress photos ----------------------------- */

export type PhotoAngle = 'front' | 'side' | 'back';

/**
 * A progress photo. This row syncs with the game; the image itself lives in `photoBlobs` on each
 * device and as its own file at `path` in the sync repo (data/photoSync.ts).
 */
export interface Photo extends Base {
  date: string;
  angle: PhotoAngle;
  /** The weight logged that day, kept with the photo. */
  weightKg?: number;
  width: number;
  height: number;
  /** Where the image sits in the sync repo, e.g. photos/2026-10-20-front-k3x9.jpg. */
  path: string;
}

/**
 * The image of a Photo on this device, as raw JPEG bytes (an ArrayBuffer stores reliably in every
 * IndexedDB, unlike a Blob on older iOS). Never in backups or the JSON sync.
 */
export interface PhotoBlob {
  id: string;
  bytes: ArrayBuffer;
  type: string;
}

/* ---------------------------------- skills ----------------------------------- */

export interface Skill extends Base {
  name: string;
  pillar: Pillar;
  /** 1-100. */
  level: number;
  hours: number;
  goal?: string;
  /** Next unlocks written by Claude. */
  milestones: string[];
  lastAssessedAt?: string;
  sortOrder: number;
}

export interface Achievement extends Base {
  skillId: string;
  date: string;
  text: string;
  value?: number;
  unit?: string;
}

export interface Assessment extends Base {
  skillId: string;
  level: number;
  percentileGeneral?: number;
  percentilePractitioners?: number;
  reasoning: string;
  promptId?: string;
}

/* ---------------------------------- people ----------------------------------- */

export type Circle = 'family' | 'close' | 'partner' | 'client' | 'college' | 'gym' | 'other';
export const CIRCLES: readonly Circle[] = ['family', 'close', 'partner', 'client', 'college', 'gym', 'other'];

export interface Person extends Base {
  name: string;
  circle: Circle;
  /** 1-5. */
  closeness: number;
  wantCloser: boolean;
  lastContact?: string;
  contactEveryDays: number;
  notes?: string;
}

export interface Contact extends Base {
  personId: string;
  date: string;
  kind: 'call' | 'meet' | 'text' | 'other';
  note?: string;
}

/* ---------------------------------- books ------------------------------------ */

export type BookStatus = 'reading' | 'done' | 'wishlist';

export interface Book extends Base {
  title: string;
  author?: string;
  status: BookStatus;
}

export interface Lesson extends Base {
  bookId: string;
  text: string;
  appliedCount: number;
  lastApplied?: string;
}

/* ---------------------------------- lore & prompts --------------------------- */

export type LoreItemType = 'skill' | 'person' | 'goal' | 'book' | 'vision' | 'self';

export interface Lore extends Base {
  itemType: LoreItemType;
  itemId: string;
  text: string;
  structuredMd?: string;
  promptId?: string;
}

export type PromptKind = 'origin' | 'nightly' | 'weekly' | 'monthly' | 'skill_rank' | 'lore' | 'deep';

export interface Prompt extends Base {
  kind: PromptKind;
  /** Suggested model name shown to the user, e.g. "Haiku". */
  model: string;
  promptMd: string;
  replyMd?: string;
  parsedOk?: boolean;
  tokensEst: number;
  sentAt: string;
  repliedAt?: string;
  /** Day key or item id this prompt belongs to. */
  subject?: string;
}

export interface Digest extends Base {
  kind: 'weekly' | 'monthly';
  periodStart: string;
  periodEnd: string;
  md: string;
  promptId?: string;
}

/* ---------------------------------- backup ----------------------------------- */

export interface BackupFile {
  app: 'chronicle';
  /** Version of this file envelope. The shape of the rows inside is `schema`. */
  version: 1;
  exportedAt: string;
  /** Data schema that wrote the tables (see data/migrations.ts). Missing in files from before it existed: 1. */
  schema?: number;
  tables: Record<string, unknown[]>;
}
