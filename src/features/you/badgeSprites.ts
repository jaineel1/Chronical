/**
 * Badge sprites, 12×12. '.' = transparent. i ink, m mid, w walnut, r red, p paper (highlights).
 * Earned badges use BADGE_PALETTE; locked ones BADGE_LOCKED_PALETTE (every tone faint, highlights stay paper).
 */
import type { BadgeSprite } from '@/lib/game/achievements';
import { PAPER } from '@/ui/sprites';

const FLAME = [
  '.....r......',
  '.....rr.....',
  '....rrr.....',
  '....rrrr....',
  '...rrrrr.r..',
  '..rrrwrrrr..',
  '..rrwwwrrr..',
  '.rrwwpwwrrr.',
  '.rrwpppwwrr.',
  '.rrwpppwrrr.',
  '..rrwwwwrr..',
  '...rrrrrr...',
] as const;

const MOON = [
  '...iiii.....',
  '..iiii......',
  '.iiii.......',
  '.iii.....m..',
  'iiii....mmm.',
  'iiii.....m..',
  'iiii........',
  'iiii........',
  '.iiii.......',
  '.iiiii...iii',
  '..iiiiiiiii.',
  '....iiiii...',
] as const;

const LETTER = [
  '............',
  '............',
  'iiiiiiiiiiii',
  'ii........ii',
  'i.i......i.i',
  'i..i....i..i',
  'i...i..i...i',
  'i....ww....i',
  'i....ww....i',
  'i..........i',
  'iiiiiiiiiiii',
  '............',
] as const;

const SHOE = [
  '............',
  '............',
  '..iii.......',
  '..iii.......',
  '..iiim......',
  '..iiimm.....',
  '..iiiimmm...',
  '.iiiiiiiimm.',
  '.iiiiiiiiiii',
  '.wwwwwwwwwww',
  '............',
  '............',
] as const;

const DROP = [
  '.....m......',
  '.....m......',
  '....mmm.....',
  '....mmm.....',
  '...mmmmm....',
  '..mmmmmmm...',
  '..mpmmmmm...',
  '.mmpmmmmmm..',
  '.mpmmmmmmm..',
  '.mmpmmmmmm..',
  '..mmmmmmm...',
  '...mmmmm....',
] as const;

const DUMBBELL = [
  '............',
  '............',
  '............',
  '.ii......ii.',
  'iii......iii',
  'iiimmmmmmiii',
  'iiimmmmmmiii',
  'iii......iii',
  '.ii......ii.',
  '............',
  '............',
  '............',
] as const;

const BOWL = [
  '............',
  '...m..m.....',
  '....m..m....',
  '...m..m.....',
  '............',
  'iiiiiiiiiiii',
  '.iwwwwwwwwi.',
  '.iiiiiiiiii.',
  '..iiiiiiii..',
  '...iiiiii...',
  '....wwww....',
  '............',
] as const;

const CAMERA = [
  '............',
  '............',
  '..iii.......',
  'iiiiiiiiiiii',
  'iiiippppiiii',
  'iiipmmmmpiii',
  'iiipmmmmpiii',
  'iiiippppiiii',
  'iiiiiiiiiiii',
  '............',
  '............',
  '............',
] as const;

const STAR = [
  '.....ww.....',
  '.....ww.....',
  '....wwww....',
  'wwwwwwwwwwww',
  '.wwwwmmwwww.',
  '..wwwmmwww..',
  '...wwwwww...',
  '..wwwwwwww..',
  '..www..www..',
  '.www....www.',
  '.ww......ww.',
  '............',
] as const;

const FLAG = [
  '.ii.........',
  '.iiwwwwww...',
  '.iiwwwwwwww.',
  '.iiwwwwwwww.',
  '.iiwwwwww...',
  '.ii.........',
  '.ii.........',
  '.ii.........',
  '.ii.........',
  '.ii.........',
  'iiii........',
  '............',
] as const;

export const BADGE_MAPS: Record<BadgeSprite, readonly string[]> = {
  flame: FLAME,
  moon: MOON,
  letter: LETTER,
  shoe: SHOE,
  drop: DROP,
  dumbbell: DUMBBELL,
  bowl: BOWL,
  camera: CAMERA,
  star: STAR,
  flag: FLAG,
};

export const BADGE_PALETTE = { i: PAPER.ink, m: PAPER.mid, w: PAPER.walnut, r: PAPER.red, p: PAPER.paper } as const;
export const BADGE_LOCKED_PALETTE = { i: PAPER.faint, m: PAPER.faint, w: PAPER.faint, r: PAPER.faint, p: PAPER.paper } as const;
