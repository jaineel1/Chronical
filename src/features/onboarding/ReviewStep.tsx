import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { DEFAULT_SETTINGS } from '@/data/types';
import { compileOriginSheet, countWords } from '@/lib/compile/originSheet';
import { todayKey } from '@/lib/dates';
import { parseOriginReply } from '@/lib/parse/origin';
import { Button, Section, SectionHeader } from '@/ui/primitives';
import { createGame, latestParsedOrigin } from './createGame';
import { SuggestionLists, useSuggestions } from './Suggestions';
import { AffirmationLines, LetterView, MarkdownView } from './views';
import { QuietPaper, WizardFrame } from './WizardFrame';
import { STEP, useWizard, type OriginResult } from './wizard';

/** Loads the parsed reply (from the prompt step, or the Archive after a reload), then shows the review. */
export function ReviewStep() {
  const wiz = useWizard();
  const [origin, setOrigin] = useState<OriginResult | null | undefined>(wiz.origin ?? undefined);
  const { markResumed, saveStep } = wiz;

  useEffect(() => {
    markResumed();
    saveStep(STEP.review);
    window.scrollTo(0, 0);
  }, [markResumed, saveStep]);

  useEffect(() => {
    if (origin !== undefined) return;
    let live = true;
    void latestParsedOrigin().then((p) => {
      if (!live) return;
      const reply = p?.replyMd ? parseOriginReply(p.replyMd) : undefined;
      setOrigin(p && reply?.ok ? { reply, replyMd: p.replyMd!, promptId: p.id } : null);
    });
    return () => {
      live = false;
    };
  }, [origin]);

  if (origin === undefined) return <QuietPaper />;
  if (origin === null) return <Navigate to="/onboarding/prompt" replace />;
  return <Review origin={origin} />;
}

function Review({ origin }: { origin: OriginResult }) {
  const wiz = useWizard();
  const navigate = useNavigate();
  const { reply } = origin;
  const state = useSuggestions(reply);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showState, setShowState] = useState(false);
  const settings = wiz.profile?.settings ?? DEFAULT_SETTINGS;

  async function create() {
    setBusy(true);
    setError(null);
    try {
      await wiz.flush();
      const sheet = compileOriginSheet(wiz.answers, { excludeMoney: settings.excludeMoney, displayName: wiz.profile?.displayName, date: todayKey(settings.rolloverHour) });
      await createGame({
        accepted: state.accepted,
        stateOfMeMd: reply.stateOfMeMd,
        briefMd: reply.briefMd,
        affirmations: reply.affirmations,
        originSheetMd: wiz.profile?.originSheetMd ?? sheet,
        promptId: origin.promptId,
      });
      navigate('/', { replace: true });
    } catch (e) {
      setBusy(false);
      setError(e instanceof Error ? e.message : 'Could not create the game. Nothing was saved; try again.');
    }
  }

  const briefWords = countWords(reply.briefMd);

  return (
    <WizardFrame
      meta="Review"
      footer={
        <>
          <Button variant="text" onClick={() => navigate('/onboarding/prompt')} disabled={busy}>
            Back
          </Button>
          <span className="flex-1" />
          <Button size="lg" onClick={create} disabled={busy} data-testid="create-game">
            {busy ? 'Creating' : 'Create my game'}
          </Button>
        </>
      }
    >
      <Section className="pb-1">
        <p>Claude read your sheet. Keep what fits, rename anything, untick the rest. You can change all of it later.</p>
        {error ? <p className="text-red">{error}</p> : null}
      </Section>

      <SuggestionLists state={state} emptyNote="Claude suggested no skills, routines or goals. Create the game now and add them yourself later." />

      <SectionHeader title="Your first letter" note={`Day 1, ${briefWords} words`} />
      <Section className="gap-3 pb-2">
        <LetterView md={reply.briefMd} firstOnly />
        <p className="text-mid">The whole letter waits on the Morning screen.</p>
        <AffirmationLines lines={reply.affirmations} />
      </Section>

      <SectionHeader
        title="State of Me"
        note={
          <button type="button" className="cursor-pointer text-walnut" onClick={() => setShowState((v) => !v)}>
            {showState ? 'Show less' : 'Show all'}
          </button>
        }
      />
      <Section className="pb-2">
        <p className="text-mid">What the game master will remember about you every night. Edit it any time in the Vault.</p>
        <MarkdownView md={reply.stateOfMeMd} maxLines={showState ? undefined : 8} />
      </Section>

      {reply.errors.length ? (
        <>
          <SectionHeader title="Notes from reading the reply" note={`${reply.errors.length}`} />
          <Section>
            {reply.errors.map((e, i) => (
              <p key={i} className="text-mid">
                {e}
              </p>
            ))}
          </Section>
        </>
      ) : null}
    </WizardFrame>
  );
}
