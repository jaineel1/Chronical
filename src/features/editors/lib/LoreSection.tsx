import { useLiveQuery } from 'dexie-react-hooks';
import { useMemo, useRef, useState } from 'react';
import { promptRepo } from '@/data/repo';
import { parseLoreReply } from '@/lib/parse/lore';
import { buildLorePrompt, type LoreSubjectType } from '@/lib/prompt/lore';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import { PromptHandoff, type HandoffResult } from '@/ui/PromptHandoff';
import { SectionHeader, TextArea } from '@/ui/primitives';
import { useLore } from '../queries';
import { applyLoreReply, loreSubject, rememberedFacts } from './lore';
import { useToday } from './useToday';

const INTRO: Record<LoreSubjectType, string> = {
  skill: 'How you learned it, your best result so far, what is still hard. Claude keeps the facts and logs any results as achievements.',
  person: 'Who they are to you, what you last talked about, what you want from it. Claude keeps the facts and can change how often to reach out.',
  goal: 'Why it matters, what stands in the way, what done looks like. Claude keeps the facts.',
  book: 'What stayed with you and what you want to try. Claude keeps the facts and turns what you took from it into lessons.',
};

function draftKey(type: LoreSubjectType, id: string): string {
  return `chronicle.lore.${type}.${id}`;
}

function readDraft(key: string): string {
  try {
    return window.localStorage.getItem(key) ?? '';
  } catch {
    return '';
  }
}

function writeDraft(key: string, text: string): void {
  try {
    if (text) window.localStorage.setItem(key, text);
    else window.localStorage.removeItem(key);
  } catch {
    /* private mode or blocked storage: the draft just is not kept */
  }
}

/** Plain paragraphs for the game master's reply. */
export function Letter({ md }: { md: string }) {
  const paragraphs = md
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  return (
    <div className="letter">
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

/**
 * "Tell the game master more": free text about one item → lore prompt → pasted reply → facts,
 * achievements, lessons and whitelisted updates. The latest reply is shown as a letter.
 */
export function LoreSection({ type, itemId, onApplied }: { type: LoreSubjectType; itemId: string; onApplied?: () => void }) {
  const today = useToday();
  const history = useLore(type, itemId);
  const subject = useLiveQuery(() => loreSubject(type, itemId, today), [type, itemId, today, history?.length]);
  const key = draftKey(type, itemId);
  const [text, setText] = useState(() => readDraft(key));
  const [message, setMessage] = useState<string | null>(null);
  const sent = useRef<{ id: string; md: string } | null>(null);

  const promptMd = useMemo(() => (subject && text.trim() ? buildLorePrompt(subject, text, { today }) : ''), [subject, text, today]);
  const latest = history?.length ? history[history.length - 1] : undefined;
  const latestReply = useMemo(() => (latest?.structuredMd ? parseLoreReply(latest.structuredMd).replyMd : ''), [latest]);
  const facts = useMemo(() => rememberedFacts(history ?? []), [history]);

  async function promptId(): Promise<string> {
    if (sent.current && sent.current.md === promptMd) return sent.current.id;
    const row = await promptRepo.create('lore', MODEL_LABEL.lore, promptMd, itemId);
    sent.current = { id: row.id, md: promptMd };
    return row.id;
  }

  async function onReply(replyMd: string): Promise<HandoffResult> {
    const id = await promptId();
    const r = await applyLoreReply({ type, itemId, freeText: text, replyMd, promptId: id, today });
    if (r.ok) {
      setMessage(r.message ?? null);
      setText('');
      writeDraft(key, '');
      sent.current = null;
      onApplied?.();
    }
    return { ok: r.ok, error: r.error, message: r.message };
  }

  const count = history?.length ?? 0;
  return (
    <section aria-label="Tell the game master more" className="flex flex-col gap-2">
      <SectionHeader title="Tell the game master more" note={count ? `${count} ${count === 1 ? 'note' : 'notes'} kept` : 'nothing kept yet'} />
      <div className="flex flex-col gap-3 px-2.5">
        <p className="m-0 text-mid">{INTRO[type]}</p>
        <TextArea
          rows={4}
          value={text}
          aria-label="What the game should know"
          placeholder="Write it the way you would say it."
          onChange={(e) => {
            setText(e.target.value);
            writeDraft(key, e.target.value);
            setMessage(null);
          }}
        />
        {promptMd ? (
          <PromptHandoff
            promptMd={promptMd}
            model={MODEL_LABEL.lore}
            pastePlaceholder="Paste Claude's reply here. It starts with ## FACTS."
            onCopied={async () => {
              await promptId();
            }}
            onReply={onReply}
          />
        ) : null}
        {message ? <span className="text-mid">{message}</span> : null}
        {latestReply ? <Letter md={latestReply} /> : null}
        {facts.length ? (
          <div className="flex flex-col gap-1">
            <span className="text-mid">What the game remembers</span>
            <ul className="m-0 flex list-none flex-col gap-1 p-0">
              {facts.map((f) => (
                <li key={f} className="border-l-2 border-faint pl-2">
                  {f}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </section>
  );
}
