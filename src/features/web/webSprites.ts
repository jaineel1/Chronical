/** 7x7 glyphs, one per mind-web node type. Drawn in MID_PALETTE (single colour 'x'). */
import type { WebNodeType } from '@/data/types';

export const WEB_GLYPH: Record<WebNodeType, readonly string[]> = {
  person: ['..xxx..', '..xxx..', '..xxx..', '.xxxxx.', 'xxxxxxx', 'xx.x.xx', '.x...x.'],
  goal: ['xxxxx..', 'xxxx...', 'xxx....', 'x......', 'x......', 'x......', 'x......'],
  routine: ['.xxxxx.', 'x.....x', 'x....xx', 'x...xxx', 'x.....x', 'x.....x', '.xxxxx.'],
  book: ['xxx.xxx', 'x.xxx.x', 'x.xxx.x', 'x.xxx.x', 'xxxxxxx', '.......', '.......'],
  skill: ['...x...', '...x...', '..xxx..', 'xxxxxxx', '.xxxxx.', '.xx.xx.', '.x...x.'],
  place: ['..xxx..', '.xxxxx.', '.xx.xx.', '.xxxxx.', '..xxx..', '...x...', '...x...'],
  topic: ['xxxxxxx', 'x.....x', 'x.x.x.x', 'x.....x', 'xxx.xxx', '..x....', '.x.....'],
  event: ['x.....x', 'xxxxxxx', 'x.....x', 'x.x.x.x', 'x.....x', 'x.x.x.x', 'xxxxxxx'],
  habit: ['..xxxx.', '.x....x', 'x...xxx', 'x....x.', 'x.......', '.x....x', '..xxxx.'],
};

export const WEB_TYPE_LABEL: Record<WebNodeType, string> = {
  person: 'People',
  goal: 'Goals',
  routine: 'Routines',
  book: 'Books',
  skill: 'Skills',
  place: 'Places',
  topic: 'Topics',
  event: 'Events',
  habit: 'Habits',
};

export const WEB_TYPES = Object.keys(WEB_GLYPH) as WebNodeType[];
