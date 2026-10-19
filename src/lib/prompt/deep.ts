/**
 * Deep mode extras for the nightly prompt: the Origin Sheet and the days older than the usual
 * two weeks (up to 90 in total). The nightly builder trims the oldest of these first.
 */
import { joinBlocks, section } from './shared';

export const DEEP_DAYS = 90;

export interface DeepBlockInput {
  /** The player's Origin Sheet, as compiled from the 118 answers. */
  originSheetMd?: string;
  /** Compressed day lines older than the recent window, oldest first. */
  olderDays: string[];
}

export function buildDeepBlock({ originSheetMd, olderDays }: DeepBlockInput): string {
  return joinBlocks(
    originSheetMd?.trim() ? section('Origin Sheet', originSheetMd) : undefined,
    olderDays.length ? section(`Earlier days, oldest first (${olderDays.length})`, olderDays.join('\n')) : undefined,
  ).trim();
}
