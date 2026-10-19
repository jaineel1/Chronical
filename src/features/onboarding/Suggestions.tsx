/**
 * Review lists for what Claude suggested: skills, routines and goals, each checked by default,
 * names editable, the key fields visible and adjustable (skill level; routine weight and sub-stat;
 * goal pillar). Used by /onboarding/review and by the Vault's "Run the origin prompt again".
 */
import { useEffect, useMemo, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { PILLARS, PILLAR_LABEL, SUBSTATS, type Pillar } from '@/data/types';
import { fromDayKey } from '@/lib/dates';
import { formatDays, type OriginGoal, type OriginRoutine, type OriginSkill } from '@/lib/parse/origin';
import { Check, Section, SectionHeader, TextInput } from '@/ui/primitives';
import type { Accepted } from './createGame';
import { Select } from './ui';

export interface Keepable<T> {
  keep: boolean;
  value: T;
}

export interface SuggestionSource {
  skills: OriginSkill[];
  routines: OriginRoutine[];
  goals: OriginGoal[];
}

export interface SuggestionState {
  skills: Keepable<OriginSkill>[];
  routines: Keepable<OriginRoutine>[];
  goals: Keepable<OriginGoal>[];
  setSkills: Dispatch<SetStateAction<Keepable<OriginSkill>[]>>;
  setRoutines: Dispatch<SetStateAction<Keepable<OriginRoutine>[]>>;
  setGoals: Dispatch<SetStateAction<Keepable<OriginGoal>[]>>;
  /** Checked rows with a non-empty name, trimmed. */
  accepted: Accepted;
  acceptedCount: number;
}

const keepAll = <T,>(list: T[]): Keepable<T>[] => list.map((value) => ({ keep: true, value }));

export function useSuggestions(src: SuggestionSource): SuggestionState {
  const [skills, setSkills] = useState(() => keepAll(src.skills));
  const [routines, setRoutines] = useState(() => keepAll(src.routines));
  const [goals, setGoals] = useState(() => keepAll(src.goals));
  const accepted = useMemo<Accepted>(
    () => ({
      skills: skills.filter((i) => i.keep && i.value.name.trim()).map((i) => ({ ...i.value, name: i.value.name.trim() })),
      routines: routines.filter((i) => i.keep && i.value.name.trim()).map((i) => ({ ...i.value, name: i.value.name.trim() })),
      goals: goals.filter((i) => i.keep && i.value.title.trim()).map((i) => ({ ...i.value, title: i.value.title.trim() })),
    }),
    [skills, routines, goals],
  );
  const acceptedCount = accepted.skills.length + accepted.routines.length + accepted.goals.length;
  return { skills, routines, goals, setSkills, setRoutines, setGoals, accepted, acceptedCount };
}

function patchAt<T>(set: Dispatch<SetStateAction<Keepable<T>[]>>, index: number, patch: { keep?: boolean; value?: Partial<T> }) {
  set((list) =>
    list.map((it, i) => (i === index ? { keep: patch.keep ?? it.keep, value: patch.value ? { ...it.value, ...patch.value } : it.value } : it)),
  );
}

/** "30 Nov 2026" */
function formatTarget(key: string): string {
  const d = fromDayKey(key);
  return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${d.getFullYear()}`;
}

/** Whole number input that lets the field be cleared while typing and snaps back on blur. */
function IntInput({ value, min, max, onChange, label }: { value: number; min: number; max: number; onChange: (n: number) => void; label: string }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  return (
    <TextInput
      type="number"
      inputMode="numeric"
      min={min}
      max={max}
      aria-label={label}
      value={text}
      className="text-right [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
      onChange={(e) => {
        setText(e.target.value);
        const n = Math.round(Number(e.target.value));
        if (e.target.value.trim() !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
      }}
      onBlur={() => setText(String(value))}
    />
  );
}

function RowShell({ keep, onKeep, label, children }: { keep: boolean; onKeep: (v: boolean) => void; label: string; children: ReactNode }) {
  return (
    <div className={`flex items-start gap-3 ${keep ? '' : 'opacity-50'}`}>
      <span className="flex pt-[8px]">
        <Check checked={keep} onChange={(e) => onKeep(e.target.checked)} aria-label={`Keep ${label}`} />
      </span>
      <div className="flex min-w-0 flex-1 flex-col gap-1">{children}</div>
    </div>
  );
}

export function SuggestionLists({ state, emptyNote }: { state: SuggestionState; emptyNote?: string }) {
  const { skills, routines, goals, setSkills, setRoutines, setGoals } = state;
  const kept = <T,>(list: Keepable<T>[]) => `${list.filter((i) => i.keep).length} of ${list.length} kept`;

  if (skills.length + routines.length + goals.length === 0) {
    return emptyNote ? <p className="px-2.5 text-mid">{emptyNote}</p> : null;
  }

  return (
    <div className="flex flex-col gap-2" data-testid="suggestions">
      {skills.length ? (
        <>
          <SectionHeader title="Skills" note={kept(skills)} />
          <Section className="gap-4 pb-2">
            {skills.map((it, i) => (
              <RowShell key={i} keep={it.keep} onKeep={(keep) => patchAt(setSkills, i, { keep })} label={it.value.name}>
                <div className="flex items-baseline gap-3">
                  <TextInput aria-label="Skill name" className="font-serif" value={it.value.name} onChange={(e) => patchAt(setSkills, i, { value: { name: e.target.value } })} />
                  <span className="flex shrink-0 items-baseline gap-1.5">
                    <span className="text-mid">level</span>
                    <span className="w-10">
                      <IntInput label={`${it.value.name} level`} value={it.value.level} min={1} max={100} onChange={(level) => patchAt(setSkills, i, { value: { level } })} />
                    </span>
                  </span>
                </div>
                <span className="text-mid">
                  {PILLAR_LABEL[it.value.pillar]}
                  {it.value.why ? ` · ${it.value.why}` : ''}
                </span>
              </RowShell>
            ))}
          </Section>
        </>
      ) : null}

      {routines.length ? (
        <>
          <SectionHeader title="Routines" note={kept(routines)} />
          <Section className="gap-4 pb-2">
            {routines.map((it, i) => {
              const r = it.value;
              return (
                <RowShell key={i} keep={it.keep} onKeep={(keep) => patchAt(setRoutines, i, { keep })} label={r.name}>
                  <div className="flex items-baseline gap-3">
                    <TextInput aria-label="Routine name" className="font-serif" value={r.name} onChange={(e) => patchAt(setRoutines, i, { value: { name: e.target.value } })} />
                    <span className="flex shrink-0 items-baseline gap-1.5">
                      <span className="text-mid">weight</span>
                      <Select aria-label={`${r.name} weight`} value={r.weight} onChange={(e) => patchAt(setRoutines, i, { value: { weight: Number(e.target.value) } })}>
                        {[1, 2, 3, 4, 5].map((w) => (
                          <option key={w} value={w}>
                            {w}
                          </option>
                        ))}
                      </Select>
                    </span>
                  </div>
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-mid">
                    <span>{PILLAR_LABEL[r.pillar]} /</span>
                    <Select aria-label={`${r.name} sub-stat`} value={r.subStat} className="text-mid" onChange={(e) => patchAt(setRoutines, i, { value: { subStat: e.target.value } })}>
                      {SUBSTATS[r.pillar].map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </Select>
                    <span>
                      · {formatDays(r.days)}
                      {r.window ? ` · ${r.window}` : ''}
                    </span>
                  </span>
                  {r.upside ? <span className="text-mid">{r.upside}</span> : null}
                  {r.cost ? <span className="text-mid">Miss: {r.cost}</span> : null}
                </RowShell>
              );
            })}
          </Section>
        </>
      ) : null}

      {goals.length ? (
        <>
          <SectionHeader title="Goals" note={kept(goals)} />
          <Section className="gap-4 pb-2">
            {goals.map((it, i) => {
              const g = it.value;
              return (
                <RowShell key={i} keep={it.keep} onKeep={(keep) => patchAt(setGoals, i, { keep })} label={g.title}>
                  <TextInput aria-label="Goal title" className="font-serif" value={g.title} onChange={(e) => patchAt(setGoals, i, { value: { title: e.target.value } })} />
                  <span className="flex flex-wrap items-baseline gap-x-1.5 text-mid">
                    <Select aria-label={`${g.title} pillar`} value={g.pillar} className="text-mid" onChange={(e) => patchAt(setGoals, i, { value: { pillar: e.target.value as Pillar } })}>
                      {PILLARS.map((p) => (
                        <option key={p} value={p}>
                          {PILLAR_LABEL[p]}
                        </option>
                      ))}
                    </Select>
                    <span>{g.targetDate ? `· by ${formatTarget(g.targetDate)}` : '· no date'}</span>
                  </span>
                  {g.why ? <span className="text-mid">{g.why}</span> : null}
                </RowShell>
              );
            })}
          </Section>
        </>
      ) : null}
    </div>
  );
}
