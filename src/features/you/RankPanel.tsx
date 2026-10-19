import { useMemo, useRef } from 'react';
import { useProfile } from '@/data/hooks';
import { promptRepo } from '@/data/repo';
import { buildSkillRankPrompt } from '@/lib/prompt/skill';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import { PromptHandoff, type HandoffResult } from '@/ui/PromptHandoff';
import { Button, SectionHeader } from '@/ui/primitives';
import { useSkillsForRank } from './queries';
import { applySkillRankReply } from './rank';

/** "Rank again": one prompt for every skill, the reply pasted back here. */
export function RankPanel({ onClose }: { onClose: () => void }) {
  const profile = useProfile();
  const skills = useSkillsForRank();
  const sent = useRef<{ id: string; md: string } | null>(null);

  const promptMd = useMemo(() => {
    if (!skills || profile === undefined) return '';
    return buildSkillRankPrompt({
      displayName: profile?.displayName ?? '',
      stateOfMeMd: profile?.stateOfMeMd,
      excludeMoney: profile?.settings.excludeMoney,
      skills,
    });
  }, [skills, profile]);

  async function promptId(): Promise<string> {
    if (sent.current && sent.current.md === promptMd) return sent.current.id;
    const row = await promptRepo.create('skill_rank', MODEL_LABEL.skill_rank, promptMd);
    sent.current = { id: row.id, md: promptMd };
    return row.id;
  }

  async function onReply(replyMd: string): Promise<HandoffResult> {
    const id = await promptId();
    const r = await applySkillRankReply(replyMd, id);
    return { ok: r.ok, error: r.error, message: r.message };
  }

  const count = skills?.length ?? 0;
  return (
    <section aria-label="Rank again" className="flex flex-col gap-2" data-testid="rank-panel">
      <SectionHeader
        title="Rank again"
        note={`${count} ${count === 1 ? 'skill' : 'skills'}`}
        action={
          <Button variant="text" onClick={onClose}>
            Close
          </Button>
        }
      />
      <div className="flex flex-col gap-3 px-2.5">
        <p className="text-mid">
          Claude ranks every skill against everyone and against people who practise it, then writes the next milestone for each. Levels you
          earned from logged hours are replaced by the new ranking.
        </p>
        {promptMd ? (
          <PromptHandoff
            promptMd={promptMd}
            model={MODEL_LABEL.skill_rank}
            copyLabel="Copy the ranking prompt"
            pastePlaceholder="Paste Claude's reply here. It starts with ## ASSESSMENT."
            onCopied={async () => {
              await promptId();
            }}
            onReply={onReply}
          />
        ) : null}
      </div>
    </section>
  );
}
