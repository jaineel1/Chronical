import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { timetableRepo } from '@/data/repo';
import { TIMETABLE_PRESETS, type TimetableDraft, type TimetablePreset } from '@/data/timetablePresets';
import type { TimetableEntry, TimetableKind } from '@/data/types';
import { HATCH, KIND_CLASS } from '@/features/now/blockStyle';
import { formatMinute, layoutLanes, parseTime } from '@/lib/schedule/schedule';
import { Button, Chip, Empty, Field, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { plural } from './format';
import { VaultPage } from './VaultPage';

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const DAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const KINDS: readonly TimetableKind[] = ['class', 'lab', 'break', 'minor'];

const DEFAULT_FIRST = 8 * 60;
const DEFAULT_LAST = 18 * 60;
/** Pixels per 30-minute row. */
const ROW_PX = 28;
const PPM = ROW_PX / 30;
const GUTTER = 36;

interface Draft {
  title: string;
  kind: TimetableKind;
  room: string;
  teacher: string;
  code: string;
  day: number;
  start: string;
  end: string;
  from: string;
  to: string;
}

function draftFrom(e: TimetableEntry | undefined, day = 1): Draft {
  return {
    title: e?.title ?? '',
    kind: e?.kind ?? 'class',
    room: e?.room ?? '',
    teacher: e?.teacher ?? '',
    code: e?.code ?? '',
    day: e?.day ?? day,
    start: e?.start ?? '09:00',
    end: e?.end ?? '09:55',
    from: e?.from ?? '',
    to: e?.to ?? '',
  };
}

/** The draft as a row, or the first thing wrong with it. */
function validate(d: Draft): { ok: true; value: TimetableDraft } | { ok: false; error: string } {
  const title = d.title.trim();
  if (!title) return { ok: false, error: 'Give the slot a title.' };
  const start = parseTime(d.start);
  const end = parseTime(d.end);
  if (start === undefined) return { ok: false, error: 'Start needs a time like 09:00.' };
  if (end === undefined) return { ok: false, error: 'End needs a time like 09:55.' };
  if (end <= start) return { ok: false, error: 'End has to be after the start.' };
  if (d.from && d.to && d.to < d.from) return { ok: false, error: 'The last day is before the first day.' };
  const opt = (s: string) => (s.trim() === '' ? undefined : s.trim());
  return {
    ok: true,
    value: {
      day: d.day,
      start: formatMinute(start),
      end: formatMinute(end),
      title,
      kind: d.kind,
      room: opt(d.room),
      teacher: opt(d.teacher),
      code: opt(d.code),
      from: opt(d.from),
      to: opt(d.to),
    },
  };
}

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

const SELECT_CLASS = 'w-full border-0 border-b border-faint bg-transparent px-0 py-1 outline-none focus:border-ink';

function SlotEditor({ entry, initialDay, onDone }: { entry: TimetableEntry | undefined; initialDay: number; onDone: () => void }) {
  const [d, setD] = useState<Draft>(() => draftFrom(entry, initialDay));
  const [error, setError] = useState<string>();
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setD((prev) => ({ ...prev, [key]: value }));

  const save = () => {
    const result = validate(d);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError(undefined);
    const write = entry ? timetableRepo.update(entry.id, result.value) : timetableRepo.add(result.value).then(() => undefined);
    write.then(onDone, (e: unknown) => setError(errorText(e)));
  };

  const remove = () => {
    if (!entry) return;
    timetableRepo.remove(entry.id).then(onDone, (e: unknown) => setError(errorText(e)));
  };

  return (
    <div className="flex flex-col gap-3" data-testid="slot-editor">
      <Field label="Title">
        <TextInput value={d.title} onChange={(e) => set('title', e.target.value)} placeholder="Operating System" />
      </Field>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Kind">
        {KINDS.map((k) => (
          <Chip key={k} active={d.kind === k} onClick={() => set('kind', k)}>
            {k}
          </Chip>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Day">
          <select className={SELECT_CLASS} value={d.day} onChange={(e) => set('day', Number(e.target.value))}>
            {[1, 2, 3, 4, 5, 6, 0].map((n) => (
              <option key={n} value={n}>
                {DAY_LONG[n]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Start">
          <TextInput type="time" value={d.start} onChange={(e) => set('start', e.target.value)} />
        </Field>
        <Field label="End">
          <TextInput type="time" value={d.end} onChange={(e) => set('end', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Field label="Room">
          <TextInput value={d.room} onChange={(e) => set('room', e.target.value)} />
        </Field>
        <Field label="Teacher">
          <TextInput value={d.teacher} onChange={(e) => set('teacher', e.target.value)} />
        </Field>
        <Field label="Code">
          <TextInput value={d.code} onChange={(e) => set('code', e.target.value)} />
        </Field>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Field label="From" hint="First day it applies. Leave empty for no start.">
          <TextInput type="date" value={d.from} onChange={(e) => set('from', e.target.value)} />
        </Field>
        <Field label="To" hint="Last day it applies. Leave empty for no end.">
          <TextInput type="date" value={d.to} onChange={(e) => set('to', e.target.value)} />
        </Field>
      </div>
      {error ? (
        <span className="text-red" role="alert">
          {error}
        </span>
      ) : null}
      <div className="flex items-center gap-4">
        <Button variant="outline" onClick={save}>
          {entry ? 'Save changes' : 'Save slot'}
        </Button>
        <Button variant="text" onClick={onDone}>
          Cancel
        </Button>
        {entry ? (
          <Button variant="text" className="ml-auto" onClick={remove}>
            Delete slot
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function Grid({ entries, selectedId, onSelect }: { entries: TimetableEntry[]; selectedId: string | undefined; onSelect: (id: string) => void }) {
  const valid = entries.flatMap((e) => {
    const s = parseTime(e.start);
    const t = parseTime(e.end);
    return s === undefined || t === undefined || t <= s ? [] : [{ entry: e, startMin: s, endMin: t }];
  });
  const first = Math.min(DEFAULT_FIRST, ...valid.map((v) => Math.floor(v.startMin / 30) * 30));
  const last = Math.max(DEFAULT_LAST, ...valid.map((v) => Math.ceil(v.endMin / 30) * 30));
  const days = [1, 2, 3, 4, 5, 6, ...(valid.some((v) => v.entry.day === 0) ? [0] : [])];
  const rows = (last - first) / 30;
  const height = rows * ROW_PX;

  return (
    <div className="overflow-x-auto" data-testid="timetable-grid">
      <div style={{ minWidth: 520 }}>
        <div className="flex" style={{ paddingLeft: GUTTER }}>
          {days.map((n) => (
            <div key={n} className="flex-1 border-b border-faint py-1 text-center text-mid">
              {DAY_NAMES[n]}
            </div>
          ))}
        </div>
        <div className="relative" style={{ height }}>
          {Array.from({ length: rows + 1 }, (_, i) => (
            <div key={i} aria-hidden="true" className="absolute left-0 right-0" style={{ top: i * ROW_PX }}>
              <div className={i % 2 === 0 ? 'hairline' : 'border-t border-dotted border-faint'} />
              {i % 2 === 0 ? <span className="absolute left-0 top-0 -translate-y-1/2 bg-paper pr-1 text-[12px] text-mid">{formatMinute(first + i * 30)}</span> : null}
            </div>
          ))}
          {days.map((n, col) => {
            const mine = valid.filter((v) => v.entry.day === n);
            const lanes = layoutLanes(mine.map((v) => ({ id: v.entry.id, startMin: v.startMin, endMin: v.endMin })), 20 / PPM);
            return (
              <div key={n} className="absolute top-0 bottom-0" style={{ left: `calc(${GUTTER}px + (100% - ${GUTTER}px) * ${col} / ${days.length})`, width: `calc((100% - ${GUTTER}px) / ${days.length})` }}>
                {mine.map((v) => {
                  const l = lanes.get(v.entry.id) ?? { lane: 0, lanes: 1 };
                  const h = Math.max(18, (v.endMin - v.startMin) * PPM - 1);
                  return (
                    <button
                      key={v.entry.id}
                      type="button"
                      aria-label={`${DAY_LONG[n]}, ${v.entry.title}, ${v.entry.start} to ${v.entry.end}`}
                      aria-pressed={v.entry.id === selectedId}
                      onClick={() => onSelect(v.entry.id)}
                      className={`absolute box-border cursor-pointer overflow-hidden border border-faint px-1 text-left text-[12px] leading-[14px] ${KIND_CLASS[v.entry.kind]} ${v.entry.id === selectedId ? 'outline outline-2 outline-ink' : ''}`}
                      style={{
                        top: (v.startMin - first) * PPM,
                        height: h,
                        left: `${(l.lane / l.lanes) * 100}%`,
                        width: `calc(${100 / l.lanes}% - 1px)`,
                        ...(v.entry.kind === 'break' ? HATCH : {}),
                      }}
                    >
                      <span className="block break-words">{v.entry.title}</span>
                      {h >= 44 && v.entry.room ? <span className="block text-mid">{v.entry.room}</span> : null}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PresetRow({ preset, existing }: { preset: TimetablePreset; existing: number }) {
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string>();
  const load = () => {
    timetableRepo.replaceAll(preset.entries).then(
      () => {
        setAsking(false);
        setError(undefined);
      },
      (e: unknown) => setError(errorText(e)),
    );
  };
  return (
    <div className="flex flex-col gap-1.5 py-2" data-testid="preset">
      <span>{preset.title}</span>
      <span className="text-mid">{`${preset.sub} ${plural(preset.entries.length, 'slot')}.`}</span>
      {asking ? (
        <div className="flex flex-col gap-2">
          <span>{existing > 0 ? `This replaces your ${plural(existing, 'slot')} with these ${preset.entries.length}.` : `This adds these ${preset.entries.length} slots.`}</span>
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={load}>
              {existing > 0 ? 'Replace my timetable' : 'Load it'}
            </Button>
            <Button variant="text" onClick={() => setAsking(false)}>
              Keep what I have
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="outline" className="self-start" onClick={() => setAsking(true)}>
          Load a preset
        </Button>
      )}
      {error ? (
        <span className="text-red" role="alert">
          {error}
        </span>
      ) : null}
    </div>
  );
}

/** /vault/timetable: the weekly grid, an editor under it, and one-tap presets. */
export function TimetableScreen() {
  const entries = useLiveQuery(() => timetableRepo.list(), []);
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const selected = entries?.find((e) => e.id === editing);
  const close = () => setEditing(null);

  return (
    <VaultPage title="Timetable" meta={entries ? plural(entries.length, 'slot') : undefined} wide>
      <div className="grid grid-cols-1 gap-x-10 gap-y-2 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className="flex min-w-0 flex-col gap-2">
      <SectionHeader
        title="Week"
        action={
          <Button size="md" onClick={() => setEditing('new')}>
            Add a slot
          </Button>
        }
      />
      <Section>
        {entries === undefined ? null : entries.length === 0 ? (
          <Empty>Add your first slot, or load a preset below. Classes, labs and breaks show up on Now and Morning.</Empty>
        ) : null}
        {entries === undefined ? null : <Grid entries={entries} selectedId={selected?.id} onSelect={setEditing} />}
      </Section>
      </div>

      <div className="flex min-w-0 flex-col gap-2">
      {editing === 'new' || selected ? (
        <>
          <SectionHeader title={selected ? 'Edit slot' : 'New slot'} note={selected ? `${DAY_LONG[selected.day]}, ${selected.start}-${selected.end}` : undefined} />
          <Section>
            <SlotEditor key={selected?.id ?? 'new'} entry={selected} initialDay={1} onDone={close} />
          </Section>
        </>
      ) : null}

      <SectionHeader title="Presets" />
      <Section className="gap-0">
        {entries === undefined ? null : TIMETABLE_PRESETS.map((p) => <PresetRow key={p.id} preset={p} existing={entries.length} />)}
      </Section>
      </div>
      </div>
    </VaultPage>
  );
}
