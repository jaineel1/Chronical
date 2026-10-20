import { FIRE_MAP } from '@/ui/sprites';

/**
 * Flicker frames for the campfire, 8×8, same letters and palette as FIRE_MAP
 * (y flame tip, o flame, r embers, w logs). Frame 0 is FIRE_MAP itself, so the static
 * (reduced-motion) fire is the one in the mockups.
 */
export const FIRE_FRAMES: readonly (readonly string[])[] = [
  FIRE_MAP,
  ['....y...', '...yy.y.', '..oyyyy.', '.ooyyoo.', '.oooyoo.', 'rooooor.', '.rrrrrr.', '..wwww..'],
  ['..y.....', '.y.yy...', '.yoyy.y.', '.ooyyoy.', '.ooyooo.', 'rooooor.', '.rrrrrr.', '..wwww..'],
];

/** Low embers for a night with nothing logged yet, 8×4: glowing coals (o) on ash (r) and logs (w). */
export const EMBER_FRAMES: readonly (readonly string[])[] = [
  ['........', '..o..r..', '.rrorrr.', '..wwww..'],
  ['........', '.....o..', '.rorrro.', '..wwww..'],
];
