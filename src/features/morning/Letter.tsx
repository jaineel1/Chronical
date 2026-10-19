import type { ReactNode } from 'react';
import { toParagraphs } from './letterText';

/** **bold** and *italic*, nothing else; stray markers are dropped. React escapes the rest. */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*|\*[^*\s][^*]*\*)/g).map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i} className="font-medium">{part.slice(2, -2)}</strong>;
    if (/^\*[^*\s][^*]*\*$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    return part.replace(/\*+/g, '');
  });
}

/**
 * The game master's letter in the serif face with the red pixel drop cap. `paragraphs` overrides
 * the text shown (the phone shows the first two sentences until "Read the whole letter").
 */
export function Letter({ md, paragraphs, large = false }: { md: string; paragraphs?: string[]; large?: boolean }) {
  const shown = paragraphs ?? toParagraphs(md);
  return (
    <div className={`letter ${large ? 'text-[18px] leading-[1.6]' : ''}`} data-testid="letter">
      {shown.map((p, i) => {
        if (i > 0) return <p key={i}>{inline(p)}</p>;
        const clean = p.replace(/^[*_"“]+/, '');
        return (
          <p key={i}>
            <span className={`drop ${large ? 'mt-1.5 mr-2.5 text-[58px]' : ''}`}>{clean.charAt(0)}</span>
            {inline(clean.slice(1))}
          </p>
        );
      })}
    </div>
  );
}

/** Plain serif paragraphs without the drop cap (digests, State of Me excerpts). */
export function Prose({ md }: { md: string }) {
  return (
    <div className="letter">
      {toParagraphs(md).map((p, i) => (
        <p key={i}>{inline(p)}</p>
      ))}
    </div>
  );
}
