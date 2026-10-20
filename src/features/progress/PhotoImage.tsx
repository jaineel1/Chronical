import type { Photo, PhotoAngle } from '@/data/types';
import { formatLongDate } from '@/lib/dates';
import { usePhotoUrl } from './queries';

export const ANGLE_LABEL: Record<PhotoAngle, string> = { front: 'Front', side: 'Side', back: 'Back' };

/** One progress photo at 3:4, or a dashed placeholder while its image is still on another device. */
export function PhotoImage({ photo, className = '' }: { photo: Photo; className?: string }) {
  const { url, missing } = usePhotoUrl(photo.id);
  if (url) return <img src={url} alt={`${ANGLE_LABEL[photo.angle]}, ${formatLongDate(photo.date)}`} className={`block aspect-[3/4] w-full object-cover ${className}`} />;
  return (
    <div className={`flex aspect-[3/4] w-full items-center justify-center border border-dashed border-faint text-center text-mid ${className}`}>
      {missing ? 'Arrives with the next sync' : ''}
    </div>
  );
}
