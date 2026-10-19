/**
 * Read-only renderers shared by the wizard and the Vault: the compiled Origin Sheet, a State of Me
 * style markdown note, and a letter with the pixel drop cap. Tiny on purpose: they build React
 * nodes from a handful of line patterns and never inject HTML.
 */
import { Fragment, type ReactNode } from 'react';

/** `**bold**` → <strong>; everything else stays text. */
export function inline(text: string): ReactNode {
  const parts = text.split(/\*\*(.+?)\*\*/g);
  if (parts.length === 1) return text;
  return parts.map((p, i) => (i % 2 === 1 ? <strong key={i} className="font-medium">{p}</strong> : <Fragment key={i}>{p}</Fragment>));
}

type SheetBlock =
  | { kind: 'title'; text: string }
  | { kind: 'part'; text: string }
  | { kind: 'qa'; q: string; a: string }
  | { kind: 'text'; text: string };

export function sheetBlocks(md: string): SheetBlock[] {
  const out: SheetBlock[] = [];
  let qa: { q: string; a: string[] } | null = null;
  let answering = false;
  const closeQa = () => {
    if (qa) out.push({ kind: 'qa', q: qa.q, a: qa.a.join('\n').trim() });
    qa = null;
    answering = false;
  };
  for (const raw of md.replace(/\r\n?/g, '\n').split('\n')) {
    const line = raw.trimEnd();
    if (/^#\s/.test(line)) {
      closeQa();
      out.push({ kind: 'title', text: line.replace(/^#\s+/, '') });
    } else if (/^#{2,6}\s/.test(line)) {
      closeQa();
      out.push({ kind: 'part', text: line.replace(/^#{2,6}\s+/, '') });
    } else if (line.startsWith('**Q**')) {
      closeQa();
      qa = { q: line.replace(/^\*\*Q\*\*\s*/, ''), a: [] };
    } else if (line.startsWith('**A**') && qa) {
      answering = true;
      qa.a.push(line.replace(/^\*\*A\*\*\s*/, ''));
    } else if (/^_.+_$/.test(line.trim())) {
      // An italic note line ("_No answers yet._") always stands on its own.
      closeQa();
      out.push({ kind: 'text', text: line.trim().slice(1, -1) });
    } else if (qa && answering) {
      qa.a.push(line);
    } else if (line.trim()) {
      closeQa();
      out.push({ kind: 'text', text: line.trim().replace(/^_(.*)_$/, '$1') });
    }
  }
  closeQa();
  return out;
}

/** The compiled Origin Sheet: parts as shaded strips, questions in mid, answers in the serif. */
export function SheetView({ md, limitParts }: { md: string; limitParts?: number }) {
  let parts = 0;
  const blocks: SheetBlock[] = [];
  for (const b of sheetBlocks(md)) {
    if (b.kind === 'part') parts++;
    if (limitParts !== undefined && parts > limitParts) break;
    blocks.push(b);
  }
  return (
    <div className="flex flex-col gap-2" data-testid="sheet-view">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'title':
            return (
              <p key={i} className="px-2.5">
                {b.text}
              </p>
            );
          case 'part':
            return (
              <div key={i} className="mt-2 bg-paper-2 px-2.5 py-[3px]">
                {b.text}
              </div>
            );
          case 'qa':
            return (
              <div key={i} className="flex flex-col gap-0.5 px-2.5">
                <span className="text-mid">{b.q}</span>
                <span className="font-serif text-[16px] leading-[1.5] whitespace-pre-wrap">{b.a}</span>
              </div>
            );
          case 'text':
            return (
              <p key={i} className="px-2.5 font-serif text-mid">
                {inline(b.text)}
              </p>
            );
        }
      })}
    </div>
  );
}

/** A State of Me style note: "# Title", "## Sub", "- bullet", paragraphs. */
export function MarkdownView({ md, maxLines }: { md: string; maxLines?: number }) {
  const lines = md.replace(/\r\n?/g, '\n').split('\n');
  const shown = maxLines !== undefined ? lines.slice(0, maxLines) : lines;
  return (
    <div className="flex flex-col gap-1">
      {shown.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return null;
        if (/^#\s/.test(line)) return null; // the "# State of Me" title is the section header's job
        if (/^#{2,6}\s/.test(line))
          return (
            <p key={i} className="mt-2 first:mt-0">
              {line.replace(/^#{2,6}\s+/, '')}
            </p>
          );
        if (/^\s*[-*•]\s+/.test(line))
          return (
            <p key={i} className="flex gap-2 font-serif leading-[1.5]">
              <span aria-hidden="true" className="text-mid">
                ·
              </span>
              <span>{inline(line.replace(/^\s*[-*•]\s+/, ''))}</span>
            </p>
          );
        return (
          <p key={i} className="font-serif leading-[1.5]">
            {inline(line)}
          </p>
        );
      })}
    </div>
  );
}

export function paragraphs(md: string): string[] {
  return md
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
}

/** The game master's letter with the red pixel drop cap. `firstOnly` shows the opening paragraph. */
export function LetterView({ md, firstOnly = false }: { md: string; firstOnly?: boolean }) {
  const paras = paragraphs(md);
  const first = paras[0] ?? '';
  const rest = firstOnly ? [] : paras.slice(1);
  return (
    <div className="letter">
      <p>
        <span className="drop">{first.charAt(0)}</span>
        {inline(first.slice(1))}
      </p>
      {rest.map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
    </div>
  );
}

/** Affirmations under a letter: italic serif lines above a hairline, as on the Morning mockup. */
export function AffirmationLines({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1.5 border-t border-faint pt-2">
      {lines.map((a, i) => (
        <p key={i} className="font-serif text-[15px] leading-[1.45] italic">
          {a}
        </p>
      ))}
    </div>
  );
}
