import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Page } from '@/app/Shell';
import { promptRepo } from '@/data/repo';
import type { Digest } from '@/data/types';
import { formatMonth, formatRange } from '@/lib/game/calendar';
import { applyWeeklyReply, parseWeeklyReply, type PeriodKind } from '@/lib/parse/weekly';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import { buildMonthlyPrompt, buildWeeklyPrompt } from '@/lib/prompt/weekly';
import { PromptHandoff, type HandoffResult } from '@/ui/PromptHandoff';
import { Section, SectionHeader } from '@/ui/primitives';
import { Prose } from '@/features/morning/Letter';
import { loadWeeklyBossInput } from '@/features/morning/bossQueries';
import { gatherMonthlyInput, gatherWeeklyInput } from './gather';
import { TextButton } from './parts';
import { useLatestDigest } from './queries';

interface Built {
  promptMd: string;
  periodStart: string;
  periodEnd: string;
  label: string;
}

const COPY: Record<PeriodKind, { intro: string; copy: string; saved: string; savedNoState: string }> = {
  weekly: {
    intro: 'Seven nights in one prompt. Claude writes the week in 150 words, rewrites your State of Me, sets three quests for the week and a boss your routines can beat.',
    copy: 'Copy the weekly review',
    saved: 'Week saved. Your State of Me is up to date.',
    savedNoState: 'Week saved. The reply had no State of Me, so yours stayed as it was.',
  },
  monthly: {
    intro: 'The month in one prompt: its weekly digests and every day in a line. Claude writes the month, rewrites your State of Me and sets three quests for the month.',
    copy: 'Copy the monthly digest',
    saved: 'Month saved. Your State of Me is up to date.',
    savedNoState: 'Month saved. The reply had no State of Me, so yours stayed as it was.',
  },
};

/** One line on the boss the reply set, or why it set none. */
function bossNotes(boss: Digest['boss'], errors: string[]): string[] {
  const error = errors.find((e) => e.includes('## BOSS'));
  if (!boss) return error ? [error] : [];
  const unmatched = boss.weakTo.filter((w) => !w.routineId).map((w) => w.name);
  return [
    `Boss for the week: ${boss.name}, ${boss.hp} HP.`,
    ...(unmatched.length ? [`${unmatched.join(', ')} ${unmatched.length === 1 ? 'is' : 'are'} not one of your routines, so ${unmatched.length === 1 ? 'it deals' : 'they deal'} no damage.`] : []),
  ];
}

export function ReviewPanel({ kind, date, onBack }: { kind: PeriodKind; date: string; onBack: () => void }) {
  const built = useLiveQuery(async (): Promise<Built> => {
    if (kind === 'weekly') {
      const input = { ...(await gatherWeeklyInput(date)), boss: await loadWeeklyBossInput(date) };
      return { promptMd: buildWeeklyPrompt(input), periodStart: input.periodStart, periodEnd: input.periodEnd, label: formatRange(input.periodStart, input.periodEnd) };
    }
    const input = await gatherMonthlyInput(date);
    return { promptMd: buildMonthlyPrompt(input), periodStart: input.periodStart, periodEnd: input.periodEnd, label: formatMonth(input.periodStart) };
  }, [kind, date]);
  const latest = useLatestDigest(kind);
  const [promptId, setPromptId] = useState<string>();
  const text = COPY[kind];
  const model = MODEL_LABEL[kind];

  async function record(b: Built): Promise<string> {
    if (promptId) return promptId;
    const p = await promptRepo.create(kind, model, b.promptMd, `${b.periodStart}..${b.periodEnd}`);
    setPromptId(p.id);
    return p.id;
  }

  async function onReply(md: string): Promise<HandoffResult> {
    if (!built) return { ok: false, error: 'Still reading the week. Try again in a moment.' };
    const parsed = parseWeeklyReply(md);
    const id = await record(built);
    if (!parsed.ok) {
      await promptRepo.attachReply(id, md, false);
      return { ok: false, error: parsed.errors[0] };
    }
    const digest = await applyWeeklyReply(parsed, kind, built.periodStart, built.periodEnd, id);
    await promptRepo.attachReply(id, md, true);
    const saved = parsed.stateOfMeMd ? text.saved : text.savedNoState;
    return { ok: true, message: [saved, ...bossNotes(digest.boss, parsed.errors)].join(' ') };
  }

  return (
    <Page>
      <SectionHeader title={kind === 'weekly' ? 'Seven nights' : 'The month'} note={built?.label} />
      <Section>
        <p className="text-mid">{text.intro}</p>
      </Section>
      {built ? (
        <PromptHandoff
          promptMd={built.promptMd}
          model={model}
          copyLabel={text.copy}
          onCopied={async () => {
            await record(built);
          }}
          onReply={onReply}
          pastePlaceholder="Paste Claude's reply here."
        />
      ) : null}
      {latest ? (
        <>
          <SectionHeader title={kind === 'weekly' ? 'Last weekly digest' : 'Last monthly digest'} note={kind === 'weekly' ? formatRange(latest.periodStart, latest.periodEnd) : formatMonth(latest.periodStart)} />
          <Section>
            <Prose md={latest.md} />
          </Section>
        </>
      ) : null}
      <TextButton className="self-start" onClick={onBack}>
        Back to tonight
      </TextButton>
    </Page>
  );
}
