import { useState } from 'react';
import { dayLogRepo } from '@/data/repo';
import { PILLAR_LABEL, type DayLog } from '@/data/types';
import { addSuggestions } from '@/features/onboarding/createGame';
import { formatDays } from '@/lib/parse/origin';
import { Button, Section, SectionHeader } from '@/ui/primitives';

/** Claude's one suggested routine from last night's reply, until the player adds or dismisses it. */
export function RoutineSuggestion({ log, rolloverHour }: { log: DayLog; rolloverHour: number }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const s = log.routineSuggestion;
  if (!s || s.status !== 'open') return null;

  async function decide(status: 'added' | 'dismissed') {
    if (!s) return;
    setBusy(true);
    setError(undefined);
    try {
      if (status === 'added') await addSuggestions({ skills: [], routines: [s], goals: [] }, { rolloverHour });
      await dayLogRepo.update(log.date, { routineSuggestion: { ...s, status } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  const meta = [`${PILLAR_LABEL[s.pillar]}/${s.subStat}`, `weight ${s.weight}`, formatDays(s.days), s.window].filter(Boolean).join(' · ');
  return (
    <>
      <SectionHeader title="A routine to try" note="suggested last night" />
      <Section className="gap-2">
        <div className="flex flex-col gap-0.5" data-testid="routine-suggestion">
          <span>{s.name}</span>
          <span className="text-mid">{meta}</span>
          {s.upside ? <span className="text-mid">Builds: {s.upside}</span> : null}
          {s.cost ? <span className="text-mid">A miss costs: {s.cost}</span> : null}
        </div>
        <span className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={() => void decide('added')} disabled={busy} data-testid="routine-add">
            Add to my routines
          </Button>
          <Button variant="text" onClick={() => void decide('dismissed')} disabled={busy}>
            Not now
          </Button>
        </span>
        {error ? <span className="text-red">{error}</span> : null}
      </Section>
    </>
  );
}
