import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useProfile } from '@/data/hooks';
import { profileRepo } from '@/data/repo';
import { countWords } from '@/lib/compile/originSheet';
import { nowIso, toDayKey, formatShortDate, todayKey } from '@/lib/dates';
import { buildOriginPrompt } from '@/lib/prompt/origin';
import { Button, Empty, Section, SectionHeader, TextArea } from '@/ui/primitives';
import { QUESTION_COUNT, answeredCount } from '@/features/onboarding/questions';
import { SheetView } from '@/features/onboarding/views';
import { OriginRerun } from './OriginRerun';
import { VaultPage } from './VaultPage';

export function OriginScreen() {
  const profile = useProfile();
  const [draft, setDraft] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [wholeSheet, setWholeSheet] = useState(false);

  const answered = answeredCount(profile?.onboardingAnswers);
  const sheet = profile?.originSheetMd ?? '';
  const stateOfMe = draft ?? profile?.stateOfMeMd ?? '';
  const settings = profile?.settings;
  const promptMd = useMemo(
    () =>
      profile && sheet
        ? buildOriginPrompt({ displayName: profile.displayName, originSheetMd: sheet, today: todayKey(profile.settings.rolloverHour), excludeMoney: profile.settings.excludeMoney })
        : '',
    [profile, sheet],
  );

  async function saveStateOfMe() {
    if (draft === null) return;
    await profileRepo.update({ stateOfMeMd: draft, stateOfMeAt: nowIso() });
    setDraft(null);
    setSaved(true);
  }

  if (!profile || !settings) return <VaultPage title="Origin Sheet">{null}</VaultPage>;

  return (
    <VaultPage title="Origin Sheet" meta={`${answered} of ${QUESTION_COUNT} answered`}>
      <SectionHeader
        title="State of Me"
        note={profile.stateOfMeAt ? `updated ${formatShortDate(toDayKey(new Date(profile.stateOfMeAt)))}` : 'not written yet'}
      />
      <Section className="gap-2 pb-2">
        <p className="text-mid">The game master reads this every night. Keep it true; edit it when your life changes.</p>
        <TextArea
          value={stateOfMe}
          rows={14}
          placeholder="# State of Me&#10;&#10;Run the origin prompt below, or write it yourself: who you are, where each pillar stands, the people, the voice the letters should use."
          aria-label="State of Me"
          onChange={(e) => {
            setDraft(e.target.value);
            setSaved(false);
          }}
          data-testid="state-of-me"
        />
        <span className="flex items-baseline gap-3">
          <Button variant="outline" onClick={saveStateOfMe} disabled={draft === null || draft === (profile.stateOfMeMd ?? '')}>
            Save
          </Button>
          {draft !== null ? (
            <Button variant="text" className="px-0!" onClick={() => setDraft(null)}>
              Undo changes
            </Button>
          ) : null}
          {saved ? <span className="text-mid">Saved. Tonight's prompt uses it.</span> : null}
        </span>
      </Section>

      <SectionHeader
        title="Origin Sheet"
        note={sheet ? `${countWords(sheet).toLocaleString('en-IN')} words` : undefined}
        action={
          <Link to="/onboarding/part/1?edit=1" className="text-walnut no-underline" data-testid="edit-answers">
            Edit answers
          </Link>
        }
      />
      {sheet ? (
        <>
          <SheetView md={sheet} limitParts={wholeSheet ? undefined : 1} />
          <Section className="pb-2">
            <Button variant="text" className="self-start px-0!" onClick={() => setWholeSheet((v) => !v)}>
              {wholeSheet ? 'Show less' : 'Show the whole sheet'}
            </Button>
          </Section>
        </>
      ) : (
        <Section className="pb-2">
          <Empty action={<Link to="/onboarding/part/1?edit=1">Answer the Origin Sheet</Link>}>The sheet is empty. It takes about 40 minutes and saves as you go.</Empty>
        </Section>
      )}

      <SectionHeader title="Run the origin prompt again" note="Sonnet" />
      <Section className="gap-3 pb-2">
        {sheet ? (
          <>
            <p className="text-mid">
              Claude rereads the sheet and rewrites the State of Me. Skills, routines and goals you do not have yet come back as suggestions to add.
              {settings.excludeMoney ? ' Money stays out.' : ''}
            </p>
            <OriginRerun promptMd={promptMd} />
          </>
        ) : (
          <p className="text-mid">Answer the sheet first; the prompt is built from it.</p>
        )}
      </Section>
    </VaultPage>
  );
}
