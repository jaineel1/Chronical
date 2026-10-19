/**
 * Sprite maps. '.' = transparent. Letters index the palette passed to <PixelSprite>.
 * Keep every row the same length.
 */

export const PAPER = {
  paper: '#ebe3d4',
  faint: '#cfc3ae',
  mid: '#8a4a52',
  ink: '#3a1219',
  red: '#b8323b',
  walnut: '#6b3f2a',
} as const;

/** The player. 12×20. h hair, s skin, e eyes, t tunic, p trousers, b boots. */
export const HERO_MAP = [
  '....hhhh....',
  '...hhhhhh...',
  '..hhhhhhhh..',
  '..hssssssh..',
  '..hsessesh..',
  '..hssssssh..',
  '...ssssss...',
  '....ssss....',
  '...tttttt...',
  '..tttttttt..',
  '.stttttttts.',
  '.stttttttts.',
  '.stttttttts.',
  '..tttttttt..',
  '..pppppppp..',
  '..ppp..ppp..',
  '..ppp..ppp..',
  '..ppp..ppp..',
  '..ppp..ppp..',
  '.bbbb..bbbb.',
] as const;

export const HERO_PALETTE = {
  h: PAPER.ink,
  s: PAPER.mid,
  e: PAPER.ink,
  t: PAPER.red,
  p: PAPER.faint,
  b: PAPER.ink,
} as const;

/** 7×7 sun. */
export const SUN_MAP = ['..xxx..', '.xxxxx.', 'xxxxxxx', 'xxxxxxx', 'xxxxxxx', '.xxxxx.', '..xxx..'] as const;
export const SUN_PALETTE = { x: PAPER.red } as const;

/** 7×7 crescent moon. */
export const MOON_MAP = ['..xxx..', '.xx....', 'xx.....', 'xx.....', 'xx.....', '.xx....', '..xxx..'] as const;
export const MOON_PALETTE = { x: PAPER.mid } as const;

/** 8×8 campfire. y flame tip, o flame, r embers, w logs. */
export const FIRE_MAP = ['...y....', '..yy..y.', '..oyy.y.', '.ooyyoy.', '.ooooyo.', 'rooooor.', '.rrrrrr.', '..wwww..'] as const;
export const FIRE_PALETTE = { y: PAPER.red, o: PAPER.red, r: PAPER.mid, w: PAPER.ink } as const;

/** Region landmarks, 7 wide. */
export const MOUNTAIN_MAP = ['...x...', '..xxx..', '.xxxxx.', '.xxxxx.', 'xxxxxxx'] as const;
export const DROP_MAP = ['...x...', '..xxx..', '.xxxxx.', '.xxxxx.', '..xxx..'] as const;
export const BOOK_MAP = ['xxx.xxx', 'x.xxx.x', 'x.xxx.x', 'x.xxx.x', 'xxxxxxx'] as const;
export const COINS_MAP = ['.xxxxx.', 'x.....x', '.xxxxx.', 'x.....x', '.xxxxx.'] as const;
export const MOON_SMALL_MAP = ['..xxx..', '.xx....', 'xx.....', '.xx....', '..xxx..'] as const;
export const TREE_MAP = ['..xxx..', '.xxxxx.', 'xxxxxxx', '.xxxxx.', '...x...', '...x...'] as const;
export const MID_PALETTE = { x: PAPER.mid } as const;
export const INK_PALETTE = { x: PAPER.ink } as const;

import type { Pillar } from '@/data/types';

export const PILLAR_ICON: Record<Pillar, readonly string[]> = {
  BODY: MOUNTAIN_MAP,
  SKIN: DROP_MAP,
  MIND: BOOK_MAP,
  WORK: COINS_MAP,
  DOPAMINE: MOON_SMALL_MAP,
};
