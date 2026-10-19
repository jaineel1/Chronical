import { useState } from 'react';
import { useNavigate } from 'react-router';
import { useProfile } from '@/data/hooks';
import { profileRepo } from '@/data/repo';
import { seedDemo } from '@/data/seed';
import { nowIso } from '@/lib/dates';
import { Button, TextInput } from '@/ui/primitives';
import { PixelSprite } from '@/ui/PixelSprite';
import { HERO_MAP, HERO_PALETTE, SUN_MAP, SUN_PALETTE } from '@/ui/sprites';

/**
 * PLACEHOLDER. Agent Onboarding+Vault replaces this with the 118-question Origin Sheet wizard.
 * Keep two things when you do: the "Try the demo" entry (seedDemo + navigate home) and the
 * redirect-when-already-onboarded behaviour.
 */
export function OnboardingScreen() {
  const profile = useProfile();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  if (profile?.onboardedAt) {
    navigate('/', { replace: true });
    return null;
  }

  async function begin() {
    setBusy(true);
    await profileRepo.ensure(name.trim() || 'Player');
    await profileRepo.update({ displayName: name.trim() || 'Player', onboardedAt: nowIso() });
    navigate('/', { replace: true });
  }

  async function demo() {
    setBusy(true);
    await seedDemo();
    navigate('/', { replace: true });
  }

  return (
    <div className="flex min-h-dvh flex-col bg-paper text-ink">
      <header className="flex items-baseline justify-between bg-ink px-6 py-3.5 text-paper">
        <span>Chronicle</span>
        <span className="text-bar-text">Day 0</span>
      </header>
      <main className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-6 px-6 pt-10 pb-10">
        <div className="relative h-[120px]">
          <PixelSprite map={SUN_MAP} palette={SUN_PALETTE} scale={4} className="absolute top-0 right-6" />
          <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={5} className="absolute top-3 left-2" />
        </div>
        <p className="letter">
          <span className="drop">Y</span>our life, kept like a game. Five pillars, real routines with real costs, and a game master who writes
          you a letter every morning from what you logged the night before.
        </p>
        <label className="flex flex-col gap-1">
          <span className="text-mid">What should the game call you?</span>
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name" autoFocus />
        </label>
        <div className="flex flex-col gap-3">
          <Button size="lg" onClick={begin} disabled={busy}>
            Begin the Origin Sheet
          </Button>
          <Button variant="outline" onClick={demo} disabled={busy}>
            Try the demo first
          </Button>
        </div>
        <p className="text-mid">Everything stays on this device. Nothing is sent anywhere until you copy it yourself.</p>
      </main>
    </div>
  );
}
