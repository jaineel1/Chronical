import { afterEach, describe, expect, it, vi } from 'vitest';
import { ANTHROPIC_MESSAGES_URL, ClaudeApiError, callClaude } from './anthropic';

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

function mockFetch(impl: (url: string, init: RequestInit) => Promise<Response>) {
  const fn = vi.fn(impl);
  vi.stubGlobal('fetch', fn);
  return fn;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callClaude', () => {
  it('posts one user message with the right headers and returns the text', async () => {
    const fetchMock = mockFetch(async () =>
      jsonResponse(200, {
        id: 'msg_1',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: '## BRIEF\n' },
          { type: 'text', text: 'Day 1.' },
        ],
      }),
    );
    const text = await callClaude({ apiKey: ' sk-ant-test ', model: 'claude-haiku-4-5', prompt: 'Hello' });
    expect(text).toBe('## BRIEF\nDay 1.');
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe(ANTHROPIC_MESSAGES_URL);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'x-api-key': 'sk-ant-test',
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
      'content-type': 'application/json',
    });
    expect(JSON.parse(String(init.body))).toEqual({ model: 'claude-haiku-4-5', max_tokens: 4000, messages: [{ role: 'user', content: 'Hello' }] });
  });

  it('passes maxTokens through', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(200, { content: [{ type: 'text', text: 'ready' }] }));
    await callClaude({ apiKey: 'k', model: 'm', prompt: 'p', maxTokens: 16 });
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1].body)).max_tokens).toBe(16);
  });

  it('turns a 401 into a plain message', async () => {
    mockFetch(async () => jsonResponse(401, { type: 'error', error: { type: 'authentication_error', message: 'invalid x-api-key' } }));
    const err = await callClaude({ apiKey: 'bad', model: 'm', prompt: 'p' }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ClaudeApiError);
    expect((err as ClaudeApiError).status).toBe(401);
    expect((err as ClaudeApiError).type).toBe('authentication_error');
    expect((err as ClaudeApiError).message).toContain('The key was rejected (401)');
  });

  it('explains rate limits, overload and unknown models', async () => {
    mockFetch(async () => jsonResponse(529, { type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }));
    await expect(callClaude({ apiKey: 'k', model: 'm', prompt: 'p' })).rejects.toThrow('overloaded right now (529)');
    mockFetch(async () => jsonResponse(429, { type: 'error', error: { type: 'rate_limit_error', message: 'slow down' } }));
    await expect(callClaude({ apiKey: 'k', model: 'm', prompt: 'p' })).rejects.toThrow('(429)');
    mockFetch(async () => jsonResponse(404, { type: 'error', error: { type: 'not_found_error', message: 'model: claude-nope' } }));
    await expect(callClaude({ apiKey: 'k', model: 'claude-nope', prompt: 'p' })).rejects.toThrow('Check the model name in Settings. Claude said: model: claude-nope');
  });

  it('copes with a non-JSON error body and a network failure', async () => {
    mockFetch(async () => new Response('<html>bad gateway</html>', { status: 502 }));
    await expect(callClaude({ apiKey: 'k', model: 'm', prompt: 'p' })).rejects.toThrow('Anthropic had a problem (502)');
    mockFetch(async () => {
      throw new TypeError('Failed to fetch');
    });
    const err = await callClaude({ apiKey: 'k', model: 'm', prompt: 'p' }).catch((e: unknown) => e);
    expect((err as ClaudeApiError).status).toBe(0);
    expect((err as ClaudeApiError).message).toContain('Could not reach api.anthropic.com');
  });

  it('refuses to call without a key, and rejects an empty reply', async () => {
    const fetchMock = mockFetch(async () => jsonResponse(200, { content: [] }));
    await expect(callClaude({ apiKey: '   ', model: 'm', prompt: 'p' })).rejects.toThrow('Add an API key');
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(callClaude({ apiKey: 'k', model: 'm', prompt: 'p' })).rejects.toThrow('no text');
  });
});
