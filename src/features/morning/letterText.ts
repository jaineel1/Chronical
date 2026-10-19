/** Pure text helpers for showing the game master's letter. */

/** Paragraphs of a markdown-ish letter: blank lines split, single newlines join, headings and list marks dropped. */
export function toParagraphs(md: string): string[] {
  return md
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((block) =>
      block
        .split('\n')
        .map((l) => l.replace(/^\s*#{1,6}\s+/, '').replace(/^\s*(?:[-*•]|\d+[.)])\s+/, '').trim())
        .filter(Boolean)
        .join(' '),
    )
    .filter((p) => p.length > 0 && !/^-{3,}$/.test(p));
}

/** Sentences of one paragraph. A full stop inside a number ("8.5 km", "5:52") does not end one. */
export function sentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?]["'”’)\]]*)\s+(?=["'“‘(\[]?[A-Z0-9])/)
    .map((s) => s.trim())
    .filter(Boolean);
}

/** The first `n` sentences of the letter, for the collapsed phone view. */
export function firstSentences(md: string, n = 2): { text: string; more: boolean } {
  const paragraphs = toParagraphs(md);
  const first = sentences(paragraphs[0] ?? '');
  const text = first.slice(0, n).join(' ');
  return { text, more: first.length > n || paragraphs.length > 1 };
}

export function wordCount(md: string): number {
  return md.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

/** "Late nights are…" → "late nights are…", leaving names and "I" alone. */
export function lowerFirst(text: string, keep: readonly string[] = []): string {
  const first = text.split(/\s+/)[0] ?? '';
  const bare = first.replace(/[^\p{L}'-]/gu, '');
  if (!bare || bare === 'I' || /^[A-Z0-9]{2,}$/.test(bare) || keep.some((k) => k.split(/\s+/)[0] === bare)) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/** "From Deep Work: schedule the block" → "Lesson for today, from Deep Work: schedule the block". */
export function lessonLine(lesson: string): string {
  const m = /^from\s+(.+?):\s*(.+)$/i.exec(lesson.trim());
  if (m) return `Lesson for today, from ${m[1]}: ${m[2]}`;
  return `Lesson for today: ${lesson.trim()}`;
}
