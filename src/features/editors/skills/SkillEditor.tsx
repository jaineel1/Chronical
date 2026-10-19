import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { PILLARS, PILLAR_LABEL, type Pillar, type Skill } from '@/data/types';
import { formatShortDate, toDayKey } from '@/lib/dates';
import { Button, Field, SectionHeader, TextInput } from '@/ui/primitives';
import { LoreSection } from '../lib/LoreSection';
import { Missing } from '../lib/Missing';
import { formatAmount } from '../lib/progress';
import { achievementRepo, skillRepo } from '../lib/repos';
import { clampLevel, formatSkillLevel, skillBand } from '../lib/skills';
import { ChipChoice, ChoiceGroup, ConfirmAction, ErrorText, SaveBar, numberOrUndefined, useGoBack } from '../lib/ui';
import { useDraft } from '../lib/useDraft';
import { useToday } from '../lib/useToday';
import { useAchievements, useAssessments, useSkill } from '../queries';

interface SkillForm {
  name: string;
  pillar: Pillar | '';
  goal: string;
  level: string;
  hours: string;
}

type Errors = Partial<Record<keyof SkillForm, string>>;

function toForm(s: Skill | null): SkillForm {
  return {
    name: s?.name ?? '',
    pillar: s?.pillar ?? '',
    goal: s?.goal ?? '',
    level: s ? String(s.level) : '',
    hours: s ? String(s.hours) : '0',
  };
}

function validate(f: SkillForm): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Give the skill a name.';
  if (!f.pillar) e.pillar = 'Pick the pillar it belongs to.';
  const level = numberOrUndefined(f.level);
  if (level === undefined || level < 1 || level > 100) e.level = 'A number from 1 to 100.';
  const hours = numberOrUndefined(f.hours || '0');
  if (hours === undefined || hours < 0) e.hours = 'Hours are a number, 0 or more.';
  return e;
}

export function SkillEditor() {
  const { id } = useParams();
  const row = useSkill(id);
  useShellBar(id ? 'Edit skill' : 'New skill');
  if (row === undefined) return <Page>{null}</Page>;
  if (id && row === null) return <Missing what="skill" back="/edit/skills" />;
  return <SkillFormView key={id ?? 'new'} row={row} />;
}

function SkillFormView({ row }: { row: Skill | null }) {
  const live = useMemo(() => toForm(row), [row]);
  const [draft, set] = useDraft(live);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const goBack = useGoBack('/edit/skills');
  const navigate = useNavigate();
  const errors = tried ? validate(draft) : {};

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(validate(draft)).length || !draft.pillar) return;
    setSaving(true);
    try {
      const fields = {
        name: draft.name.trim(),
        pillar: draft.pillar,
        goal: draft.goal.trim() || undefined,
        level: clampLevel(numberOrUndefined(draft.level) ?? 1),
        hours: Math.max(0, numberOrUndefined(draft.hours || '0') ?? 0),
      };
      if (row) await skillRepo.update(row.id, fields);
      else await skillRepo.create({ ...fields, milestones: [], sortOrder: await skillRepo.nextSortOrder() });
      goBack();
    } finally {
      setSaving(false);
    }
  }

  const missing = Object.keys(errors).length;
  return (
    <Page>
      <form onSubmit={save} noValidate className="flex flex-col gap-2" aria-label={row ? `Edit ${row.name}` : 'New skill'}>
        <SectionHeader
          title={row ? row.name : 'New skill'}
          note={row ? `${formatSkillLevel(row.level)}, ${skillBand(row.level).toLowerCase()}` : 'ranked 1 to 100'}
        />
        <div className="flex flex-col gap-4 px-2.5 pt-1 pb-3">
          <Field label="Skill">
            <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Running" aria-invalid={!!errors.name} />
            {errors.name ? <ErrorText>{errors.name}</ErrorText> : null}
          </Field>
          <ChoiceGroup label="Pillar" error={errors.pillar}>
            <ChipChoice options={PILLARS} value={draft.pillar || undefined} render={(p) => PILLAR_LABEL[p]} onChange={(p) => set({ pillar: p })} />
          </ChoiceGroup>
          <Field label="What it is for, optional">
            <TextInput value={draft.goal} onChange={(e) => set({ goal: e.target.value })} placeholder="Sub-4 marathon" />
          </Field>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Level, 1 to 100">
              <TextInput value={draft.level} inputMode="decimal" onChange={(e) => set({ level: e.target.value })} placeholder="40" aria-invalid={!!errors.level} />
              {errors.level ? <ErrorText>{errors.level}</ErrorText> : null}
            </Field>
            <Field label="Hours so far">
              <TextInput value={draft.hours} inputMode="decimal" onChange={(e) => set({ hours: e.target.value })} placeholder="0" aria-invalid={!!errors.hours} />
              {errors.hours ? <ErrorText>{errors.hours}</ErrorText> : null}
            </Field>
            <span className="col-span-2 text-mid">Claude re-ranks this; set a starting guess.</span>
          </div>
        </div>
        <SaveBar onBack={goBack} saving={saving} note={missing ? <ErrorText>{missing === 1 ? 'One thing to fix above.' : `${missing} things to fix above.`}</ErrorText> : null} />
      </form>

      {row ? (
        <>
          <LogHours skill={row} />
          <Achievements skillId={row.id} />
          <Rankings skillId={row.id} />
          <div className="pt-4">
            <LoreSection type="skill" itemId={row.id} />
          </div>
          <div className="px-2.5 pt-6">
            <ConfirmAction
              label="Delete this skill"
              question={`Delete ${row.name} with its achievements and rankings?`}
              confirmLabel="Delete"
              onConfirm={async () => {
                await skillRepo.remove(row.id);
                navigate('/edit/skills', { replace: true });
              }}
            />
          </div>
        </>
      ) : null}
    </Page>
  );
}

function LogHours({ skill }: { skill: Skill }) {
  const [hours, setHours] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const n = numberOrUndefined(hours);

  async function log(e: FormEvent) {
    e.preventDefault();
    if (n === undefined || n <= 0 || n > 24) {
      setError('A number of hours, more than 0 and up to 24.');
      return;
    }
    setError(null);
    const before = skill.level;
    const next = await skillRepo.logHours(skill.id, n);
    setHours('');
    if (next) setMessage(`Logged ${formatAmount(n)} h. ${skill.name} ${formatAmount(before)} → ${formatAmount(next.level)}.`);
  }

  return (
    <section aria-label="Log hours" className="flex flex-col gap-2 pt-4">
      <SectionHeader title="Log hours" note="+0.1 a level an hour" />
      <form onSubmit={log} className="flex flex-col gap-2 px-2.5">
        <div className="flex items-end gap-3">
          <Field label="Hours practised">
            <TextInput value={hours} inputMode="decimal" onChange={(e) => setHours(e.target.value)} placeholder="1.5" className="max-w-32" />
          </Field>
          <Button type="submit" variant="outline">
            Log
          </Button>
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
        {message ? <span className="text-mid">{message}</span> : null}
        <span className="text-mid">Hours count until Claude ranks the skill again; the next ranking replaces the level.</span>
      </form>
    </section>
  );
}

function Achievements({ skillId }: { skillId: string }) {
  const list = useAchievements(skillId);
  const today = useToday();
  const [date, setDate] = useState(today);
  const [text, setText] = useState('');
  const [value, setValue] = useState('');
  const [unit, setUnit] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function add(e: FormEvent) {
    e.preventDefault();
    if (!text.trim()) {
      setError('Say what you did.');
      return;
    }
    if (value.trim() && numberOrUndefined(value) === undefined) {
      setError('The value takes a number, like 22.');
      return;
    }
    setError(null);
    await achievementRepo.create({
      skillId,
      date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : today,
      text: text.trim(),
      value: numberOrUndefined(value),
      unit: unit.trim() || undefined,
    });
    setText('');
    setValue('');
    setUnit('');
  }

  return (
    <section aria-label="Achievements" className="flex flex-col gap-2 pt-4">
      <SectionHeader title="Achievements" note={list?.length ? `${list.length} logged` : 'proof for the next ranking'} />
      <div className="flex flex-col gap-3 px-2.5">
        {list?.length ? (
          <ul className="m-0 flex list-none flex-col p-0">
            {list.map((a, i) => (
              <li key={a.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-2 py-2 ${i ? 'border-t border-faint' : ''}`}>
                <span className="w-14 shrink-0 text-mid">{formatShortDate(a.date)}</span>
                <span className="min-w-0 flex-1">
                  {a.text}
                  {a.value !== undefined ? (
                    <span className="text-mid">
                      {' · '}
                      {formatAmount(a.value)}
                      {a.unit ? ` ${a.unit}` : ''}
                    </span>
                  ) : null}
                </span>
                <ConfirmAction
                  quiet
                  label="Remove"
                  question="Remove this achievement?"
                  confirmLabel="Remove"
                  askingClassName="basis-full"
                  onConfirm={() => achievementRepo.remove(a.id)}
                />
              </li>
            ))}
          </ul>
        ) : null}
        <form onSubmit={add} className="flex flex-col gap-3 border border-dashed border-faint p-3" aria-label="Add an achievement">
          <Field label="What you did">
            <TextInput value={text} onChange={(e) => setText(e.target.value)} placeholder="Long run 22 km" />
          </Field>
          <Field label="Day">
            <TextInput type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="max-w-48" />
          </Field>
          <div className="grid grid-cols-2 gap-x-4">
            <Field label="Value, optional">
              <TextInput value={value} inputMode="decimal" onChange={(e) => setValue(e.target.value)} placeholder="22" />
            </Field>
            <Field label="Unit">
              <TextInput value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="km" />
            </Field>
          </div>
          {error ? <ErrorText>{error}</ErrorText> : null}
          <Button type="submit" variant="outline" className="self-start">
            Add the achievement
          </Button>
        </form>
      </div>
    </section>
  );
}

function Rankings({ skillId }: { skillId: string }) {
  const list = useAssessments(skillId);
  if (!list) return null;
  return (
    <section aria-label="Rankings" className="flex flex-col gap-2 pt-4">
      <SectionHeader title="Rankings" note={list.length ? `${list.length} by Claude` : 'none yet'} />
      <div className="px-2.5">
        {list.length === 0 ? (
          <p className="m-0 text-mid">Use Rank again on the You screen; each ranking lands here with its reasoning.</p>
        ) : (
          <ul className="m-0 flex list-none flex-col p-0">
            {list.map((a, i) => {
              const pct = [
                a.percentileGeneral !== undefined ? `ahead of ${formatAmount(a.percentileGeneral)}% of everyone` : '',
                a.percentilePractitioners !== undefined ? `${formatAmount(a.percentilePractitioners)}% of people who practise it` : '',
              ]
                .filter(Boolean)
                .join(', ');
              return (
                <li key={a.id} className={`flex flex-col gap-0.5 py-2 ${i ? 'border-t border-faint' : ''}`}>
                  <span className="flex items-baseline gap-3">
                    <span className="w-14 shrink-0 text-mid">{formatShortDate(toDayKey(new Date(a.createdAt)))}</span>
                    <span>
                      {formatSkillLevel(a.level)}, {skillBand(a.level).toLowerCase()}
                    </span>
                  </span>
                  {pct ? <span className="pl-[68px] text-mid">{pct}</span> : null}
                  {a.reasoning ? <span className="pl-[68px] text-mid">{a.reasoning}</span> : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </section>
  );
}
