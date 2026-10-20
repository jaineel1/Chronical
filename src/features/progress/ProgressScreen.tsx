import { useMemo, useRef, useState } from 'react';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { useProfile } from '@/data/hooks';
import { photoRepo } from '@/data/repo';
import type { Photo, PhotoAngle, Profile } from '@/data/types';
import { DEFAULT_ROLLOVER_HOUR, daysBetween, formatLongDate, todayKey } from '@/lib/dates';
import { dayNoFor } from '@/lib/game/calendar';
import { PHOTO_ANGLES, shrinkImage } from '@/lib/photos';
import { Button, Chip, Empty, Section, SectionHeader } from '@/ui/primitives';
import { ANGLE_LABEL, PhotoImage } from './PhotoImage';
import { useLatestWeight, usePhotos } from './queries';

const DANGER = 'cursor-pointer border-0 bg-transparent p-0 text-red disabled:cursor-default disabled:opacity-50';

function n1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/** /progress: progress photos by date, with weight, and any two side by side. */
export function ProgressScreen() {
  const profile = useProfile();
  const photos = usePhotos();
  const rollover = profile?.settings.rolloverHour ?? DEFAULT_ROLLOVER_HOUR;
  const today = todayKey(rollover);
  const weight = useLatestWeight(today);
  const [angle, setAngle] = useState<PhotoAngle>('front');
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const fileRef = useRef<HTMLInputElement>(null);

  const days = useMemo(() => {
    const byDate = new Map<string, Photo[]>();
    for (const p of photos ?? []) byDate.set(p.date, [...(byDate.get(p.date) ?? []), p]);
    return [...byDate.entries()].map(([date, list]) => ({ date, list: [...list].sort((a, b) => PHOTO_ANGLES.indexOf(a.angle) - PHOTO_ANGLES.indexOf(b.angle)) }));
  }, [photos]);

  useShellBar('Progress', photos ? `${days.length} photo ${days.length === 1 ? 'day' : 'days'}` : undefined);
  if (!profile || !photos || weight === undefined) return <Page>{null}</Page>;

  async function addPhoto(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(undefined);
    try {
      const shrunk = await shrinkImage(file);
      // The weight goes with the photo only when it was logged within the last three days.
      const kg = weight && daysBetween(weight.date, today) <= 3 ? weight.kg : undefined;
      await photoRepo.add({ date: today, angle, ...shrunk, weightKg: kg });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  function toggle(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s.slice(-1), id]));
  }

  async function remove(id: string) {
    setSelected([]);
    await photoRepo.remove(id);
  }

  const chosen = selected.map((id) => photos.find((p) => p.id === id)).filter((p): p is Photo => !!p);
  return (
    <Page>
      <SectionHeader title="Add a photo" note={`today, ${formatLongDate(today)}`} />
      <Section className="gap-2">
        <span role="group" aria-label="Angle" className="flex gap-1.5">
          {PHOTO_ANGLES.map((a) => (
            <Chip key={a} active={angle === a} onClick={() => setAngle(a)}>
              {ANGLE_LABEL[a]}
            </Chip>
          ))}
        </span>
        <Button className="self-start" onClick={() => fileRef.current?.click()} disabled={busy} data-testid="add-photo">
          {busy ? 'Saving the photo' : `Take or pick a ${angle} photo`}
        </Button>
        <input ref={fileRef} type="file" accept="image/*" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void addPhoto(e.target.files?.[0])} data-testid="photo-file" />
        <span className="text-mid">Same spot, same light, same time of day: the change is easier to see.</span>
        {error ? <span className="text-red">{error}</span> : null}
      </Section>

      {chosen.length === 2 ? <Compare a={chosen[0]!} b={chosen[1]!} profile={profile} rollover={rollover} onClose={() => setSelected([])} /> : null}

      {days.length === 0 ? (
        <Section>
          <Empty>Add your first photo. Front, side and back on day one make the baseline everything else is measured against.</Empty>
        </Section>
      ) : (
        days.map(({ date, list }) => {
          const kg = list.find((p) => typeof p.weightKg === 'number')?.weightKg;
          return (
            <div key={date} className="flex flex-col gap-2">
              <SectionHeader title={formatLongDate(date)} note={`Day ${dayNoFor(profile.startedAt, date, rollover)}${kg !== undefined ? ` · ${n1(kg)} kg` : ''}`} />
              <Section>
                <div className="grid grid-cols-3 gap-2">
                  {list.map((p) => {
                    const on = selected.includes(p.id);
                    return (
                      <div key={p.id} className="flex flex-col gap-1">
                        <button
                          type="button"
                          aria-pressed={on}
                          aria-label={`${ANGLE_LABEL[p.angle]}, ${formatLongDate(p.date)}. Tap to compare.`}
                          onClick={() => toggle(p.id)}
                          className={`cursor-pointer border-2 bg-transparent p-0 ${on ? 'border-ink' : 'border-transparent'}`}
                          data-testid="photo"
                        >
                          <PhotoImage photo={p} />
                        </button>
                        <span className="text-mid">{ANGLE_LABEL[p.angle]}</span>
                        {on && selected.length === 1 ? (
                          <button type="button" className={`${DANGER} self-start`} onClick={() => void remove(p.id)}>
                            Remove
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </Section>
            </div>
          );
        })
      )}
      {selected.length === 1 ? <p className="px-2.5 text-mid">Tap one more photo to compare the two.</p> : null}
    </Page>
  );
}

function Compare({ a, b, profile, rollover, onClose }: { a: Photo; b: Photo; profile: Profile; rollover: number; onClose: () => void }) {
  const [older, newer] = a.date <= b.date ? [a, b] : [b, a];
  const days = daysBetween(older.date, newer.date);
  const diff = typeof older.weightKg === 'number' && typeof newer.weightKg === 'number' ? Math.round((newer.weightKg - older.weightKg) * 10) / 10 : undefined;
  const caption = (p: Photo) => `Day ${dayNoFor(profile.startedAt, p.date, rollover)}, ${formatLongDate(p.date)}${typeof p.weightKg === 'number' ? ` · ${n1(p.weightKg)} kg` : ''}`;
  return (
    <>
      <SectionHeader title="Side by side" action={<Button variant="text" onClick={onClose}>Close</Button>} />
      <Section className="gap-2">
        <div className="grid grid-cols-2 gap-2" data-testid="compare">
          {[older, newer].map((p) => (
            <div key={p.id} className="flex flex-col gap-1">
              <PhotoImage photo={p} />
              <span className="text-mid">{caption(p)}</span>
            </div>
          ))}
        </div>
        <span>
          {days === 0 ? 'Same day.' : `${days} ${days === 1 ? 'day' : 'days'} apart`}
          {diff !== undefined && days !== 0 ? `, ${diff > 0 ? '+' : diff < 0 ? '-' : ''}${n1(Math.abs(diff))} kg` : null}
          {days !== 0 ? '.' : null}
        </span>
      </Section>
    </>
  );
}
