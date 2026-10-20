/**
 * Number readers for the day editor. Each returns undefined for an empty box (clears the value),
 * null when the text cannot be read, otherwise the number. Same semantics as the Campfire's boxes.
 */
export type NumberReader = (text: string) => number | undefined | null;

export const readDecimal: NumberReader = (text) => {
  const t = text.trim().replace(',', '.');
  if (!t) return undefined;
  return /^\d+(?:\.\d+)?$/.test(t) ? Number(t) : null;
};

export const readInteger: NumberReader = (text) => {
  const t = text.trim().replace(/,/g, '');
  if (!t) return undefined;
  return /^\d+$/.test(t) ? Number(t) : null;
};

/** "2:10", "2h10", "2h", "130", "130m" → minutes. */
export const readScreenTime: NumberReader = (text) => {
  const t = text.trim().toLowerCase();
  if (!t) return undefined;
  let m = /^(\d{1,2}):([0-5]\d)$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d{1,2})\s*h(?:\s*(\d{1,2})\s*m?)?$/.exec(t);
  if (m) return Number(m[1]) * 60 + Number(m[2] ?? 0);
  m = /^(\d{1,4})\s*m?$/.exec(t);
  return m ? Number(m[1]) : null;
};

/** A valid 'YYYY-MM-DD' that is a real calendar day. */
export function isDayKey(s: string | undefined): s is string {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [y, m, d] = s.split('-').map(Number) as [number, number, number];
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}
