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
  return bytesToBase64(new TextEncoder().encode(text));
}

export function bytesToBase64(bytes: Uint8Array): string {
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
export async function putFile(ref: GitHubRepo, path: string, text: string, sha: string | undefined, message: string): Promise<string> {
  return putBase64(ref, path, encodeBase64(text), sha, message);
}

/** Writes raw bytes (an image) and returns the new sha. */
export async function putBytes(ref: GitHubRepo, path: string, bytes: Uint8Array, sha: string | undefined, message: string): Promise<string> {
  return putBase64(ref, path, bytesToBase64(bytes), sha, message);
}

export interface RemoteEntry {
  name: string;
  path: string;
  sha: string;
}

/** The files in a folder of the repo; an empty list when the folder does not exist yet. */
export async function listDir({ repo, token }: GitHubRepo, path: string): Promise<RemoteEntry[]> {
  const res = await call(contentsUrl(repo, path), { headers: headers(token), cache: 'no-store' });
  if (res.status === 404) return [];
  if (!res.ok) throw await failure(res, repo);
  const body = (await res.json()) as unknown;
  if (!Array.isArray(body)) throw new Error(`${path} in ${repo} is a file, not a folder.`);
  return (body as { type: string; name: string; path: string; sha: string }[]).filter((e) => e.type === 'file').map(({ name, path: p, sha }) => ({ name, path: p, sha }));
}

/** A file's raw bytes. */
export async function getBytes({ repo, token }: GitHubRepo, path: string): Promise<Uint8Array<ArrayBuffer>> {
  const res = await call(contentsUrl(repo, path), { headers: headers(token, 'application/vnd.github.raw+json'), cache: 'no-store' });
  if (!res.ok) throw await failure(res, repo);
  return new Uint8Array(await res.arrayBuffer());
}

export async function deleteFile({ repo, token }: GitHubRepo, path: string, sha: string, message: string): Promise<void> {
  const res = await call(contentsUrl(repo, path), {
    method: 'DELETE',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, sha }),
  });
  // Already gone is the outcome we wanted.
  if (res.status === 404) return;
  if (res.status === 409) throw new GitHubConflict('The data on GitHub changed while syncing.');
  if (!res.ok) throw await failure(res, repo);
}

async function putBase64({ repo, token }: GitHubRepo, path: string, content: string, sha: string | undefined, message: string): Promise<string> {
  const res = await call(contentsUrl(repo, path), {
    method: 'PUT',
    headers: { ...headers(token), 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, content, ...(sha ? { sha } : {}) }),
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
