/**
 * Origin Sheet compiler: the wizard's answers → one markdown document, the thing Claude reads
 * on Day 0 and that deep-mode nights carry along.
 *
 *   # Origin Sheet — Riya, Monday, 19 October 2026
 *
 *   ## Part 2: Body
 *   **Q** Weight this morning, roughly
 *   **A** 72 kg
 *
 * Questions follow the sheet's order (never the order they were answered), unanswered ones and
 * empty parts are skipped, and `excludeMoney` drops Part 7 entirely. Same input → same output.
 */
import {
  NAME_QUESTION_ID,
  PARTS,
  QUESTIONS,
  choiceValues,
  isAnswered,
  likertValue,
  numberValue,
  unitKey,
  type Answers,
  type Question,
} from '@/features/onboarding/questions';
import { formatLongDate, fromDayKey, todayKey } from '@/lib/dates';

export interface CompileOptions {
  /** Leave the Money part out (settings.excludeMoney). */
  excludeMoney?: boolean;
  /** Day key for the title; defaults to today. Pass it in tests for stable output. */
  date?: string;
  /** Used when the name question is empty. */
  displayName?: string;
}

/** "Monday, 19 October 2026" */
export function formatSheetDate(dayKey: string): string {
  return `${formatLongDate(dayKey)} ${fromDayKey(dayKey).getFullYear()}`;
}

/** Keep a number as typed (no locale grouping, so the sheet is identical on every device). */
function formatNumber(n: number): string {
  return Number.isInteger(n) ? String(n) : String(Math.round(n * 100) / 100);
}

/** One answer as it appears after **A**, or '' when unanswered. */
export function formatAnswer(q: Question, answers: Answers): string {
  if (!isAnswered(q, answers)) return '';
  const raw = answers[q.id];
  switch (q.type) {
    case 'S':
      return String(raw).trim().replace(/\s+/g, ' ');
    case 'M':
      return String(raw)
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((l) => l.trimEnd())
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
    case 'T':
      return choiceValues(q, answers).join(', ');
    case 'L': {
      const v = likertValue(raw)!;
      const label = q.labels?.[v - 1];
      return label ? `${v}/5 — ${label}` : `${v}/5`;
    }
    case 'N': {
      const n = formatNumber(numberValue(raw)!);
      const typedUnit = q.unitFree ? String(answers[unitKey(q.id)] ?? '').trim() : '';
      const unit = q.unitFree ? typedUnit : (q.unit ?? '');
      return unit ? `${n} ${unit}` : n;
    }
  }
}

export function compileOriginSheet(answers: Answers, options: CompileOptions = {}): string {
  const { excludeMoney = false, date = todayKey(), displayName } = options;
  const nameAnswer = answers[NAME_QUESTION_ID];
  const name = (typeof nameAnswer === 'string' && nameAnswer.trim()) || displayName?.trim() || 'Player';

  const blocks: string[] = [`# Origin Sheet — ${name.replace(/\s+/g, ' ')}, ${formatSheetDate(date)}`];
  for (const part of PARTS) {
    if (excludeMoney && part.id === 'money') continue;
    const pairs: string[] = [];
    for (const q of QUESTIONS) {
      if (q.part !== part.id) continue;
      const a = formatAnswer(q, answers);
      if (a) pairs.push(`**Q** ${q.text}\n**A** ${a}`);
    }
    if (pairs.length) blocks.push(`## Part ${part.n}: ${part.name}\n${pairs.join('\n\n')}`);
  }
  if (blocks.length === 1) blocks.push('_No answers yet._');
  return blocks.join('\n\n') + '\n';
}

/** Words a person would count: markup like **Q**, # and list markers does not count. */
export function countWords(md: string): number {
  return md
    .replace(/\*\*[QA]\*\*/g, ' ')
    .replace(/[#*_`>|]/g, ' ')
    .split(/\s+/)
    .filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
