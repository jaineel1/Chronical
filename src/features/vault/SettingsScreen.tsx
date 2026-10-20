import { useEffect, useState } from 'react';
import { useProfile } from '@/data/hooks';
import { profileRepo } from '@/data/repo';
import type { Profile, Settings } from '@/data/types';
import { callClaude } from '@/lib/api/anthropic';
import { Button, Field, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { recompileOriginSheet } from '@/features/onboarding/createGame';
import { NAME_QUESTION_ID } from '@/features/onboarding/questions';
import { CheckRow, Select } from '@/features/onboarding/ui';
import { useSavedField } from './useSavedField';
import { VaultPage } from './VaultPage';

export function SettingsScreen() {
  const profile = useProfile();
  if (!profile) return <VaultPage title="Settings">{null}</VaultPage>;
  return <SettingsForm profile={profile} />;
}

const HOURS = [0, 1, 2, 3, 4, 5, 6];

function rolloverNote(h: number): string {
  if (h === 0) return 'The day ends at midnight: a log at 1 AM counts as the new day.';
  return `The day ends at ${h}:00: a log at ${h === 1 ? '0:30' : '1 AM'} counts as the night before.`;
}

function SettingsForm({ profile }: { profile: Profile }) {
  const s = profile.settings;
  const update = (changes: Partial<Settings>) => profileRepo.updateSettings(changes);

  const [name, setName] = useSavedField(profile.displayName, async (v) => {
    const trimmed = v.trim();
    if (!trimmed) return;
    const current = await profileRepo.ensure();
    const answers = current.onboardingAnswers;
    await profileRepo.update(answers ? { displayName: trimmed, onboardingAnswers: { ...answers, [NAME_QUESTION_ID]: trimmed } } : { displayName: trimmed });
  });
  // Nested settings are merged with the stored value inside one transaction: two fields saved
  // together (both flush when the page closes) keep both changes.
  const [nightly, setNightly] = useSavedField(s.models.nightly, (v) =>
    profileRepo.updateSettingsWith((cur) => ({ models: { ...cur.models, nightly: v.trim() || cur.models.nightly } })),
  );
  const [weekly, setWeekly] = useSavedField(s.models.weekly, (v) =>
    profileRepo.updateSettingsWith((cur) => ({ models: { ...cur.models, weekly: v.trim() || cur.models.weekly } })),
  );
  const [deep, setDeep] = useSavedField(s.models.deep, (v) =>
    profileRepo.updateSettingsWith((cur) => ({ models: { ...cur.models, deep: v.trim() || cur.models.deep } })),
  );

  const [morning, setMorning] = useSavedField(s.reminders.morning, (v) =>
    profileRepo.updateSettingsWith((cur) => ({ reminders: { ...cur.reminders, morning: v || cur.reminders.morning } })),
  );
  const [night, setNight] = useSavedField(s.reminders.night, (v) =>
    profileRepo.updateSettingsWith((cur) => ({ reminders: { ...cur.reminders, night: v || cur.reminders.night } })),
  );
  // The select follows the choice at once; the stored value re-syncs it.
  const [rollover, setRollover] = useState(s.rolloverHour);
  useEffect(() => setRollover(s.rolloverHour), [s.rolloverHour]);

  return (
    <VaultPage title="Settings" meta="this device only">
      <SectionHeader title="You" />
      <Section className="gap-4 pb-2">
        <Field label="Display name" hint="What the game and the letters call you.">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} className="font-serif" autoComplete="given-name" data-testid="display-name" />
        </Field>
      </Section>

      <SectionHeader title="Days" />
      <Section className="gap-4 pb-2">
        <Field label="The game day ends at" hint={rolloverNote(rollover)}>
          <Select
            value={rollover}
            onChange={(e) => {
              setRollover(Number(e.target.value));
              void update({ rolloverHour: Number(e.target.value) });
            }}
            className="self-start"
            data-testid="rollover"
          >
            {HOURS.map((h) => (
              <option key={h} value={h}>
                {h === 0 ? '0:00, midnight' : `${h}:00`}
              </option>
            ))}
          </Select>
        </Field>
      </Section>

      <SectionHeader title="Prompts" />
      <Section className="gap-4 pb-2">
        <CheckRow
          checked={s.deepMode}
          onChange={(v) => void update({ deepMode: v })}
          label="Deep mode"
          note="Every nightly prompt also carries the last 90 nights and your Origin Sheet: about 25k tokens instead of 9k. Slower and pricier; pair it with Sonnet."
          testId="deep-mode"
        />
        <CheckRow
          checked={s.excludeMoney}
          onChange={async (v) => {
            await update({ excludeMoney: v });
            await recompileOriginSheet();
          }}
          label="Leave money out"
          note="Your Money answers stay on this device, and amounts are stripped from everything you copy to Claude."
          testId="exclude-money"
        />
        <div className="flex flex-col gap-3">
          <span className="text-mid">Models, for the API key path. With copy and paste you pick the model in Claude.</span>
          <Field label="Nightly">
            <TextInput value={nightly} onChange={(e) => setNightly(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Weekly and origin">
            <TextInput value={weekly} onChange={(e) => setWeekly(e.target.value)} spellCheck={false} />
          </Field>
          <Field label="Deep">
            <TextInput value={deep} onChange={(e) => setDeep(e.target.value)} spellCheck={false} />
          </Field>
        </div>
      </Section>

      <SectionHeader title="Reminders" note="notifications in the iPhone app" />
      <Section className="gap-3 pb-2">
        <div className="flex flex-wrap gap-6">
          <Field label="Morning letter">
            <span className="w-32">
              <TextInput type="time" value={morning} onChange={(e) => setMorning(e.target.value)} />
            </span>
          </Field>
          <Field label="Night log">
            <span className="w-32">
              <TextInput type="time" value={night} onChange={(e) => setNight(e.target.value)} />
            </span>
          </Field>
        </div>
        <p className="text-mid">Chronicle shows these while it is open. A web page cannot wake your phone; add it to the Home Screen and keep the habit.</p>
      </Section>

      <ApiKeySection settings={s} />
    </VaultPage>
  );
}

function ApiKeySection({ settings }: { settings: Settings }) {
  const [key, setKey] = useState('');
  const [state, setState] = useState<{ kind: 'idle' | 'saved' | 'removed' | 'testing' | 'ok' | 'failed'; text?: string }>({ kind: 'idle' });
  const has = !!settings.apiKey;

  async function save() {
    const trimmed = key.trim();
    if (!trimmed) return;
    await profileRepo.updateSettings({ apiKey: trimmed });
    setKey('');
    setState({ kind: 'saved' });
  }

  async function remove() {
    await profileRepo.updateSettings({ apiKey: undefined });
    setState({ kind: 'removed' });
  }

  async function test() {
    const apiKey = key.trim() || settings.apiKey;
    if (!apiKey) return;
    setState({ kind: 'testing' });
    try {
      const reply = await callClaude({ apiKey, model: settings.models.nightly, prompt: 'Reply with the single word: ready', maxTokens: 16 });
      setState({ kind: 'ok', text: `The key works. ${settings.models.nightly} replied: ${reply.slice(0, 40)}` });
    } catch (e) {
      setState({ kind: 'failed', text: e instanceof Error ? e.message : 'The test failed.' });
    }
  }

  return (
    <>
      <SectionHeader title="Anthropic API key" note={has ? 'saved on this device' : 'optional'} />
      <Section className="gap-3 pb-2">
        <p className="text-mid">
          With a key, prompts can go straight to Claude with one tap instead of copy and paste, billed to your Anthropic account. The key is stored only in
          this browser&apos;s database on this device, in plain text: anyone who can open this browser profile can read it. Leave it empty and nothing
          changes.
        </p>
        <Field label={has ? 'Replace the key' : 'API key'}>
          <TextInput
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={has ? '••••••••, saved' : 'sk-ant-…'}
            autoComplete="off"
            spellCheck={false}
            data-testid="api-key"
          />
        </Field>
        <span className="flex flex-wrap items-center gap-4">
          <Button variant="outline" onClick={save} disabled={!key.trim()}>
            Save key
          </Button>
          <Button variant="text" className="px-0!" onClick={test} disabled={(!key.trim() && !has) || state.kind === 'testing'}>
            {state.kind === 'testing' ? 'Testing' : 'Test key'}
          </Button>
          {has ? (
            <Button variant="text" className="px-0!" onClick={remove}>
              Remove key
            </Button>
          ) : null}
        </span>
        {state.kind === 'saved' ? <span className="text-mid">Saved on this device.</span> : null}
        {state.kind === 'removed' ? <span className="text-mid">Removed. Back to copy and paste.</span> : null}
        {state.kind === 'ok' ? <span className="text-mid">{state.text}</span> : null}
        {state.kind === 'failed' ? <span className="text-red">{state.text}</span> : null}
      </Section>
    </>
  );
}
