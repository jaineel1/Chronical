/**
 * Progress photos: where an image lives in the sync repo, shrinking a picked image before it is
 * stored, and the one line the weekly review gets about them (dates and weights, never the images).
 */
import type { Photo, PhotoAngle } from '@/data/types';
import { daysBetween, formatShortDate } from './dates';

export const PHOTO_ANGLES: readonly PhotoAngle[] = ['front', 'side', 'back'];
export const MAX_PHOTO_EDGE = 1600;

/** photos/2026-10-20-front-<id>.jpg: sorted by date in the repo, unique per photo. */
export function photoPath(date: string, angle: PhotoAngle, id: string): string {
  return `photos/${date}-${angle}-${id}.jpg`;
}

/** Width and height that fit inside `max` on the long edge, keeping the shape. */
export function fitWithin(width: number, height: number, max = MAX_PHOTO_EDGE): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** Decode a picked image (phone orientation applied), shrink it, and encode it as JPEG. Browser only. */
export async function shrinkImage(file: Blob, max = MAX_PHOTO_EDGE): Promise<{ blob: Blob; width: number; height: number }> {
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const { width, height } = fitWithin(bitmap.width, bitmap.height, max);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This device cannot draw images, so the photo was not saved.');
  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('The photo could not be saved as JPEG.');
  return { blob, width, height };
}

function n1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

/**
 * For the weekly review: the newest photo day against the one before it, with weights.
 * Undefined when there are no photos.
 */
export function photoProgressLine(photos: Pick<Photo, 'date' | 'angle' | 'weightKg'>[]): string | undefined {
  const dates = [...new Set(photos.map((p) => p.date))].sort().reverse();
  const [latest, previous] = dates;
  if (!latest) return undefined;
  const on = (d: string) => photos.filter((p) => p.date === d);
  const angles = (d: string) => PHOTO_ANGLES.filter((a) => on(d).some((p) => p.angle === a)).join(', ');
  const weight = (d: string) => on(d).find((p) => typeof p.weightKg === 'number')?.weightKg;
  const wl = weight(latest);
  let line = `Newest progress photos ${formatShortDate(latest)} (${angles(latest)})${wl !== undefined ? ` at ${n1(wl)} kg` : ''}.`;
  if (previous) {
    const wp = weight(previous);
    const days = daysBetween(previous, latest);
    line += ` Previous ${formatShortDate(previous)}${wp !== undefined ? ` at ${n1(wp)} kg` : ''}, ${days} ${days === 1 ? 'day' : 'days'} earlier`;
    if (wl !== undefined && wp !== undefined) {
      const d = Math.round((wl - wp) * 10) / 10;
      line += `: ${d > 0 ? '+' : d < 0 ? '-' : ''}${n1(Math.abs(d))} kg`;
    }
    line += '.';
  } else {
    line += ' The first photos so far.';
  }
  return `${line} ${dates.length} photo ${dates.length === 1 ? 'day' : 'days'} in all. The player sees the photos; you only get these numbers.`;
}
