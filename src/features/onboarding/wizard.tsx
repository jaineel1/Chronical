/**
 * Wizard state shared by every onboarding route: the answers (local state, saved ~300 ms after each
 * change), the current step (so reopening /onboarding resumes), and the parsed origin reply that
 * travels from /onboarding/prompt to /onboarding/review.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { profileRepo } from '@/data/repo';
import type { OnboardingAnswer, Profile, Settings } from '@/data/types';
import type { OriginReply } from '@/lib/parse/origin';
import { NAME_QUESTION_ID, PART_COUNT, type Answers } from './questions';
import { createDebouncedSaver, type DebouncedSaver } from './saver';

/** onboardingStep values: 0 welcome, 1-10 parts, then the three Claude steps. */
export const STEP = { welcome: 0, compile: PART_COUNT + 1, prompt: PART_COUNT + 2, review: PART_COUNT + 3 } as const;

export function pathForStep(step: number | undefined): string {
  if (!step || step < 1) return '/onboarding';
  if (step <= PART_COUNT) return `/onboarding/part/${step}`;
  if (step === STEP.compile) return '/onboarding/compile';
  if (step === STEP.prompt) return '/onboarding/prompt';
  return '/onboarding/review';
}

export interface OriginResult {
  reply: OriginReply;
  replyMd: string;
  promptId: string;
}

interface WizardValue {
  /** Live profile; null on a fresh install until the first write creates it. */
  profile: Profile | null;
  /** /onboarding/part/:n?edit=1 from the Vault: keeps onboardedAt, returns to /vault/origin. */
  editMode: boolean;
  answers: Answers;
  setAnswer: (id: string, value: OnboardingAnswer | undefined) => void;
  /** Step saved when this visit began; used once for the resume redirect. */
  initialStep: number;
  resumed: boolean;
  markResumed: () => void;
  saveStep: (step: number) => void;
  /** Write pending answers now and wait for every queued write. */
  flush: () => Promise<void>;
  /** Profile and settings writes that must not interleave with the answer writes. */
  writeProfile: (changes: Partial<Omit<Profile, 'id'>>) => Promise<void>;
  writeSettings: (changes: Partial<Settings>) => Promise<void>;
  origin: OriginResult | null;
  setOrigin: (o: OriginResult | null) => void;
  /** Keep the onboarded-redirect off while a step finishes writing, then navigate yourself. */
  holdRedirect: (hold: boolean) => void;
}

const WizardContext = createContext<WizardValue | null>(null);

export function useWizard(): WizardValue {
  const ctx = useContext(WizardContext);
  if (!ctx) throw new Error('useWizard must be used inside WizardProvider');
  return ctx;
}

function isEmptyAnswer(v: OnboardingAnswer | undefined): boolean {
  return v === undefined || v === null || (typeof v === 'string' && v.length === 0) || (Array.isArray(v) && v.length === 0) || (typeof v === 'number' && !Number.isFinite(v));
}

export function WizardProvider({
  profile,
  editMode,
  holdRedirect,
  children,
}: {
  profile: Profile | null;
  editMode: boolean;
  holdRedirect: (hold: boolean) => void;
  children: ReactNode;
}) {
  // Mounted once the profile has loaded, so these initialisers see stored data.
  const [answers, setAnswers] = useState<Answers>(() => ({ ...(profile?.onboardingAnswers ?? {}) }));
  const [initialStep] = useState(() => profile?.onboardingStep ?? 0);
  const [resumed, setResumed] = useState(false);
  const [origin, setOrigin] = useState<OriginResult | null>(null);

  const answersRef = useRef(answers);
  const profileRef = useRef(profile);
  useEffect(() => {
    profileRef.current = profile;
  }, [profile]);
  const lastStepRef = useRef(profile?.onboardingStep ?? 0);

  const saverRef = useRef<DebouncedSaver<Answers> | null>(null);
  if (!saverRef.current) {
    saverRef.current = createDebouncedSaver<Answers>(async (value) => {
      const name = value[NAME_QUESTION_ID];
      const displayName = typeof name === 'string' ? name.trim() : '';
      await profileRepo.update(displayName ? { onboardingAnswers: value, displayName } : { onboardingAnswers: value });
    }, 300);
  }
  const saver = saverRef.current;

  useEffect(() => {
    const flushNow = () => void saver.flush();
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushNow();
    };
    window.addEventListener('pagehide', flushNow);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flushNow);
      document.removeEventListener('visibilitychange', onVisibility);
      flushNow();
    };
  }, [saver]);

  const setAnswer = useCallback(
    (id: string, value: OnboardingAnswer | undefined) => {
      const next = { ...answersRef.current };
      if (isEmptyAnswer(value)) delete next[id];
      else next[id] = value as OnboardingAnswer;
      answersRef.current = next;
      setAnswers(next);
      saver.schedule(next);
    },
    [saver],
  );

  const saveStep = useCallback(
    (step: number) => {
      if (editMode || lastStepRef.current === step) return;
      // Visiting the welcome page must not create a profile on a fresh install.
      if (step === 0 && !profileRef.current) return;
      lastStepRef.current = step;
      void saver.enqueue(() => profileRepo.update({ onboardingStep: step }));
    },
    [editMode, saver],
  );

  const writeProfile = useCallback((changes: Partial<Omit<Profile, 'id'>>) => saver.enqueue(() => profileRepo.update(changes)), [saver]);
  const writeSettings = useCallback((changes: Partial<Settings>) => saver.enqueue(() => profileRepo.updateSettings(changes)), [saver]);
  const flush = useCallback(() => saver.flush(), [saver]);
  const markResumed = useCallback(() => setResumed(true), []);

  const value = useMemo<WizardValue>(
    () => ({ profile, editMode, answers, setAnswer, initialStep, resumed, markResumed, saveStep, flush, writeProfile, writeSettings, origin, setOrigin, holdRedirect }),
    [profile, editMode, answers, setAnswer, initialStep, resumed, markResumed, saveStep, flush, writeProfile, writeSettings, origin, holdRedirect],
  );
  return <WizardContext.Provider value={value}>{children}</WizardContext.Provider>;
}
