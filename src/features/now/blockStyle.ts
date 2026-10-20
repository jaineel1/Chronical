import type { BlockKind } from '@/lib/schedule/schedule';

/** Paper-token styling per block kind, shared by the day timeline and the timetable grid. */
export const KIND_CLASS: Record<BlockKind, string> = {
  class: 'border-l-4 border-l-ink bg-paper',
  minor: 'border-l-2 border-l-ink bg-paper',
  lab: 'border-l-4 border-l-mid bg-paper-2',
  break: 'border-l-2 border-l-faint bg-paper text-mid',
  routine: 'border-l-4 border-l-walnut bg-paper',
  plan: 'border-l-4 border-l-red bg-paper',
};

export const KIND_NAME: Record<BlockKind, string> = {
  class: 'Class',
  minor: 'Minor',
  lab: 'Lab',
  break: 'Break',
  routine: 'Routine',
  plan: 'Plan',
};

/** Faint hatching for breaks. */
export const HATCH = { backgroundImage: 'repeating-linear-gradient(135deg, var(--color-faint) 0 1px, transparent 1px 6px)' };
