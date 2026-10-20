/**
 * The weekly boss, 16×14, in the Paper palette. x body, r eyes, p teeth, m claws.
 * BOSS_DEFEATED_MAP is the same shape with its eyes shut, drawn in the faded palette.
 */
import { PAPER } from '@/ui/sprites';

export const BOSS_MAP = [
  '..x..........x..',
  '..xx........xx..',
  '...xxxxxxxxxx...',
  '..xxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxx.',
  '.xxrrxxxxxxrrxx.',
  '.xxrrxxxxxxrrxx.',
  '.xxxxxxxxxxxxxx.',
  '.xxpxpxpxpxpxxx.',
  '.xxxxxxxxxxxxxx.',
  '.mxxxxxxxxxxxxm.',
  '..xxxxxxxxxxxx..',
  '..xxx......xxx..',
  '.xxxx......xxxx.',
] as const;

export const BOSS_DEFEATED_MAP = [
  '................',
  '................',
  '..x..........x..',
  '..xxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxx.',
  '.xxxxxxxxxxxxxx.',
  '.xxppxxxxxxppxx.',
  '.xxxxxxxxxxxxxx.',
  '.xxxxxppppxxxxx.',
  '.xxxxxxxxxxxxxx.',
  '.mxxxxxxxxxxxxm.',
  '..xxxxxxxxxxxx..',
  '.xxxxxxxxxxxxxx.',
  'xxxxxxxxxxxxxxxx',
] as const;

export const BOSS_PALETTE = { x: PAPER.ink, r: PAPER.red, p: PAPER.paper, m: PAPER.mid } as const;
export const BOSS_DEFEATED_PALETTE = { x: PAPER.mid, p: PAPER.paper, m: PAPER.faint } as const;
