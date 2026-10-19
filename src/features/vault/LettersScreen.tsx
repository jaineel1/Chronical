import { useState } from 'react';
import { Link } from 'react-router';
import { countWords } from '@/lib/compile/originSheet';
import { formatLongDate, formatShortDate } from '@/lib/dates';
import { Button, Empty, Section, SectionHeader } from '@/ui/primitives';
import { AffirmationLines, LetterView } from '@/features/onboarding/views';
import { plural } from './format';
import { useKeptAffirmations, useLetters } from './queries';
import { VaultPage } from './VaultPage';

const PAGE = 30;

export function LettersScreen() {
  const letters = useLetters();
  const kept = useKeptAffirmations();
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const [limit, setLimit] = useState(PAGE);

  const toggle = (id: string) =>
    setOpen((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <VaultPage title="Letters" meta={letters ? plural(letters.length, 'letter') : undefined}>
      {letters === undefined ? null : letters.length === 0 ? (
        <Empty action={<Link to="/campfire">Open the Campfire</Link>}>Log tonight at the Campfire and your first letter lands here in the morning.</Empty>
      ) : (
        letters.slice(0, limit).map((log, i) => {
          const md = log.briefMd ?? '';
          const whole = i === 0 || open.has(log.id);
          return (
            <article key={log.id} className="flex flex-col gap-2 pb-2" data-testid="letter">
              <SectionHeader title={formatLongDate(log.date)} note={plural(countWords(md), 'word')} />
              <Section className="gap-3">
                <LetterView md={md} firstOnly={!whole} />
                {i > 0 ? (
                  <Button variant="text" className="self-start" onClick={() => toggle(log.id)}>
                    {whole ? 'Show less' : 'Read the whole letter'}
                  </Button>
                ) : null}
                {whole ? <AffirmationLines lines={log.affirmations} /> : null}
              </Section>
            </article>
          );
        })
      )}
      {letters && letters.length > limit ? (
        <Section>
          <Button variant="text" className="self-start" onClick={() => setLimit((l) => l + PAGE)}>
            Show {Math.min(PAGE, letters.length - limit)} older letters
          </Button>
        </Section>
      ) : null}

      <SectionHeader title="Kept affirmations" note={kept ? `${kept.length}` : undefined} />
      <Section className="gap-0 pb-2">
        {kept === undefined ? null : kept.length === 0 ? (
          <p className="text-mid">Tap Keep under a morning affirmation and it stays here, with its date.</p>
        ) : (
          kept.map((a) => (
            <div key={a.id} className="flex items-baseline justify-between gap-4 border-b border-faint py-2 last:border-b-0">
              <p className="font-serif text-[15px] leading-[1.45] italic">{a.text}</p>
              <span className="shrink-0 text-mid">{formatShortDate(a.date)}</span>
            </div>
          ))
        )}
      </Section>
    </VaultPage>
  );
}
