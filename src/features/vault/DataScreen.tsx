import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useProfile } from '@/data/hooks';
import { exportBackup, importBackup, profileRepo, promptRepo, resetAll } from '@/data/repo';
import { startOwnGame } from '@/data/seed';
import type { BackupFile, Profile } from '@/data/types';
import { downloadText } from '@/lib/clipboard';
import { toDayKey } from '@/lib/dates';
import { Button, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { dayOf, formatBytes, formatStamp, plural } from './format';
import { VaultPage } from './VaultPage';

const TABLE_LABEL: Record<string, [string, string]> = {
  dayLogs: ['day log', 'day logs'],
  routines: ['routine', 'routines'],
  routineLogs: ['routine tick', 'routine ticks'],
  goals: ['goal', 'goals'],
  skills: ['skill', 'skills'],
  people: ['person', 'people'],
  books: ['book', 'books'],
  prompts: ['prompt', 'prompts'],
  affirmations: ['kept affirmation', 'kept affirmations'],
};

function isBackupFile(x: unknown): x is BackupFile {
  const b = x as Partial<BackupFile> | null;
  return !!b && b.app === 'chronicle' && b.version === 1 && typeof b.tables === 'object' && b.tables !== null;
}

function summarize(file: BackupFile): { total: number; parts: string[] } {
  let total = 0;
  const parts: string[] = [];
  for (const [name, rows] of Object.entries(file.tables)) {
    const n = Array.isArray(rows) ? rows.length : 0;
    total += n;
    const label = TABLE_LABEL[name];
    if (label && n) parts.push(`${n.toLocaleString('en-IN')} ${n === 1 ? label[0] : label[1]}`);
  }
  return { total, parts };
}

function fileDate(): string {
  return toDayKey(new Date());
}

/** The backup without the API key: a file that travels should not carry a secret. */
async function backupWithoutKey(): Promise<BackupFile> {
  const backup = await exportBackup();
  const profiles = (backup.tables.profile ?? []) as Profile[];
  backup.tables.profile = profiles.map((p) => ({ ...p, settings: { ...p.settings, apiKey: undefined } }));
  return backup;
}

const DANGER = 'inline-flex h-9 cursor-pointer items-center justify-center whitespace-nowrap border border-red bg-transparent px-3 text-red disabled:cursor-default disabled:opacity-50';

export function DataScreen() {
  const profile = useProfile();
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [storage, setStorage] = useState<{ usage?: number; quota?: number; persisted?: boolean } | null>(null);
  const [exported, setExported] = useState<string | null>(null);
  const [pending, setPending] = useState<{ file: BackupFile; name: string } | null>(null);
  const [importMsg, setImportMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [datasetMsg, setDatasetMsg] = useState<string | null>(null);
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    const s = typeof navigator !== 'undefined' ? navigator.storage : undefined;
    void (async () => {
      const est = s?.estimate ? await s.estimate().catch(() => undefined) : undefined;
      const persisted = s?.persisted ? await s.persisted().catch(() => undefined) : undefined;
      if (live) setStorage({ usage: est?.usage, quota: est?.quota, persisted });
    })();
    return () => {
      live = false;
    };
  }, [importMsg]);

  async function exportAll() {
    const backup = await backupWithoutKey();
    const name = `chronicle-backup-${fileDate()}.json`;
    downloadText(name, JSON.stringify(backup, null, 2), 'application/json');
    setExported(`Saved ${name}: ${summarize(backup).total.toLocaleString('en-IN')} rows.`);
  }

  async function chooseFile(f: File | undefined) {
    setImportMsg(null);
    setPending(null);
    if (!f) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(await f.text());
    } catch {
      setImportMsg({ ok: false, text: `${f.name} is not a JSON file.` });
      return;
    }
    if (!isBackupFile(parsed)) {
      setImportMsg({ ok: false, text: `${f.name} is not a Chronicle backup.` });
      return;
    }
    setPending({ file: parsed, name: f.name });
  }

  async function confirmImport() {
    if (!pending) return;
    setBusy(true);
    try {
      const keptKey = profile?.settings.apiKey;
      await importBackup(pending.file, 'replace');
      const restored = await profileRepo.get();
      if (restored && keptKey && !restored.settings.apiKey) await profileRepo.updateSettings({ apiKey: keptKey });
      const { total, parts } = summarize(pending.file);
      setImportMsg({ ok: true, text: `Restored ${total.toLocaleString('en-IN')} rows${parts.length ? `: ${parts.join(', ')}` : ''}.` });
      setPending(null);
    } catch (e) {
      setImportMsg({ ok: false, text: e instanceof Error ? e.message : 'The import failed. Nothing was changed.' });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function exportDataset() {
    const rows = (await promptRepo.dataset()).sort((a, b) => a.sentAt.localeCompare(b.sentAt));
    if (rows.length === 0) {
      setDatasetMsg('No parsed replies yet. Every night you paste adds one line.');
      return;
    }
    const lines = rows.map((p) =>
      JSON.stringify({ prompt: p.promptMd, reply: p.replyMd, kind: p.kind, date: p.subject && /^\d{4}-\d{2}-\d{2}$/.test(p.subject) ? p.subject : dayOf(p.sentAt) }),
    );
    downloadText(`chronicle-dataset-${fileDate()}.jsonl`, `${lines.join('\n')}\n`, 'application/x-ndjson');
    setDatasetMsg(`Saved ${plural(rows.length, 'pair')}.`);
  }

  function exportStateOfMe() {
    if (!profile) return;
    const md = [
      profile.stateOfMeMd?.trim() || '# State of Me\n\n_Not written yet._',
      '',
      '---',
      '',
      profile.originSheetMd?.trim() || '# Origin Sheet\n\n_Not answered yet._',
      '',
    ].join('\n');
    downloadText(`chronicle-state-of-me-${fileDate()}.md`, md, 'text/markdown;charset=utf-8');
  }

  async function ownGame() {
    setBusy(true);
    await startOwnGame();
    navigate('/onboarding');
  }

  async function resetEverything() {
    if (confirm.trim() !== 'RESET') return;
    setBusy(true);
    await resetAll();
    await profileRepo.ensure('');
    navigate('/onboarding');
  }

  async function askToPersist() {
    const ok = await navigator.storage?.persist?.().catch(() => false);
    setStorage((s) => ({ ...(s ?? {}), persisted: !!ok }));
  }

  const meta = storage?.usage !== undefined ? `${formatBytes(storage.usage)} on this device` : 'this device';
  const pendingSummary = pending ? summarize(pending.file) : null;

  return (
    <VaultPage title="Data" meta={meta}>
      <SectionHeader title="Backup" note="once a week is enough" />
      <Section className="gap-3 pb-2">
        <p className="text-mid">Everything in the game as one JSON file. Keep it somewhere that is not this phone. The API key is never written into it.</p>
        <span className="flex flex-wrap items-center gap-3">
          <Button onClick={exportAll} data-testid="export-backup">
            Export backup
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
            Import backup
          </Button>
          <input ref={fileRef} type="file" accept="application/json,.json" className="sr-only" tabIndex={-1} aria-hidden="true" onChange={(e) => void chooseFile(e.target.files?.[0])} data-testid="import-file" />
        </span>
        {exported ? <span className="text-mid">{exported}</span> : null}
        {pending && pendingSummary ? (
          <div className="flex flex-col gap-2 border border-dashed border-red p-3" data-testid="import-confirm">
            <span>
              Replace everything on this device with {pending.name}
              {pending.file.exportedAt ? `, saved ${formatStamp(pending.file.exportedAt)}` : ''}?
            </span>
            <span className="text-mid">
              {pendingSummary.total.toLocaleString('en-IN')} rows{pendingSummary.parts.length ? `: ${pendingSummary.parts.join(', ')}` : ''}. What is here now is
              deleted first.
            </span>
            <span className="flex flex-wrap items-center gap-4">
              <button type="button" className={DANGER} onClick={confirmImport} disabled={busy}>
                Replace everything
              </button>
              <Button variant="text" className="px-0!" onClick={() => setPending(null)} disabled={busy}>
                Cancel
              </Button>
            </span>
          </div>
        ) : null}
        {importMsg ? <span className={importMsg.ok ? 'text-mid' : 'text-red'}>{importMsg.text}</span> : null}
      </Section>

      <SectionHeader title="Exports" />
      <Section className="gap-3 pb-2">
        <div className="flex flex-col gap-1">
          <Button variant="outline" className="self-start" onClick={exportDataset} data-testid="export-dataset">
            Export dataset
          </Button>
          <span className="text-mid">Every prompt with a reply that parsed, one JSON line each: the start of your own fine-tuning set.</span>
          {datasetMsg ? <span className="text-mid">{datasetMsg}</span> : null}
        </div>
        <div className="flex flex-col gap-1">
          <Button variant="outline" className="self-start" onClick={exportStateOfMe}>
            Export State of Me + Origin Sheet
          </Button>
          <span className="text-mid">One markdown file you can read, print, or paste into any chat.</span>
        </div>
      </Section>

      <SectionHeader title="Storage" note={storage?.persisted ? 'kept by the browser' : undefined} />
      <Section className="gap-2 pb-2">
        <p className="text-mid">
          {storage?.usage !== undefined
            ? `Chronicle uses ${formatBytes(storage.usage)} here${storage.quota ? `, with about ${formatBytes(storage.quota)} free for it` : ''}.`
            : 'Everything lives in this browser’s database on this device.'}
        </p>
        {storage && storage.persisted === false && typeof navigator.storage?.persist === 'function' ? (
          <Button variant="text" className="self-start px-0!" onClick={askToPersist}>
            Ask the browser to keep it
          </Button>
        ) : null}
        <p className="text-mid">
          On iPhone, Safari can delete a site&apos;s data after 7 days without a visit. Add Chronicle to the Home Screen (Share, then Add to Home Screen) and export
          a backup every week.
        </p>
      </Section>

      <SectionHeader title="Start over" />
      <Section className="gap-4 pb-2">
        {profile?.settings.demo ? (
          <div className="flex flex-col gap-1">
            <Button variant="outline" className="self-start" onClick={ownGame} disabled={busy} data-testid="start-own-game">
              Start my own game
            </Button>
            <span className="text-mid">Clears the demo world and opens the Origin Sheet.</span>
          </div>
        ) : null}
        <div className="flex flex-col gap-2">
          <span className="text-mid">Reset deletes every log, letter, routine and answer on this device. Export a backup first. Type RESET to confirm.</span>
          <span className="flex flex-wrap items-center gap-3">
            <span className="w-28">
              <TextInput value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="RESET" aria-label="Type RESET to confirm" autoComplete="off" spellCheck={false} />
            </span>
            <button type="button" className={DANGER} onClick={resetEverything} disabled={busy || confirm.trim() !== 'RESET'} data-testid="reset-everything">
              Reset everything
            </button>
          </span>
        </div>
      </Section>
    </VaultPage>
  );
}
