/** Finds the player's own routines, goals, skills, people and books by name inside a line of Claude's text. Pure. */

export interface NameTarget {
  name: string;
  /** Editor route, e.g. /edit/routines/abc. */
  to: string;
}

export interface TextPart {
  text: string;
  to?: string;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Splits `text` so every name in `targets` becomes its own part with a route. Matching is case-insensitive,
 * longest name first, and only on whole words. When two rows share a name the first target wins.
 */
export function splitByNames(text: string, targets: readonly NameTarget[]): TextPart[] {
  const byName = new Map<string, NameTarget>();
  for (const t of targets) {
    const key = t.name.trim().toLowerCase();
    if (key.length >= 2 && !byName.has(key)) byName.set(key, t);
  }
  if (byName.size === 0) return [{ text }];
  const names = [...byName.keys()].sort((a, b) => b.length - a.length);
  const re = new RegExp(`(?<![\\p{L}\\p{N}])(${names.map(escapeRegExp).join('|')})(?![\\p{L}\\p{N}])`, 'giu');
  const parts: TextPart[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const target = byName.get(m[0].toLowerCase());
    if (!target) continue;
    if (m.index > last) parts.push({ text: text.slice(last, m.index) });
    parts.push({ text: m[0], to: target.to });
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts.length ? parts : [{ text }];
}

const SHIELD_SUFFIX = ': shield used, none left this week';
const SHIELD_SUMMARY = /^Shields used on (.+?)\. None left this week for them\.$/;

/** Routine names out of the shield notes: "X, 4 day streak: shield used…" and "Shields used on A, B and C. …". */
export function shieldNames(notes: readonly string[]): string[] {
  const names: string[] = [];
  for (const note of notes) {
    const summary = SHIELD_SUMMARY.exec(note);
    if (summary) names.push(...(summary[1] ?? '').split(/,\s*|\s+and\s+/).map((n) => n.trim()).filter(Boolean));
    else if (note.endsWith(SHIELD_SUFFIX)) names.push((note.slice(0, -SHIELD_SUFFIX.length).split(',')[0] ?? '').trim());
  }
  return [...new Set(names.filter(Boolean))];
}
