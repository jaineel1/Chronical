import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router';
import { seedDemo } from '@/data/seed';
import { Button, TextInput } from '@/ui/primitives';
import { PixelSprite } from '@/ui/PixelSprite';
import { CAMPFIRE_LOGO_MAP, CAMPFIRE_LOGO_PALETTE, HERO_MAP, HERO_PALETTE } from '@/ui/sprites';
import { NAME_QUESTION_ID, PARTS, QUESTION_COUNT } from './questions';
import { WizardFrame } from './WizardFrame';
import { pathForStep, useWizard } from './wizard';

const TOTAL_MINUTES = PARTS.reduce((a, p) => a + p.minutes, 0);

export function WelcomeStep() {
  const wiz = useWizard();
  const navigate = useNavigate();
  const [needName, setNeedName] = useState(false);
  const [busy, setBusy] = useState(false);
  const [seeding, setSeeding] = useState(false);

  const nameAnswer = wiz.answers[NAME_QUESTION_ID];
  const name = typeof nameAnswer === 'string' ? nameAnswer : '';
  // Reopening the app mid-sheet: go straight back to the saved part, once per visit.
  const resumeTo = !wiz.resumed && !wiz.editMode && wiz.initialStep >= 1 ? pathForStep(wiz.initialStep) : null;
  const { markResumed, saveStep } = wiz;

  useEffect(() => {
    if (resumeTo) return;
    markResumed();
    saveStep(0);
  }, [resumeTo, markResumed, saveStep]);

  if (resumeTo) return <Navigate to={resumeTo} replace />;

  async function begin() {
    if (!name.trim()) {
      setNeedName(true);
      document.getElementById('welcome-name')?.focus();
      return;
    }
    setBusy(true);
    wiz.setAnswer(NAME_QUESTION_ID, name.trim());
    await wiz.flush();
    navigate('/onboarding/part/1');
  }

  async function demo() {
    setBusy(true);
    setSeeding(true);
    wiz.holdRedirect(true);
    try {
      await wiz.flush();
      await seedDemo();
      navigate('/', { replace: true });
    } catch {
      wiz.holdRedirect(false);
      setSeeding(false);
      setBusy(false);
    }
  }

  return (
    <WizardFrame title="Chronicle" meta="Day 0">
      <div className="relative h-[120px]" aria-hidden="true">
        <div className="absolute top-0 right-2 bg-ink p-1.5">
          <PixelSprite map={CAMPFIRE_LOGO_MAP} palette={CAMPFIRE_LOGO_PALETTE} scale={3} />
        </div>
        <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={5} className="absolute top-1 left-2" />
        <div className="absolute inset-x-0 bottom-3 h-[2px] bg-faint" />
      </div>

      <div className="flex flex-col gap-6 px-2.5">
        <p className="letter">
          <span className="drop">Y</span>our life, kept like a game. Five pillars, real routines with real costs, and a game master who writes you a
          letter every morning from what you logged the night before. It starts with the Origin Sheet: {QUESTION_COUNT} questions in ten parts,
          about {TOTAL_MINUTES} minutes, saved as you go.
        </p>

        <label className="flex flex-col gap-1">
          <span className="text-mid">What should the game call you?</span>
          <TextInput
            id="welcome-name"
            value={name}
            onChange={(e) => {
              setNeedName(false);
              wiz.setAnswer(NAME_QUESTION_ID, e.target.value);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void begin();
            }}
            placeholder="Your name"
            autoComplete="given-name"
            className="font-serif"
            data-testid="welcome-name"
          />
          {needName ? <span className="text-red">The game needs a name to call you.</span> : null}
        </label>

        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={begin} disabled={busy}>
            Begin the Origin Sheet
          </Button>
          <Button variant="outline" onClick={demo} disabled={busy}>
            {seeding ? 'Setting up the demo' : 'Try the demo first'}
          </Button>
          <Button variant="text" className="self-start" onClick={() => navigate('/sync')} disabled={busy} data-testid="welcome-sync">
            Sync from another device
          </Button>
        </div>

        <p className="text-mid">Everything stays on this device. Nothing is sent anywhere until you copy it yourself.</p>
      </div>
    </WizardFrame>
  );
}
