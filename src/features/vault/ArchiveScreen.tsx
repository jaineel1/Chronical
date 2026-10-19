import { useDeferredValue, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router';
import type { Prompt } from '@/data/types';
import { copyText } from '@/lib/clipboard';
import { formatTokens } from '@/lib/prompt/shared';
import { Button, Empty, Section, SectionHeader, TextArea, TextInput } from '@/ui/primitives';
import { KIND_LABEL, formatStamp, plural } from './format';
import { OriginRerun } from './OriginRerun';
import { usePrompt, usePromptsNewestFirst } from './queries';
import { RowLink, VaultPage } from './VaultPage';

/** Red "no reply", red "did not parse", or mid "parsed". */
export function ReplyTag({ prompt }: { prompt: Prompt }) {
  if (!prompt.replyMd) return <span className="shrink-0 text-red">no reply</span>;
  if (!prompt.parsedOk) return <span className="shrink-0 text-red">did not parse</span>;
  return <span className="shrink-0 text-mid">parsed</span>;
}

export function ArchiveList() {
  const prompts = usePromptsNewestFirst(500);
  const [query, setQuery] = useState('');
  const q = useDeferredValue(query.trim().toLowerCase());
  const shown = useMemo(() => (prompts ?? []).filter((p) => !q || `${p.promptMd}\n${p.replyMd ?? ''}`.toLowerCase().includes(q)), [prompts, q]);
  const total = prompts?.length ?? 0;

  return (
    <VaultPage title="Archive" meta={prompts ? plural(total, 'prompt') : undefined}>
      <SectionHeader title="Every prompt and reply" note={q ? `${shown.length} of ${total} match` : 'newest first'} />
      <Section className="gap-1">
        <TextInput type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search prompts and replies" aria-label="Search prompts and replies" />
        {prompts === undefined ? null : total === 0 ? (
          <div className="pt-2">
            <Empty action={<Link to="/campfire">Open the Campfire</Link>}>Your first prompt is written at the Campfire tonight.</Empty>
          </div>
        ) : shown.length === 0 ? (
          <p className="pt-2 text-mid">Nothing matches “{query.trim()}”.</p>
        ) : (
          <div className="flex flex-col" data-testid="archive-list">
            {shown.map((p) => (
              <RowLink
                key={p.id}
                to={`/vault/archive/${p.id}`}
                testId="archive-row"
                title={`${KIND_LABEL[p.kind]} · ${p.model}`}
                right={<ReplyTag prompt={p} />}
                sub={`${formatStamp(p.sentAt)} · ~${formatTokens(p.tokensEst)} tokens`}
              />
            ))}
          </div>
        )}
      </Section>
    </VaultPage>
  );
}

function CopyButton({ text, label, testId }: { text: string; label: string; testId?: string }) {
  const [state, setState] = useState<'idle' | 'ok' | 'failed'>('idle');
  return (
    <span className="flex items-baseline gap-3">
      <Button
        variant="outline"
        data-testid={testId}
        onClick={async () => {
          const ok = await copyText(text);
          setState(ok ? 'ok' : 'failed');
        }}
      >
        {state === 'ok' ? 'Copied' : label}
      </Button>
      {state === 'failed' ? <span className="text-red">Copy was blocked. Select the text and copy it yourself.</span> : null}
    </span>
  );
}

export function ArchiveDetail() {
  const { id } = useParams();
  const prompt = usePrompt(id);
  const back = { to: '/vault/archive', label: 'Archive' };
  // An unanswered origin prompt opens as a hand-off. Keep that view after the paste lands, so the
  // suggestions it produces stay on screen to be added.
  const [handoff, setHandoff] = useState<boolean | null>(null);
  const canHandoff = !!prompt && !prompt.replyMd && prompt.kind === 'origin';
  useEffect(() => {
    if (prompt && handoff === null) setHandoff(canHandoff);
  }, [prompt, handoff, canHandoff]);
  const showHandoff = handoff ?? canHandoff;

  if (prompt === undefined) return <VaultPage title="Archive" back={back}>{null}</VaultPage>;
  if (prompt === null)
    return (
      <VaultPage title="Archive" back={back}>
        <Empty action={<Link to="/vault/archive">Back to the Archive</Link>}>This prompt is no longer here.</Empty>
      </VaultPage>
    );

  const kind = KIND_LABEL[prompt.kind];
  const tokens = `~${formatTokens(prompt.tokensEst)} tokens`;

  return (
    <VaultPage title={`${kind} prompt`} meta={formatStamp(prompt.sentAt)} back={back}>
      {showHandoff ? (
        <>
          <SectionHeader title={`${kind} · ${prompt.model}`} note={<ReplyTag prompt={prompt} />} />
          <Section className="gap-3">
            <p className="text-mid">
              Not run yet. Copy it into Claude and paste the reply here: it rewrites your State of Me and suggests skills, routines and goals to add. {tokens}.
            </p>
            <OriginRerun promptMd={prompt.promptMd} promptId={prompt.id} />
          </Section>
        </>
      ) : (
        <>
          <SectionHeader title={`${kind} · ${prompt.model}`} note={tokens} />
          <Section className="gap-2">
            <TextArea readOnly value={prompt.promptMd} rows={12} aria-label="Prompt" onFocus={(e) => e.currentTarget.select()} data-testid="archive-prompt" />
            <CopyButton text={prompt.promptMd} label="Copy prompt again" testId="copy-prompt-again" />
          </Section>
          <SectionHeader title="Reply" note={<ReplyTag prompt={prompt} />} />
          <Section className="gap-2 pb-2">
            {prompt.replyMd ? (
              <>
                <TextArea readOnly value={prompt.replyMd} rows={12} aria-label="Reply" data-testid="archive-reply" />
                <span className="flex flex-wrap items-baseline gap-3">
                  <CopyButton text={prompt.replyMd} label="Copy reply" />
                  {prompt.repliedAt ? <span className="text-mid">Pasted {formatStamp(prompt.repliedAt)}</span> : null}
                </span>
              </>
            ) : prompt.kind === 'nightly' ? (
              <Link to="/campfire" className="self-start">
                Open Campfire to paste
              </Link>
            ) : (
              <p className="text-mid">No reply was pasted for this prompt. Copy it again to run it.</p>
            )}
          </Section>
        </>
      )}
    </VaultPage>
  );
}
