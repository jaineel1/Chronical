/**
 * The one network path in Chronicle: the optional bring-your-own-key call to Claude, off unless the
 * player saves a key in Vault → Settings. Everything else is copy and paste.
 */

export const ANTHROPIC_MESSAGES_URL = 'https://api.anthropic.com/v1/messages';
export const ANTHROPIC_VERSION = '2023-06-01';

export interface CallClaudeInput {
  apiKey: string;
  /** Model id, e.g. settings.models.nightly ("claude-haiku-4-5"). */
  model: string;
  prompt: string;
  maxTokens?: number;
  signal?: AbortSignal;
}

export class ClaudeApiError extends Error {
  /** HTTP status, or 0 when the request never got an answer. */
  readonly status: number;
  /** Anthropic's error type, e.g. "authentication_error". */
  readonly type?: string;

  constructor(message: string, status: number, type?: string) {
    super(message);
    this.name = 'ClaudeApiError';
    this.status = status;
    this.type = type;
  }
}

/** Plain-language message for a failed call. */
export function describeApiFailure(status: number, type?: string, detail?: string): string {
  const said = detail ? ` Claude said: ${detail}` : '';
  switch (status) {
    case 0:
      return 'Could not reach api.anthropic.com. Check the connection, or copy the prompt instead.';
    case 400:
      return `The request was refused (400).${said}`;
    case 401:
      return 'The key was rejected (401). Check that it was copied whole, or make a new one in the Anthropic console.';
    case 402:
      return 'The account behind this key has a billing problem (402).';
    case 403:
      return `This key is not allowed to do that (403).${said}`;
    case 404:
      return `Not found (404). Check the model name in Settings.${said}`;
    case 413:
      return 'The prompt is too large for one request (413).';
    case 429:
      return 'Rate limit or spend limit reached (429). Wait a minute, or copy the prompt instead.';
    case 529:
      return 'Claude is overloaded right now (529). Try again in a few minutes, or copy the prompt instead.';
    default:
      return status >= 500 ? `Anthropic had a problem (${status}). Try again shortly.${said}` : `The call failed (${status}${type ? `, ${type}` : ''}).${said}`;
  }
}

interface MessagesResponse {
  content?: { type: string; text?: string }[];
}

interface ErrorResponse {
  error?: { type?: string; message?: string };
}

/** Send one prompt to the Messages API and return the reply text. Throws ClaudeApiError. */
export async function callClaude({ apiKey, model, prompt, maxTokens = 4000, signal }: CallClaudeInput): Promise<string> {
  const key = apiKey.trim();
  if (!key) throw new ClaudeApiError('Add an API key in Settings first.', 0);
  let res: Response;
  try {
    res = await fetch(ANTHROPIC_MESSAGES_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': ANTHROPIC_VERSION,
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({ model: model.trim(), max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] }),
      signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ClaudeApiError(describeApiFailure(0), 0);
  }

  if (!res.ok) {
    let type: string | undefined;
    let detail: string | undefined;
    try {
      const body = (await res.json()) as ErrorResponse;
      type = body.error?.type;
      detail = body.error?.message;
    } catch {
      /* not JSON: keep the status */
    }
    throw new ClaudeApiError(describeApiFailure(res.status, type, detail), res.status, type);
  }

  const data = (await res.json()) as MessagesResponse;
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text)
    .join('')
    .trim();
  if (!text) throw new ClaudeApiError('Claude answered with no text.', res.status);
  return text;
}
