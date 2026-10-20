import { Link } from 'react-router';
import { formatLongDate } from '@/lib/dates';
import { PHOTO_ANGLES } from '@/lib/photos';
import { Section, SectionHeader } from '@/ui/primitives';
import { PhotoImage } from './PhotoImage';
import { usePhotos } from './queries';

/** On the You screen: the newest photo day and the way into /progress. */
export function ProgressTeaser() {
  const photos = usePhotos();
  if (!photos) return null;
  const latest = photos[0]?.date;
  const shown = latest ? photos.filter((p) => p.date === latest).sort((a, b) => PHOTO_ANGLES.indexOf(a.angle) - PHOTO_ANGLES.indexOf(b.angle)) : [];
  const days = new Set(photos.map((p) => p.date)).size;
  return (
    <>
      <SectionHeader title="Progress" note={days ? `${days} photo ${days === 1 ? 'day' : 'days'}` : undefined} />
      <Section className="gap-2">
        {shown.length ? (
          <div className="grid w-2/3 grid-cols-3 gap-1.5">
            {shown.map((p) => (
              <PhotoImage key={p.id} photo={p} />
            ))}
          </div>
        ) : null}
        <Link to="/progress" className="self-start text-walnut no-underline" data-testid="open-progress">
          {latest ? `Latest ${formatLongDate(latest)}. Open progress photos` : 'Add your first progress photo'}
        </Link>
      </Section>
    </>
  );
}
