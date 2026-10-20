/**
 * The one file Chronicle keeps in the player's private GitHub repo, read and written through the
 * contents API with a fine-grained token (Contents: read and write, that repo only).
 */

const API = 'https://api.github.com';

export interface GitHubRepo {
  /** "owner/name" */
  repo: string;
  token: string;
}

export interface RemoteFile {
  sha: string;
  text: string;
}

/** The file changed on GitHub between reading and writing it: read again and retry. */
export class GitHubConflict extends Error {}

export const REPO_PATTERN = /^[\w.-]+\/[\w.-]+$/;

function headers(token: string, accept = 'application/vnd.github+json'): HeadersInit {
  return { Authorization: `Bearer ${token}`, Accept: accept, 'X-GitHub-Api-Version': '2022-11-28' };
}

/** fetch, with "no connection" turned into words a player can act on. */
async function call(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (e) {
    throw new Error('Could not reach GitHub. Check the internet connection.', { cause: e });
  }
}

function contentsUrl(repo: string, path: string): string {
  return `${API}/repos/${repo}/contents/${path.split('/').map(encodeURIComponent).join('/')}`;
}

async function failure(res: Response, repo: string): Promise<Error> {
  const body = (await res.json().catch(() => null)) as { message?: string } | null;
  const detail = body?.message ? ` GitHub says: ${body.message}` : '';
  if (res.status === 401) return new Error(`GitHub did not accept the token. It may have expired or been revoked.${detail}`);
  if (res.status === 403) return new Error(`The token cannot write to ${repo}. Give it Contents: read and write on that repo.${detail}`);
  if (res.status === 404) return new Error(`GitHub cannot find ${repo} with this token. Check the name and that the token covers it.${detail}`);
  return new Error(`GitHub answered ${res.status}.${detail}`);
}

export function encodeBase64(text: string): string {
  const bytes = new TextEncoder().encode(text);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function decodeBase64(b64: string): string {
  const bin = atob(b64.replace(/\s/g, ''));
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(bytes);
}

/** The file, or null when the repo exists but the file does not yet. */
export async function getFile({ repo, token }: GitHubRepo, path: string): Promise<RemoteFile | null> {
  const res = await call(contentsUrl(repo, path), { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) {
    // 404 means either "no such file" or "no such repo for this token"; only the first is fine.
    const repoRes = await call(`${API}/repos/${repo}`, { headers: headers(token), cache: 'no-store' });
    if (!repoRes.ok) throw await failure(repoRes, repo);
    return null;
  }
  if (!res.ok) throw await failure(res, repo);
  const meta = (await res.json()) as { sha: string; encoding?: string; content?: string };
  if (meta.encoding === 'base64' && meta.content) return { sha: meta.sha, text: decodeBase64(meta.content) };
  // Files over 1 MB come back without content; fetch the raw bytes instead.
  const raw = await call(contentsUrl(repo, path), { headers: headers(token, 'application/vnd.github.raw+json'), cache: 'no-store' });
  if (!raw.ok) throw await failure(raw, repo);
  return { sha: meta.sha, text: await raw.text() };
}

/** Writes the file and returns its new sha. `sha` is the version being replaced (none for a new file). */
export async function putFile({ repo, token }: GitHubRepo, path: string, text: string, sha: string | undefined, message: string): Promise<string> {
  const res = await call(contentsUrl(repo, path), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content: encodeBase64(text), ...(sha ? { sha } : {}) }),
  });
  if (res.status === 409) throw new GitHubConflict('The data on GitHub changed while syncing.');
  if (res.status === 422) {
    const body = (await res.clone().json().catch(() => null)) as { message?: string } | null;
    if (body?.message?.includes('sha')) throw new GitHubConflict('The data on GitHub changed while syncing.');
  }
  if (!res.ok) throw await failure(res, repo);
  const out = (await res.json()) as { content: { sha: string } };
  return out.content.sha;
}
