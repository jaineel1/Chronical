import { useEffect, useState, type ReactNode } from 'react';
import { copyText, openClaude, readClipboard } from '@/lib/clipboard';
import { estimateTokens, formatTokens } from '@/lib/prompt/shared';
import { Button, TextArea } from './primitives';

export interface HandoffResult {
  ok: boolean;
  /** Shown under the paste box when ok is false, e.g. "No ## BRIEF section. Kept as a draft." */
  error?: string;
  /** Shown briefly when ok is true, e.g. "Letter saved. See you in the morning." */
  message?: string;
}

export interface PromptHandoffProps {
  /** The full markdown to copy. */
  promptMd: string;
  /** Human model name shown next to the button: "Haiku", "Sonnet". */
  model: string;
  /** Called with the pasted reply. Return ok:false with an error to keep the text in the box. */
  onReply: (replyMd: string) => Promise<HandoffResult>;
  /**
   * Called when the player presses the copy button, whether or not the clipboard accepted the text
   * (when it did not, the text is shown for manual copying). Use it to mark the prompt as sent.
   */
  onCopied?: (copyOk: boolean) => void | Promise<void>;
  copyLabel?: string;
  pastePlaceholder?: string;
  /** Pre-fill the paste box (e.g. a kept raw draft). */
  initialReply?: string;
  /** Extra content between the buttons and the paste box (hints, the compiled prompt preview). */
  children?: ReactNode;
  /** Hide the paste half (for flows that only need the copy). */
  hidePaste?: boolean;
}

/**
 * The one hand-off every Claude flow uses: Copy prompt → Open Claude → paste the reply here.
 * Shows the token estimate the way the mockups do ("About 9,200 tokens").
 */
export function PromptHandoff({
  promptMd,
  model,
  onReply,
  onCopied,
  copyLabel,
  pastePlaceholder,
  initialReply = '',
  children,
  hidePaste = false,
}: PromptHandoffProps) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'failed'>('idle');
  const [showRaw, setShowRaw] = useState(false);
  const [reply, setReply] = useState(initialReply);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<HandoffResult | null>(null);
  const tokens = estimateTokens(promptMd);

  useEffect(() => {
    setReply(initialReply);
  }, [initialReply]);

  async function copy() {
    const ok = await copyText(promptMd);
    setCopied(ok ? 'ok' : 'failed');
    if (!ok) setShowRaw(true);
    await onCopied?.(ok);
  }

  async function pasteFromClipboard() {
    const text = await readClipboard();
    if (text) setReply(text);
  }

  async function submit() {
    if (!reply.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await onReply(reply);
      setResult(r);
      if (r.ok) setReply('');
    } catch (e) {
      setResult({ ok: false, error: e instanceof Error ? e.message : 'Something went wrong reading that reply.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-2">
        <Button size="lg" onClick={copy} data-testid="copy-prompt">
          {copied === 'ok' ? 'Copied. Now paste it into Claude' : (copyLabel ?? 'Copy the prompt')}
        </Button>
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-mid">
            For {model}. About {formatTokens(tokens)} tokens.
          </span>
          <span className="flex gap-3">
            <Button variant="text" onClick={openClaude}>
              Open Claude
            </Button>
            <Button variant="text" onClick={() => setShowRaw((v) => !v)}>
              {showRaw ? 'Hide text' : 'Show text'}
            </Button>
          </span>
        </div>
        {copied === 'failed' ? <span className="text-red">Copy was blocked. Select the text below and copy it yourself.</span> : null}
        {showRaw ? <TextArea readOnly value={promptMd} rows={10} onFocus={(e) => e.currentTarget.select()} data-testid="prompt-text" /> : null}
      </div>

      {children}

      {!hidePaste ? (
        <div className="flex flex-col gap-2 border border-dashed border-faint p-3">
          <TextArea
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            rows={6}
            placeholder={pastePlaceholder ?? 'Paste the reply here.'}
            data-testid="reply-text"
          />
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button variant="text" onClick={pasteFromClipboard}>
              Paste from clipboard
            </Button>
            <Button onClick={submit} disabled={busy || !reply.trim()} data-testid="use-reply">
              {busy ? 'Reading…' : 'Use this reply'}
            </Button>
          </div>
          {result?.error ? <span className="text-red">{result.error}</span> : null}
          {result?.ok && result.message ? <span className="text-mid">{result.message}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
