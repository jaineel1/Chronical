/**
 * Sprites for the Now strip, one ink colour ('i'). Rows are equal length; '.' is transparent.
 * Draw at an integer scale only.
 */

/** A clock face with hands at ten past twelve, 10x10. */
export const CLOCK_MAP = [
  '..iiiiii..',
  '.ii....ii.',
  'ii..i...ii',
  'i...i....i',
  'i...i....i',
  'i...iii..i',
  'i........i',
  'ii......ii',
  '.ii....ii.',
  '..iiiiii..',
] as const;

/** A wall calendar with two rings and a grid of days, 10x10. */
export const CALENDAR_MAP = [
  '.i......i.',
  'iiiiiiiiii',
  'i........i',
  'i.i.i.i..i',
  'i........i',
  'i.i.i.i.ii',
  'i........i',
  'i.i.i....i',
  'i........i',
  'iiiiiiiiii',
] as const;

export const NOW_PALETTE = { i: '#3a1219' } as const;
