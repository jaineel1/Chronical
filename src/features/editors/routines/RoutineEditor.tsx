import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { routineRepo } from '@/data/repo';
import { PILLARS, PILLAR_LABEL, SUBSTATS, pillarFromLabel, type Pillar, type Routine } from '@/data/types';
import { Button, Chip, Field, SectionHeader, TextInput } from '@/ui/primitives';
import { Missing } from '../lib/Missing';
import { routineOrderRepo } from '../lib/repos';
import { DAY_LONG, DAY_SHORT, WEEK_ORDER, cleanDays, daysText, normalizeWindow } from '../lib/routines';
import { ChipChoice, ChoiceGroup, ConfirmAction, ErrorText, SaveBar, Select, useGoBack } from '../lib/ui';
import { useDraft } from '../lib/useDraft';
import { useGoals, useRoutine } from '../queries';

interface RoutineForm {
  name: string;
  pillar: Pillar | '';
  subStat: string;
  weight: number;
  days: number[];
  window: string;
  upside: string;
  cost: string;
  goalId: string;
}

type Errors = Partial<Record<keyof RoutineForm, string>>;

function toForm(r: Routine | null, pillar: Pillar | ''): RoutineForm {
  return {
    name: r?.name ?? '',
    pillar: r?.pillar ?? pillar,
    subStat: r?.subStat ?? '',
    weight: r?.weight ?? 2,
    days: r?.days ?? [],
    window: r?.window ?? '',
    upside: r?.upside ?? '',
    cost: r?.cost ?? '',
    goalId: r?.goalId ?? '',
  };
}

function validate(f: RoutineForm): Errors {
  const e: Errors = {};
  if (!f.name.trim()) e.name = 'Give it a name.';
  if (!f.pillar) e.pillar = 'Pick the pillar it feeds.';
  else if (!SUBSTATS[f.pillar].includes(f.subStat)) e.subStat = 'Pick the sub-stat it trains.';
  if (normalizeWindow(f.window) === null) e.window = 'Use HH:MM-HH:MM, like 06:00-07:30.';
  if (!f.upside.trim()) e.upside = 'Write what doing it buys you.';
  if (!f.cost.trim()) e.cost = 'Write what a miss costs.';
  return e;
}

function daysHint(days: readonly number[]): string {
  const n = new Set(days).size;
  if (n === 0) return 'daily, none picked means every day';
  if (n === 7) return 'daily';
  return `${daysText(days)}, ${n} ${n === 1 ? 'day' : 'days'} a week`;
}

const LABELS: Record<keyof RoutineForm, string> = {
  name: 'name',
  pillar: 'pillar',
  subStat: 'sub-stat',
  weight: 'weight',
  days: 'days',
  window: 'time window',
  upside: 'upside',
  cost: 'cost',
  goalId: 'goal',
};

export function RoutineEditor() {
  const { id } = useParams();
  const row = useRoutine(id);
  useShellBar(id ? 'Edit routine' : 'New routine');
  if (row === undefined) return <Page>{null}</Page>;
  if (id && row === null) return <Missing what="routine" back="/edit/routines" />;
  return <RoutineFormView key={id ?? 'new'} row={row} />;
}

function RoutineFormView({ row }: { row: Routine | null }) {
  const [params] = useSearchParams();
  const startPillar = pillarFromLabel(params.get('pillar') ?? '') ?? '';
  const live = useMemo(() => toForm(row, startPillar), [row, startPillar]);
  const [draft, set] = useDraft(live);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const goals = useGoals();
  const goBack = useGoBack('/edit/routines');
  const navigate = useNavigate();
  const errors = tried ? validate(draft) : {};
  const missing = (Object.keys(errors) as (keyof RoutineForm)[]).map((k) => LABELS[k]);

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (Object.keys(validate(draft)).length || !draft.pillar) return;
    setSaving(true);
    try {
      const fields = {
        name: draft.name.trim(),
        pillar: draft.pillar,
        subStat: draft.subStat,
        weight: draft.weight,
        days: cleanDays(draft.days),
        window: normalizeWindow(draft.window) || undefined,
        upside: draft.upside.trim(),
        cost: draft.cost.trim(),
        goalId: draft.goalId || undefined,
      };
      if (row) await routineRepo.update(row.id, fields);
      else await routineRepo.create({ ...fields, streak: 0, shields: 1, archived: false, sortOrder: await routineOrderRepo.nextSortOrder() });
      goBack();
    } finally {
      setSaving(false);
    }
  }

  const goalOptions = (goals ?? []).filter((g) => g.status === 'active' || g.id === draft.goalId);

  return (
    <Page>
      <form onSubmit={save} noValidate className="flex flex-col gap-2" aria-label={row ? `Edit ${row.name}` : 'New routine'}>
        <SectionHeader title={row ? row.name : 'New routine'} note={row?.archived ? 'archived' : 'real upside, real cost'} />
        <div className="flex flex-col gap-4 px-2.5 pt-1 pb-3">
          {row?.archived ? (
            <div className="flex items-center justify-between gap-3 border border-dashed border-faint p-3">
              <span className="text-mid">Archived. It is off tonight's list; its streak and logs are kept.</span>
              <Button type="button" variant="outline" onClick={() => routineOrderRepo.restore(row.id)}>
                Restore
              </Button>
            </div>
          ) : null}

          <Field label="Name">
            <TextInput value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="Run, 8 km at 5:52" aria-invalid={!!errors.name} />
            {errors.name ? <ErrorText>{errors.name}</ErrorText> : null}
          </Field>

          <ChoiceGroup label="Pillar" error={errors.pillar}>
            <ChipChoice
              options={PILLARS}
              value={draft.pillar || undefined}
              render={(p) => PILLAR_LABEL[p]}
              onChange={(p) => set(p === draft.pillar ? { pillar: p } : { pillar: p, subStat: '' })}
            />
          </ChoiceGroup>

          <ChoiceGroup label="Sub-stat it trains" hint={draft.pillar ? undefined : 'Pick a pillar first.'} error={errors.subStat}>
            {draft.pillar ? <ChipChoice options={SUBSTATS[draft.pillar]} value={draft.subStat || undefined} onChange={(s) => set({ subStat: s })} /> : null}
          </ChoiceGroup>

          <ChoiceGroup label="Weight" hint="A done day adds this to the pillar; a miss takes off half.">
            <ChipChoice options={[1, 2, 3, 4, 5] as const} value={draft.weight} onChange={(w) => set({ weight: w })} />
          </ChoiceGroup>

          <div role="group" aria-labelledby="routine-days" className="flex flex-col gap-1">
            <span id="routine-days" className="text-mid">
              Days
            </span>
            <div className="flex flex-wrap gap-1">
              {WEEK_ORDER.map((d) => (
                <span key={d} title={DAY_LONG[d]}>
                  <Chip active={draft.days.includes(d)} onClick={() => set({ days: draft.days.includes(d) ? draft.days.filter((x) => x !== d) : [...draft.days, d] })}>
                    {DAY_SHORT[d]}
                  </Chip>
                </span>
              ))}
            </div>
            <span className="text-mid">{daysHint(draft.days)}</span>
          </div>

          <Field label="Time window, optional" hint="Shown as a hint on the night log.">
            <TextInput value={draft.window} onChange={(e) => set({ window: e.target.value })} placeholder="06:00-07:30" inputMode="numeric" aria-invalid={!!errors.window} />
            {errors.window ? <ErrorText>{errors.window}</ErrorText> : null}
          </Field>

          <Field label="Upside" hint="What doing it buys you in real life, like “Squat 80 kg arrives on schedule”.">
            <TextInput value={draft.upside} onChange={(e) => set({ upside: e.target.value })} placeholder="Keeps the sub-4 plan on track" aria-invalid={!!errors.upside} />
            {errors.upside ? <ErrorText>{errors.upside}</ErrorText> : null}
          </Field>

          <Field label="Cost of a miss" hint="What skipping it really costs, like “each miss adds about 4 days to the 80 kg date”.">
            <TextInput value={draft.cost} onChange={(e) => set({ cost: e.target.value })} placeholder="A missed week costs about 10 seconds a kilometre" aria-invalid={!!errors.cost} />
            {errors.cost ? <ErrorText>{errors.cost}</ErrorText> : null}
          </Field>

          <Field label="Goal it serves, optional">
            <Select value={draft.goalId} onChange={(e) => set({ goalId: e.target.value })}>
              <option value="">No goal</option>
              {PILLARS.map((p) => {
                const list = goalOptions.filter((g) => g.pillar === p);
                return list.length ? (
                  <optgroup key={p} label={PILLAR_LABEL[p]}>
                    {list.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.title}
                      </option>
                    ))}
                  </optgroup>
                ) : null;
              })}
            </Select>
          </Field>
        </div>
        <SaveBar onBack={goBack} saving={saving} note={missing.length ? <ErrorText>Still missing: {missing.join(', ')}.</ErrorText> : null} />
      </form>

      {row && !row.archived ? (
        <div className="px-2.5 pt-6">
          <ConfirmAction
            label="Archive this routine"
            question={`Archive ${row.name}? It leaves tonight's list. Its streak and logs are kept, and you can restore it from the list.`}
            confirmLabel="Archive"
            onConfirm={async () => {
              await routineOrderRepo.archive(row.id);
              navigate('/edit/routines', { replace: true });
            }}
          />
        </div>
      ) : null}
    </Page>
  );
}
