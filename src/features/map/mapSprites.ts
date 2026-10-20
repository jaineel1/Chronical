/** Pixel maps for the Map: the routine shield and the goal flag. 'o' is the outline, 'x' the fill. */
import { PAPER } from '@/ui/sprites';

export const SHIELD_MAP = [
  'ooooooo',
  'oxxxxxo',
  'oxxxxxo',
  'oxxxxxo',
  'oxxxxxo',
  '.oxxxo.',
  '..oxo..',
  '...o...',
] as const;

export type ShieldLook = { used: boolean; atRisk: boolean };

/** Full ink while the week's shield is unused, faint once spent; the outline turns red when the streak is at risk. */
export function shieldPalette({ used, atRisk }: ShieldLook): Readonly<Record<'o' | 'x', string>> {
  const fill = used ? PAPER.faint : PAPER.ink;
  return { o: atRisk ? PAPER.red : fill, x: fill };
}

export const FLAG_MAP = ['xxxx.', 'xxxx.', 'xxx..', 'x....', 'x....', 'x....', 'x....'] as const;
