import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { promptRepo } from '@/data/repo';
import { DEFAULT_SETTINGS } from '@/data/types';
import { callClaude } from '@/lib/api/anthropic';
import { compileOriginSheet } from '@/lib/compile/originSheet';
import { todayKey } from '@/lib/dates';
import { originReplyProblem, parseOriginReply } from '@/lib/parse/origin';
import { buildOriginPrompt } from '@/lib/prompt/origin';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import { PromptHandoff, type HandoffResult } from '@/ui/PromptHandoff';
import { Button, Section, SectionHeader } from '@/ui/primitives';
import { recordOriginPrompt, startWithoutClaude } from './createGame';
import { WizardFrame } from './WizardFrame';
import { STEP, useWizard } from './wizard';

export function PromptStep() {
  const wiz = useWizard();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [apiState, setApiState] = useState<{ status: 'idle' | 'asking' | 'failed'; error?: string }>({ status: 'idle' });
  const promptIdRef = useRef<string | null>(null);
  const settings = wiz.profile?.settings ?? DEFAULT_SETTINGS;
  const displayName = wiz.profile?.displayName ?? '';
  const today = todayKey(settings.rolloverHour);
  const { markResumed, saveStep } = wiz;

  useEffect(() => {
    markResumed();
    saveStep(STEP.prompt);
    window.scrollTo(0, 0);
  }, [markResumed, saveStep]);

  const sheet = useMemo(
    () => compileOriginSheet(wiz.answers, { excludeMoney: settings.excludeMoney, displayName, date: today }),
    [wiz.answers, settings.excludeMoney, displayName, today],
  );
  const promptMd = useMemo(
    () => buildOriginPrompt({ displayName, originSheetMd: sheet, today, excludeMoney: settings.excludeMoney }),
    [displayName, sheet, today, settings.excludeMoney],
  );

  async function promptId(): Promise<string> {
    if (!promptIdRef.current) promptIdRef.current = (await recordOriginPrompt(promptMd)).id;
    return promptIdRef.current;
  }

  async function acceptReply(replyMd: string): Promise<HandoffResult> {
    const reply = parseOriginReply(replyMd);
    const id = await promptId();
    await promptRepo.attachReply(id, replyMd, reply.ok);
    if (!reply.ok) return { ok: false, error: originReplyProblem(reply) };
    await wiz.writeProfile({ originSheetMd: sheet });
    wiz.setOrigin({ reply, replyMd, promptId: id });
    navigate('/onboarding/review');
    return { ok: true, message: 'Read it. Now review what Claude set up.' };
  }

  async function askWithKey() {
    if (!settings.apiKey) return;
    setApiState({ status: 'asking' });
    try {
      await promptId();
      const md = await callClaude({ apiKey: settings.apiKey, model: settings.models.weekly, prompt: promptMd, maxTokens: 4000 });
      const r = await acceptReply(md);
      if (!r.ok) setApiState({ status: 'failed', error: r.error });
    } catch (e) {
      setApiState({ status: 'failed', error: e instanceof Error ? e.message : 'The call failed.' });
    }
  }

  async function skip() {
    setBusy(true);
    wiz.holdRedirect(true);
    try {
      await wiz.flush();
      // Keep the prompt in the Archive, unanswered, so it can be pasted into Claude later.
      await promptId();
      await startWithoutClaude(sheet);
      navigate('/', { replace: true });
    } catch {
      wiz.holdRedirect(false);
      setBusy(false);
    }
  }

  return (
    <WizardFrame
      meta="Claude reads it"
      footer={
        <>
          <Button variant="text" onClick={() => navigate('/onboarding/compile')} disabled={busy}>
            Back
          </Button>
          <span className="flex-1" />
          <Button variant="text" onClick={skip} disabled={busy}>
            Skip Claude for now
          </Button>
        </>
      }
    >
      <SectionHeader title="Hand it to Claude" note={MODEL_LABEL.origin} />
      <Section className="gap-3">
        <p>Copy the prompt, paste it into a new chat with Claude, then paste Claude&apos;s whole reply below.</p>
        <p className="text-mid">Claude turns your sheet into skills, routines, goals and your first morning letter. You review all of it before anything is created.</p>
        <PromptHandoff
          promptMd={promptMd}
          model={MODEL_LABEL.origin}
          onCopied={async () => {
            await promptId();
          }}
          onReply={acceptReply}
          pastePlaceholder="Paste Claude's whole reply here, from ## STATE_OF_ME to the last affirmation."
        >
          {settings.apiKey ? (
            <div className="flex flex-col gap-1.5">
              <Button variant="outline" onClick={askWithKey} disabled={apiState.status === 'asking'}>
                {apiState.status === 'asking' ? 'Asking Claude, about a minute' : 'Send it with my API key'}
              </Button>
              {apiState.status === 'failed' ? <span className="text-red">{apiState.error}</span> : null}
            </div>
          ) : null}
        </PromptHandoff>
        <p className="text-mid">No Claude today? Skip it. The prompt waits in the Vault, under Origin Sheet, and the game starts without a letter.</p>
      </Section>
    </WizardFrame>
  );
}
