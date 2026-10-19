import { useEffect, useState } from 'react';
import { Navigate, useNavigate, useParams } from 'react-router';
import { Button, Section, SectionHeader } from '@/ui/primitives';
import { recompileOriginSheet } from './createGame';
import { PART_COUNT, isAnswered, missingRequired, partByNumber, questionsForPart } from './questions';
import { QuestionField } from './QuestionField';
import { CheckRow, PartIcon, ProgressLine } from './ui';
import { WizardFrame } from './WizardFrame';
import { STEP, useWizard } from './wizard';

export function PartStep() {
  const params = useParams();
  const n = Number(params.n);
  const part = partByNumber(n);
  const wiz = useWizard();
  const navigate = useNavigate();
  const [missing, setMissing] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const { markResumed, saveStep, editMode } = wiz;
  const suffix = editMode ? '?edit=1' : '';

  useEffect(() => {
    markResumed();
    if (part) saveStep(n);
    setMissing([]);
    window.scrollTo(0, 0);
  }, [n, part, markResumed, saveStep]);

  if (!part) return <Navigate to={`/onboarding/part/1${suffix}`} replace />;
  const questions = questionsForPart(part.id);
  const settings = wiz.profile?.settings;

  async function finishEdit() {
    setBusy(true);
    await wiz.flush();
    await recompileOriginSheet(wiz.answers);
    navigate('/vault/origin');
  }

  function goNext() {
    if (n < PART_COUNT) navigate(`/onboarding/part/${n + 1}${suffix}`);
    else if (editMode) void finishEdit();
    else navigate('/onboarding/compile');
  }

  function onContinue() {
    const needed = missingRequired(part!.id, wiz.answers);
    if (needed.length) {
      setMissing(needed.map((q) => q.id));
      const first = document.getElementById(`q-${needed[0]!.id}`);
      first?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      first?.querySelector<HTMLElement>('input, textarea, button')?.focus({ preventScroll: true });
      return;
    }
    goNext();
  }

  function onBack() {
    if (n > 1) navigate(`/onboarding/part/${n - 1}${suffix}`);
    else if (editMode) void finishEdit();
    else {
      saveStep(STEP.welcome);
      navigate('/onboarding');
    }
  }

  const footer = (
    <>
      <Button variant="text" onClick={onBack} disabled={busy}>
        Back
      </Button>
      {editMode ? (
        <Button variant="text" onClick={finishEdit} disabled={busy}>
          Save and return
        </Button>
      ) : (
        <Button variant="text" onClick={goNext} disabled={busy}>
          Skip for now
        </Button>
      )}
      <span className="flex-1" />
      <Button size="lg" onClick={onContinue} disabled={busy} data-testid="continue">
        {editMode && n === PART_COUNT ? 'Save' : 'Continue'}
      </Button>
    </>
  );

  return (
    <WizardFrame
      meta={editMode ? `Editing · Part ${n} of ${PART_COUNT}` : `Part ${n} of ${PART_COUNT} · ${part.name}`}
      top={<ProgressLine value={n / PART_COUNT} label={`Part ${n} of ${PART_COUNT}`} />}
      footer={footer}
    >
      <div className="pt-2">
        <SectionHeader
          title={
            <span className="flex items-center gap-2.5">
              <PartIcon part={part.id} />
              {part.name}
            </span>
          }
          note={`about ${part.minutes} minutes`}
        />
      </div>
      <Section className="pb-2">
        <p className="text-mid">{part.intro}</p>
        {part.id === 'money' && settings ? (
          <CheckRow
            checked={settings.excludeMoney}
            onChange={(v) => void wiz.writeSettings({ excludeMoney: v })}
            label="Leave money out"
            note="Your answers stay on this device. Nothing from this part goes into a prompt."
          />
        ) : null}
      </Section>
      <Section className="gap-6 pt-1">
        {questions.map((q) => (
          <QuestionField key={q.id} q={q} answers={wiz.answers} setAnswer={wiz.setAnswer} missing={missing.includes(q.id) && !isAnswered(q, wiz.answers)} />
        ))}
      </Section>
    </WizardFrame>
  );
}
