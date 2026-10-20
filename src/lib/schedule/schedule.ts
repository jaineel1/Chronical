import { PILLAR_LABEL } from '@/data/types';
import type { PlanBlock, Routine, TimetableEntry } from '@/data/types';

/**
 * The day as a list of time blocks: the weekly timetable, routine windows and Claude's plan,
 * merged and sorted. Pure: callers pass in the rows and the clock.
 */

export type BlockKind = 'class' | 'lab' | 'break' | 'minor' | 'routine' | 'plan';

export interface TimelineBlock {
  /** Source row id, prefixed with its kind so ids never collide across tables. */
  id: string;
  kind: BlockKind;
  title: string;
  /** 'HH:MM'. */
  start: string;
  end: string;
  startMin: number;
  /** Exclusive. At most 1440 (midnight). */
  endMin: number;
  /** Second line: room and teacher, pillar, and so on. */
  sub: string;
  room?: string;
  teacher?: string;
  /** Plan blocks only. */
  done?: boolean;
  /** Plan blocks only: the PlanBlock id, so the screen can write it back. */
  planId?: string;
}

export interface NowAndNext {
  now?: TimelineBlock;
  next?: TimelineBlock;
  /** 'HH:MM' of the next block, set only when nothing is on now. */
  freeUntil?: string;
}

const DAY_END = 24 * 60;

/** 'HH:MM' to minutes. '24:00' is allowed as the end of the day. Returns undefined when malformed. */
export function parseTime(text: string): number | undefined {
  const m = /^(\d{1,2}):(\d{2})$/.exec(text.trim());
  if (!m) return undefined;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (min > 59 || h > 24 || (h === 24 && min > 0)) return undefined;
  return h * 60 + min;
}

/** Minutes to 'HH:MM' (1440 prints as '24:00'). */
export function formatMinute(total: number): string {
  const t = Math.max(0, Math.min(DAY_END, Math.round(total)));
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
}

/** Parse "06:30-07:00". An end at or before the start (a window that crosses midnight) runs to midnight. */
export function parseWindow(window: string | undefined): { start: number; end: number } | undefined {
  if (!window) return undefined;
  const parts = window.split(/\s*[-–—]\s*/);
  if (parts.length !== 2) return undefined;
  const start = parseTime(parts[0] ?? '');
  const end = parseTime(parts[1] ?? '');
  if (start === undefined || end === undefined || start >= DAY_END) return undefined;
  return { start, end: end <= start ? DAY_END : end };
}

/**
 * Minutes into the game day that `now` falls in. Before the rollover hour the game day is still
 * yesterday, so the clock reads past midnight (1:10 AM with a 4 AM rollover is 1510).
 */
export function gameMinute(now: Date, rolloverHour: number): number {
  const minute = now.getHours() * 60 + now.getMinutes();
  return now.getHours() < rolloverHour ? minute + DAY_END : minute;
}

export interface TimelineInput {
  /** Day key 'YYYY-MM-DD'. */
  date: string;
  /** 0 = Sunday. */
  weekday: number;
  entries: readonly TimetableEntry[];
  routines: readonly Routine[];
  plan?: readonly PlanBlock[];
}

function entryApplies(e: TimetableEntry, date: string, weekday: number): boolean {
  if (e.day !== weekday) return false;
  if (e.from && date < e.from) return false;
  if (e.to && date > e.to) return false;
  return true;
}

function join(parts: (string | undefined)[]): string {
  return parts.filter((p): p is string => !!p && p.trim() !== '').join(', ');
}

const KIND_ORDER: Record<BlockKind, number> = { class: 0, lab: 1, minor: 2, plan: 3, routine: 4, break: 5 };

export function buildTimeline({ date, weekday, entries, routines, plan = [] }: TimelineInput): TimelineBlock[] {
  const blocks: TimelineBlock[] = [];

  for (const e of entries) {
    if (!entryApplies(e, date, weekday)) continue;
    const start = parseTime(e.start);
    const rawEnd = parseTime(e.end);
    if (start === undefined || rawEnd === undefined || start >= DAY_END) continue;
    const end = rawEnd <= start ? DAY_END : rawEnd;
    blocks.push({
      id: `timetable:${e.id}`,
      kind: e.kind,
      title: e.title,
      start: formatMinute(start),
      end: formatMinute(end),
      startMin: start,
      endMin: end,
      sub: join([e.room, e.teacher, e.code]),
      room: e.room,
      teacher: e.teacher,
    });
  }

  for (const r of routines) {
    if (r.archived) continue;
    if (r.days.length > 0 && !r.days.includes(weekday)) continue;
    const w = parseWindow(r.window);
    if (!w) continue;
    blocks.push({
      id: `routine:${r.id}`,
      kind: 'routine',
      title: r.name,
      start: formatMinute(w.start),
      end: formatMinute(w.end),
      startMin: w.start,
      endMin: w.end,
      sub: PILLAR_LABEL[r.pillar],
    });
  }

  for (const p of plan) {
    const start = parseTime(p.start);
    const end = parseTime(p.end);
    if (start === undefined || end === undefined || end <= start || start >= DAY_END) continue;
    blocks.push({
      id: `plan:${p.id}`,
      kind: 'plan',
      title: p.text,
      start: formatMinute(start),
      end: formatMinute(end),
      startMin: start,
      endMin: end,
      sub: p.pillar ? PILLAR_LABEL[p.pillar] : '',
      done: p.done === true,
      planId: p.id,
    });
  }

  return blocks.sort((a, b) => a.startMin - b.startMin || a.endMin - b.endMin || KIND_ORDER[a.kind] - KIND_ORDER[b.kind] || a.title.localeCompare(b.title));
}

/** Which block wins when several run at once: class and lab, then a minor, then the plan, then a routine, then a break. */
const NOW_PRIORITY: Record<BlockKind, number> = { class: 0, lab: 0, minor: 1, plan: 2, routine: 3, break: 4 };

export function nowAndNext(timeline: readonly TimelineBlock[], minute: number): NowAndNext {
  let now: TimelineBlock | undefined;
  for (const b of timeline) {
    if (b.startMin <= minute && minute < b.endMin) {
      if (!now || NOW_PRIORITY[b.kind] < NOW_PRIORITY[now.kind]) now = b;
    }
  }

  let next: TimelineBlock | undefined;
  for (const b of timeline) {
    if (b.startMin <= minute) continue;
    if (!next || b.startMin < next.startMin || (b.startMin === next.startMin && NOW_PRIORITY[b.kind] < NOW_PRIORITY[next.kind])) next = b;
  }

  return { now, next, freeUntil: now || !next ? undefined : next.start };
}

export interface Lane {
  /** 0-based column within its cluster of overlapping blocks. */
  lane: number;
  /** How many columns that cluster needs. */
  lanes: number;
}

/**
 * Side-by-side columns for blocks that overlap in time. `minMinutes` is the shortest a block is
 * drawn, so two short blocks that would touch on screen also get their own columns.
 */
export function layoutLanes(timeline: readonly Pick<TimelineBlock, 'id' | 'startMin' | 'endMin'>[], minMinutes = 0): Map<string, Lane> {
  const out = new Map<string, Lane>();
  let cluster: { id: string; lane: number }[] = [];
  let laneEnds: number[] = [];
  let clusterEnd = -1;

  const flush = () => {
    for (const c of cluster) out.set(c.id, { lane: c.lane, lanes: laneEnds.length });
    cluster = [];
    laneEnds = [];
    clusterEnd = -1;
  };

  for (const b of timeline) {
    if (cluster.length > 0 && b.startMin >= clusterEnd) flush();
    const end = Math.max(b.endMin, b.startMin + minMinutes);
    let lane = laneEnds.findIndex((e) => e <= b.startMin);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    cluster.push({ id: b.id, lane });
    clusterEnd = Math.max(clusterEnd, end);
  }
  flush();
  return out;
}
