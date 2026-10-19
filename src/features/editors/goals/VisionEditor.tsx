import { useMemo, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { PILLARS, PILLAR_LABEL, type VisionItem } from '@/data/types';
import { Field, SectionHeader, TextInput } from '@/ui/primitives';
import { Missing } from '../lib/Missing';
import { visionRepo } from '../lib/repos';
import { ConfirmAction, ErrorText, SaveBar, Select, useGoBack } from '../lib/ui';
import { useDraft } from '../lib/useDraft';
import { useGoals, useVisionItem } from '../queries';
import { ImagePicker } from './ImagePicker';

interface VisionForm {
  title: string;
  gives: string;
  habitCost: string;
  imageDataUrl?: string;
  goalId: string;
}

function toForm(v: VisionItem | null): VisionForm {
  return { title: v?.title ?? '', gives: v?.gives ?? '', habitCost: v?.habitCost ?? '', imageDataUrl: v?.imageDataUrl, goalId: v?.goalId ?? '' };
}

export function VisionEditor() {
  const { id } = useParams();
  const row = useVisionItem(id);
  useShellBar(id ? 'Edit vision' : 'New vision');
  if (row === undefined) return <Page>{null}</Page>;
  if (id && row === null) return <Missing what="vision" back="/edit/goals" />;
  return <VisionFormView key={id ?? 'new'} row={row} />;
}

function VisionFormView({ row }: { row: VisionItem | null }) {
  const live = useMemo(() => toForm(row), [row]);
  const [draft, set] = useDraft(live);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const goals = useGoals();
  const goBack = useGoBack('/map');
  const navigate = useNavigate();
  const titleError = tried && !draft.title.trim() ? 'Give it a title.' : undefined;

  async function save(e: FormEvent) {
    e.preventDefault();
    setTried(true);
    if (!draft.title.trim()) return;
    setSaving(true);
    try {
      const fields = {
        title: draft.title.trim(),
        gives: draft.gives.trim(),
        habitCost: draft.habitCost.trim(),
        imageDataUrl: draft.imageDataUrl,
        goalId: draft.goalId || undefined,
      };
      if (row) await visionRepo.update(row.id, fields);
      else await visionRepo.create(fields);
      goBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <Page>
      <form onSubmit={save} noValidate className="flex flex-col gap-2" aria-label={row ? `Edit ${row.title}` : 'New vision'}>
        <SectionHeader title={row ? row.title : 'Vision board'} note="what a goal buys" />
        <div className="flex flex-col gap-4 px-2.5 pt-1 pb-3">
          <Field label="Picture" hint="Something you can see: a medal, a room, a morning.">
            <TextInput value={draft.title} onChange={(e) => set({ title: e.target.value })} placeholder="Skin I do not think about" aria-invalid={!!titleError} />
            {titleError ? <ErrorText>{titleError}</ErrorText> : null}
          </Field>
          <Field label="What it gives you">
            <TextInput value={draft.gives} onChange={(e) => set({ gives: e.target.value })} placeholder="Walk in without checking the mirror" />
          </Field>
          <Field label="What it costs in routines" hint="The habits that pay for it, so the picture keeps its price tag.">
            <TextInput value={draft.habitCost} onChange={(e) => set({ habitCost: e.target.value })} placeholder="Evening routine, sunscreen daily" />
          </Field>
          <ImagePicker value={draft.imageDataUrl} onChange={(url) => set({ imageDataUrl: url })} />
          <Field label="Goal, optional">
            <Select value={draft.goalId} onChange={(e) => set({ goalId: e.target.value })}>
              <option value="">No goal yet</option>
              {PILLARS.map((p) => {
                const list = (goals ?? []).filter((g) => g.pillar === p && (g.status !== 'paused' || g.id === draft.goalId));
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
        <SaveBar onBack={goBack} saving={saving} note={titleError ? <ErrorText>Still missing: a title.</ErrorText> : null} />
      </form>
      {row ? (
        <div className="px-2.5 pt-6">
          <ConfirmAction
            label="Take it off the board"
            question={`Remove ${row.title} from the vision board?`}
            confirmLabel="Remove"
            onConfirm={async () => {
              await visionRepo.remove(row.id);
              navigate('/map', { replace: true });
            }}
          />
        </div>
      ) : null}
    </Page>
  );
}
