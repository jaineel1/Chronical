/** Clipboard and hand-off helpers for the paste loop. */

export const CLAUDE_NEW_CHAT_URL = 'https://claude.ai/new';

/** Copy text; returns false when the browser refuses (then the UI shows a select-all textarea). */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall through to the legacy path */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** Read the clipboard when allowed; undefined when the browser says no (the user pastes by hand). */
export async function readClipboard(): Promise<string | undefined> {
  try {
    if (navigator.clipboard?.readText) return await navigator.clipboard.readText();
  } catch {
    /* permission denied or unsupported */
  }
  return undefined;
}

/** Open a new Claude chat in a new tab (or the app on phones that have it). */
export function openClaude(): void {
  window.open(CLAUDE_NEW_CHAT_URL, '_blank', 'noopener');
}

/** Download text as a file. */
export function downloadText(filename: string, text: string, mime = 'text/plain;charset=utf-8'): void {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
