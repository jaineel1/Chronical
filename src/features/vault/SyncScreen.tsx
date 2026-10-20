import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProfile } from '@/data/hooks';
import { inspectRemote, replaceGitHubWithThisDevice, replaceThisDeviceWithGitHub, syncNow, type RemoteSummary } from '@/data/sync';
import { setSyncConfig, useSyncState } from '@/data/syncState';
import { REPO_PATTERN } from '@/lib/sync/github';
import { Button, Field, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { DANGER } from './DataScreen';
import { formatStamp, plural } from './format';
import { VaultPage } from './VaultPage';

function errorText(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

/**
 * /sync (also /vault/sync): link this device to the private GitHub repo that carries the game between
 * the laptop and the iPhone. Reachable before onboarding, so a fresh phone can pull an existing game.
 */
export function SyncScreen() {
  const sync = useSyncState();
  const profile = useProfile();
  const navigate = useNavigate();
  const [repo, setRepo] = useState(sync.config?.repo ?? '');
  const [token, setToken] = useState(sync.config?.token ?? '');
  const [remote, setRemote] = useState<RemoteSummary | null>(null);
  const [checking, setChecking] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const busy = sync.running || checking;
  const hasConfig = !!sync.config;
  const linked = sync.linked;

  const check = useCallback(async () => {
    setChecking(true);
    setRemote(null);
    try {
      setRemote(await inspectRemote());
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    } finally {
      setChecking(false);
    }
  }, []);

  // A device with a repo but no link yet needs to know what GitHub holds before it can choose.
  useEffect(() => {
    if (hasConfig && !linked) void check();
  }, [hasConfig, linked, check]);

  async function save() {
    setMsg(null);
    const r = repo.trim();
    const t = token.trim();
    if (!REPO_PATTERN.test(r)) {
      setMsg({ ok: false, text: 'Write the repo as owner/name, for example jaineel1/chronicle-data.' });
      return;
    }
    if (!t) {
      setMsg({ ok: false, text: 'Paste the token from GitHub first.' });
      return;
    }
    setSyncConfig({ repo: r, token: t });
    if (!linked || r !== sync.config?.repo) await check();
    else setMsg({ ok: true, text: 'Token saved.' });
  }

  async function act(job: () => Promise<string>, after?: () => void) {
    setMsg(null);
    try {
      setMsg({ ok: true, text: await job() });
      after?.();
    } catch (e) {
      setMsg({ ok: false, text: errorText(e) });
    }
  }

  const takeGitHub = () =>
    act(
      async () => {
        await replaceThisDeviceWithGitHub();
        return 'This device now has the game from GitHub.';
      },
      () => navigate('/'),
    );

  const putHere = () =>
    act(async () => {
      await replaceGitHubWithThisDevice();
      return 'This device’s game is on GitHub. Link your other devices to the same repo.';
    });

  const syncAgain = () =>
    act(async () => {
      const r = await syncNow();
      const parts = [r.received ? `${plural(r.received, 'change')} in` : null, r.removed ? `${plural(r.removed, 'row')} removed` : null].filter(Boolean);
      return `Synced. ${parts.length ? `${parts.join(', ')}. ` : ''}${r.pushed ? 'GitHub updated.' : 'GitHub already had everything.'}`;
    });

  function forget() {
    setSyncConfig(null);
    setRepo('');
    setToken('');
    setRemote(null);
    setMsg({ ok: true, text: 'This device no longer syncs. Its data stays here.' });
  }

  const onboarded = !!profile?.onboardedAt;

  return (
    <VaultPage title="Sync" meta={linked ? 'linked to GitHub' : 'this device only'}>
      <SectionHeader title="GitHub" note={linked ? sync.config?.repo : 'not linked'} />
      <Section className="gap-3 pb-2">
        <p className="text-mid">
          Keeps the laptop and the iPhone on the same game through one file, {`chronicle.json`}, in a private GitHub repo. Each device syncs when it opens and
          when it goes to the background. The token and the API key stay on this device.
        </p>
        <Field label="Repo" hint="A private repo, written as owner/name.">
          <TextInput value={repo} onChange={(e) => setRepo(e.target.value)} placeholder="jaineel1/chronicle-data" autoComplete="off" spellCheck={false} autoCapitalize="off" data-testid="sync-repo" />
        </Field>
        <Field label="Token" hint="A fine-grained token with Contents: read and write on that repo only.">
          <TextInput type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="github_pat_…" autoComplete="off" spellCheck={false} data-testid="sync-token" />
        </Field>
        <Button variant={linked ? 'outline' : 'primary'} className="self-start" onClick={save} disabled={busy} data-testid="sync-save">
          {checking ? 'Checking GitHub' : 'Save and check'}
        </Button>
      </Section>

      {hasConfig && !linked && remote ? (
        <>
          <SectionHeader title="Link this device" note="once per device" />
          <Section className="gap-3 pb-2">
            {remote.exists ? (
              <div className="flex flex-col gap-3 border border-dashed border-red p-3" data-testid="sync-choose">
                <span>
                  GitHub has a game{remote.exportedAt ? `, saved ${formatStamp(remote.exportedAt)}` : ''}: {plural(remote.rows, 'row')}. Which one should this device keep?
                </span>
                <div className="flex flex-col gap-1">
                  <button type="button" className={`${DANGER} self-start`} onClick={takeGitHub} disabled={busy} data-testid="sync-take-github">
                    Use GitHub’s game here
                  </button>
                  <span className="text-mid">Replaces everything on this device. Pick this on the iPhone.</span>
                </div>
                {onboarded ? (
                  <div className="flex flex-col gap-1">
                    <Button variant="outline" className="self-start" onClick={putHere} disabled={busy}>
                      Put this device’s game on GitHub
                    </Button>
                    <span className="text-mid">Replaces the file on GitHub. Its history keeps the old one.</span>
                  </div>
                ) : null}
              </div>
            ) : onboarded ? (
              <div className="flex flex-col gap-1">
                <span>GitHub has no game yet. Start it from this device.</span>
                <Button className="self-start" onClick={putHere} disabled={busy} data-testid="sync-put-here">
                  Put this device’s game on GitHub
                </Button>
              </div>
            ) : (
              <span className="text-mid">GitHub has no game yet and neither does this device. Start a game on the laptop first, then come back here.</span>
            )}
          </Section>
        </>
      ) : null}

      {linked ? (
        <>
          <SectionHeader title="Status" note={sync.running ? 'syncing' : undefined} />
          <Section className="gap-3 pb-2">
            <span className={sync.error ? 'text-red' : 'text-mid'}>
              {sync.error ? `Last sync failed: ${sync.error}` : sync.lastSyncAt ? `Last synced ${formatStamp(sync.lastSyncAt)}.` : 'Not synced yet.'}
            </span>
            <span className="flex flex-wrap items-center gap-4">
              <Button onClick={syncAgain} disabled={busy} data-testid="sync-now">
                {sync.running ? 'Syncing' : 'Sync now'}
              </Button>
              <Button variant="text" onClick={forget} disabled={busy}>
                Stop syncing on this device
              </Button>
            </span>
          </Section>
        </>
      ) : null}

      {msg ? (
        <Section>
          <span className={msg.ok ? 'text-mid' : 'text-red'} data-testid="sync-message">
            {msg.text}
          </span>
        </Section>
      ) : null}
    </VaultPage>
  );
}
