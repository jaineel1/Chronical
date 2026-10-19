import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { newId } from '@/data/ids';
import { PILLARS, PILLAR_LABEL, pillarFromLabel, type GoalStatus, type Pillar } from '@/data/types';
import { nowIso } from '@/lib/dates';
import { Button, Check, Field, SectionHeader, TextInput } from '@/ui/primitives';
import { LoreSection } from '../lib/LoreSection';
import { Missing } from '../lib/Missing';
import { goalProgressLabel } from '../lib/progress';
import { goalRepo, type MilestoneDraft, type VisionDraft } from '../lib/repos';
import { ChipChoice, ChoiceGroup, ConfirmAction, ErrorText, SaveBar, numberOrUndefined, useGoBack } from '../lib/ui';
import { useDraft } from '../lib/useDraft';
import { useGoalBundle, type GoalBundle } from '../queries';
import { ImagePicker } from './ImagePicker';

const STATUSES: readonly GoalStatus[] = ['active', 'paused', 'done'];

interface MilestoneRow {
  key: string;
  id?: string;
  title: string;
  metricName: string;
  target: string;
  current: string;
  unit: string;
  dueDate: string;
  done: boolean;
  doneAt?: string;
}

interface VisionRow {
  key: string;
  id?: string;
  title: string;
  gives: string;
  habitCost: string;
  imageDataUrl?: string;
  unlockedAt?: string;
}

interface GoalForm {
  title: string;
  pillar: Pillar | '';
  why: string;
  targetDate: string;
  status: GoalStatus;
  milestones: MilestoneRow[];
  vision: VisionRow[];
}

const str = (n: number | undefined) => (n === undefined ? '' : String(n));

function toForm(b: GoalBundle | null, pillar: Pillar | ''): GoalForm {
  return {
    title: b?.goal.title ?? '',
    pillar: b?.goal.pillar ?? pillar,
    why: b?.goal.why ?? '',
    targetDate: b?.goal.targetDate ?? '',
    status: b?.goal.status ?? 'active',
    milestones: (b?.milestones ?? []).map((m) => ({
      key: m.id,
      id: m.id,
      title: m.title,
      metricName: m.metricName ?? '',
      target: str(m.target),
      current: str(m.current),
      unit: m.unit ?? '',
      dueDate: m.dueDate ?? '',
      done: !!m.doneAt,
      doneAt: m.doneAt,
    })),
    vision: (b?.vision ?? []).map((v) => ({
      key: v.id,
      id: v.id,
      title: v.title,
      gives: v.gives,
      habitCost: v.habitCost,
      imageDataUrl: v.imageDataUrl,
      unlockedAt: v.unlockedAt,
    })),
  };
}

const emptyMilestone = (): MilestoneRow => ({ key: newId(), title: '', metricName: '', target: '', current: '', unit: '', dueDate: '', done: false });
const emptyVision = (): VisionRow => ({ key: newId(), title: '', gives: '', habitCost: '' });

const milestoneHasContent = (m: MilestoneRow) => !!(m.title.trim() || m.metricName.trim() || m.target.trim() || m.current.trim() || m.unit.trim() || m.dueDate || m.done);
const visionHasContent = (v: VisionRow) => !!(v.title.trim() || v.gives.trim() || v.habitCost.trim() || v.imageDataUrl);

interface GoalErrors {
  title?: string;
  pillar?: string;
  milestones: Record<string, string>;
  vision: Record<string, string>;
}

function validate(f: GoalForm): GoalErrors {
  const e: GoalErrors = { milestones: {}, vision: {} };
  if (!f.title.trim()) e.title = 'Give the goal a name.';
  if (!f.pillar) e.pillar = 'Pick the region it belongs to.';
  for (const m of f.milestones) {
    if (!milestoneHasContent(m)) continue;
    if (!m.title.trim()) e.milestones[m.key] = 'Give this milestone a title.';
    else if ((m.target.trim() && numberOrUndefined(m.target) === undefined) || (m.current.trim() && numberOrUndefined(m.current) === undefined))
      e.milestones[m.key] = 'Now and target take numbers, like 22 or 7.5.';
  }
  for (const v of f.vision) {
    if (visionHasContent(v) && !v.title.trim()) e.vision[v.key] = 'Give it a title.';
  }
  return e;
}

function deleteQuestion(title: string, milestones: number): string {
  const what = milestones ? ` and its ${milestones === 1 ? 'milestone' : `${milestones} milestones`}` : '';
  return `Delete ${title}${what}? Routines and vision items that point at it are kept, unlinked.`;
}

function errorCount(e: GoalErrors): number {
  return (e.title ? 1 : 0) + (e.pillar ? 1 : 0) + Object.keys(e.milestones).length + Object.keys(e.vision).length;
}

export function GoalEditor() {
  const { id } = useParams();
  const bundle = useGoalBundle(id);
  useShellBar(id ? 'Edit goal' : 'New goal');
  if (bundle === undefined) return <Page>{null}</Page>;
  if (id && bundle === null) return <Missing what="goal" back="/edit/goals" />;
  return <GoalFormView key={id ?? 'new'} bundle={bundle} />;
}

function GoalFormView({ bundle }: { bundle: GoalBundle | null }) {
  const [params] = useSearchParams();
  const startPillar = pillarFromLabel(params.get('pillar') ?? '') ?? '';
  const live = useMemo(() => toForm(bundle, startPillar), [bundle, startPillar]);
  const [draft, set] = useDraft(live);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const goBack = useGoBack('/edit/goals');
  const navigate = useNavigate();
  const errors = tried ? validate(draft) : { milestones: {}, vision: {} };
  const goal = bundle?.goal;

  const setMilestone = (key: string, patch: Partial<MilestoneRow>) => set({ milestones: draft.milestones.map((m) => (m.key === key ? { ...m, ...patch } : m)) });
  const setVision = (key: string, patch: Partial<VisionRow>) => set({ vision: draft.vision.map((v) => (v.key === key ? { ...v, ...patch } : v)) });

  const preview = goalProgressLabel(
    { status: draft.status },
    draft.milestones
      .filter(milestoneHasContent)
      .map((m) => ({ doneAt: m.done ? 'x' : undefined, target: numberOrUndefined(m.target), current: numberOrUndefined(m.current), unit: m.unit })),
  );

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (errorCount(validate(draft)) || !draft.pillar) return;
    setSaving(true);
    try {
      const milestones: MilestoneDraft[] = draft.milestones.filter(milestoneHasContent).map((m) => ({
        id: m.id,
        title: m.title.trim(),
        metricName: m.metricName.trim() || undefined,
        target: numberOrUndefined(m.target),
        current: numberOrUndefined(m.current),
        unit: m.unit.trim() || undefined,
        dueDate: m.dueDate || undefined,
        doneAt: m.done ? (m.doneAt ?? nowIso()) : undefined,
      }));
      const vision: VisionDraft[] = draft.vision.filter(visionHasContent).map((v) => ({
        id: v.id,
        title: v.title.trim(),
        gives: v.gives.trim(),
        habitCost: v.habitCost.trim(),
        imageDataUrl: v.imageDataUrl,
        unlockedAt: v.unlockedAt,
      }));
      await goalRepo.save(
        { id: goal?.id, title: draft.title.trim(), pillar: draft.pillar, why: draft.why.trim(), targetDate: draft.targetDate || undefined, status: draft.status },
        milestones,
        vision,
      );
      goBack();
    } finally {
      setSaving(false);
    }
  }

  const count = errorCount(errors);
  return (
    <Page>
      <form onSubmit={save} noValidate className="flex flex-col gap-2" aria-label={goal ? `Edit ${goal.title}` : 'New goal'}>
        <SectionHeader title={goal ? goal.title : 'New goal'} note={goal ? goal.status : 'a district on the map'} />
        <div className="flex flex-col gap-4 px-2.5 pt-1 pb-3">
          <Field label="Goal">
            <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Sub-4 marathon" aria-invalid={!!errors.title} />
            {errors.title ? <ErrorText>{errors.title}</ErrorText> : null}
          </Field>
          <ChoiceGroup label="Region" error={errors.pillar}>
            <ChipChoice options={PILLARS} value={draft.pillar || undefined} render={(p) => PILLAR_LABEL[p]} onChange={(p) => set({ pillar: p })} />
          </ChoiceGroup>
          <Field label="Why it matters" hint="One line you would say out loud.">
            <TextInput value={draft.why} onChange={(e) => set({ why: e.target.value })} placeholder="Proof that I can hold a hard thing for 22 weeks." />
          </Field>
          <Field label="Target date, optional">
            <TextInput type="date" value={draft.targetDate} onChange={(e) => set({ targetDate: e.target.value })} />
          </Field>
          <ChoiceGroup label="Status">
            <ChipChoice options={STATUSES} value={draft.status} onChange={(s) => set({ status: s })} />
          </ChoiceGroup>
        </div>

        <SectionHeader title="Milestones" note={`progress ${preview.label}`} />
        <div className="flex flex-col px-2.5 pb-3">
          {draft.milestones.length === 0 ? (
            <p className="m-0 py-2 text-mid">Add the steps that prove progress. A number and a target make the bar move on its own.</p>
          ) : null}
          <ol className="m-0 flex list-none flex-col p-0" aria-label="Milestones">
            {draft.milestones.map((m, i) => (
              <li key={m.key} className={`flex flex-col gap-3 py-3 ${i ? 'border-t border-faint' : ''}`}>
                <Field label={`Milestone ${i + 1}`}>
                  <TextInput value={m.title} onChange={(e) => setMilestone(m.key, { title: e.target.value })} placeholder="Half marathon under 1:55" />
                </Field>
                <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                  <Field label="Measure, optional">
                    <TextInput value={m.metricName} onChange={(e) => setMilestone(m.key, { metricName: e.target.value })} placeholder="long run" />
                  </Field>
                  <Field label="Unit">
                    <TextInput value={m.unit} onChange={(e) => setMilestone(m.key, { unit: e.target.value })} placeholder="km" />
                  </Field>
                  <Field label="Now">
                    <TextInput value={m.current} inputMode="decimal" onChange={(e) => setMilestone(m.key, { current: e.target.value })} placeholder="22" />
                  </Field>
                  <Field label="Target">
                    <TextInput value={m.target} inputMode="decimal" onChange={(e) => setMilestone(m.key, { target: e.target.value })} placeholder="30" />
                  </Field>
                  <Field label="Due, optional">
                    <TextInput type="date" value={m.dueDate} onChange={(e) => setMilestone(m.key, { dueDate: e.target.value })} />
                  </Field>
                  <label className="flex cursor-pointer items-center gap-2 self-end pb-1.5">
                    <Check checked={m.done} onChange={(e) => setMilestone(m.key, { done: e.target.checked })} />
                    <span>Done</span>
                  </label>
                </div>
                {errors.milestones[m.key] ? <ErrorText>{errors.milestones[m.key]}</ErrorText> : null}
                <button
                  type="button"
                  className="cursor-pointer self-start border-0 bg-transparent p-0 text-mid"
                  onClick={() => set({ milestones: draft.milestones.filter((x) => x.key !== m.key) })}
                >
                  Remove milestone {i + 1}
                </button>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" className="self-start" onClick={() => set({ milestones: [...draft.milestones, emptyMilestone()] })}>
            Add a milestone
          </Button>
        </div>

        <SectionHeader title="Vision" note="what reaching it buys" />
        <div className="flex flex-col px-2.5 pb-3">
          {draft.vision.length === 0 ? <p className="m-0 py-2 text-mid">Picture what this goal buys you, and what it costs in routines.</p> : null}
          <ol className="m-0 flex list-none flex-col p-0" aria-label="Vision items">
            {draft.vision.map((v, i) => (
              <li key={v.key} className={`flex flex-col gap-3 py-3 ${i ? 'border-t border-faint' : ''}`}>
                <Field label="Picture">
                  <TextInput value={v.title} onChange={(e) => setVision(v.key, { title: e.target.value })} placeholder="Finisher medal, under four hours" />
                </Field>
                <Field label="What it gives you">
                  <TextInput value={v.gives} onChange={(e) => setVision(v.key, { gives: e.target.value })} placeholder="Proof I can hold a 22-week plan" />
                </Field>
                <Field label="What it costs in routines">
                  <TextInput value={v.habitCost} onChange={(e) => setVision(v.key, { habitCost: e.target.value })} placeholder="Run 4 mornings a week" />
                </Field>
                <ImagePicker value={v.imageDataUrl} onChange={(url) => setVision(v.key, { imageDataUrl: url })} />
                {errors.vision[v.key] ? <ErrorText>{errors.vision[v.key]}</ErrorText> : null}
                <button
                  type="button"
                  className="cursor-pointer self-start border-0 bg-transparent p-0 text-mid"
                  onClick={() => set({ vision: draft.vision.filter((x) => x.key !== v.key) })}
                >
                  Remove from the vision board
                </button>
              </li>
            ))}
          </ol>
          <Button type="button" variant="outline" className="self-start" onClick={() => set({ vision: [...draft.vision, emptyVision()] })}>
            Add a vision
          </Button>
        </div>

        <SaveBar onBack={goBack} saving={saving} note={count ? <ErrorText>{count === 1 ? 'One thing to fix above.' : `${count} things to fix above.`}</ErrorText> : null} />
      </form>

      {goal ? (
        <>
          <div className="pt-4">
            <LoreSection type="goal" itemId={goal.id} />
          </div>
          <div className="px-2.5 pt-6">
            <ConfirmAction
              label="Delete this goal"
              question={deleteQuestion(goal.title, bundle?.milestones.length ?? 0)}
              confirmLabel="Delete"
              onConfirm={async () => {
                await goalRepo.remove(goal.id);
                navigate('/edit/goals', { replace: true });
              }}
            />
          </div>
        </>
      ) : null}
    </Page>
  );
}
