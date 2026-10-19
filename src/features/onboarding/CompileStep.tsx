import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { DEFAULT_SETTINGS } from '@/data/types';
import { compileOriginSheet, countWords } from '@/lib/compile/originSheet';
import { todayKey } from '@/lib/dates';
import { Button, Section, SectionHeader } from '@/ui/primitives';
import { PART_COUNT, QUESTION_COUNT, answeredCount } from './questions';
import { CheckRow } from './ui';
import { SheetView } from './views';
import { WizardFrame } from './WizardFrame';
import { STEP, useWizard } from './wizard';

export function CompileStep() {
  const wiz = useWizard();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const settings = wiz.profile?.settings ?? DEFAULT_SETTINGS;
  const { markResumed, saveStep } = wiz;

  useEffect(() => {
    markResumed();
    saveStep(STEP.compile);
    window.scrollTo(0, 0);
  }, [markResumed, saveStep]);

  const md = useMemo(
    () => compileOriginSheet(wiz.answers, { excludeMoney: settings.excludeMoney, displayName: wiz.profile?.displayName, date: todayKey(settings.rolloverHour) }),
    [wiz.answers, wiz.profile?.displayName, settings.excludeMoney, settings.rolloverHour],
  );
  const words = countWords(md);
  const answered = answeredCount(wiz.answers);

  async function onContinue() {
    setBusy(true);
    await wiz.writeProfile({ originSheetMd: md });
    navigate('/onboarding/prompt');
  }

  return (
    <WizardFrame
      meta="Compiled"
      footer={
        <>
          <Button variant="text" onClick={() => navigate(`/onboarding/part/${PART_COUNT}`)} disabled={busy}>
            Back
          </Button>
          <span className="flex-1" />
          <Button size="lg" onClick={onContinue} disabled={busy} data-testid="continue">
            Continue
          </Button>
        </>
      }
    >
      <SectionHeader title="Your Origin Sheet" note={`${words.toLocaleString('en-IN')} words`} />
      <Section className="gap-3 pb-2">
        <p className="text-mid">
          {answered} of {QUESTION_COUNT} answered. This is exactly what Claude will read, nothing more.
          {answered < 30 ? ' Claude can start a game from this, and every answer you add later makes the letters sharper.' : ''}
        </p>
        <CheckRow
          checked={settings.excludeMoney}
          onChange={(v) => void wiz.writeSettings({ excludeMoney: v })}
          label="Leave money out"
          note="Part 7 stays on this device and amounts are stripped from the prompt."
          testId="exclude-money"
        />
      </Section>
      <SheetView md={md} />
    </WizardFrame>
  );
}
