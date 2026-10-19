import { useRef, useState } from 'react';
import { profileRepo, promptRepo } from '@/data/repo';
import { useProfile } from '@/data/hooks';
import { nowIso } from '@/lib/dates';
import { originReplyProblem, parseOriginReply, type OriginReply } from '@/lib/parse/origin';
import { MODEL_LABEL } from '@/lib/prompt/shared';
import { PromptHandoff, type HandoffResult } from '@/ui/PromptHandoff';
import { Button, Section } from '@/ui/primitives';
import { addSuggestions, recordOriginPrompt, type AddedCounts } from '@/features/onboarding/createGame';
import { SuggestionLists, useSuggestions } from '@/features/onboarding/Suggestions';
import { useExistingNames } from './queries';

/**
 * Run the origin prompt (again): copy → Claude → paste. A good reply replaces the State of Me and
 * offers the skills, routines and goals that are not in the game yet as a list to add.
 */
export function OriginRerun({ promptMd, promptId }: { promptMd: string; promptId?: string }) {
  const idRef = useRef<string | null>(promptId ?? null);
  const [reply, setReply] = useState<{ reply: OriginReply; promptId: string } | null>(null);

  async function ensurePromptId(): Promise<string> {
    if (!idRef.current) idRef.current = (await recordOriginPrompt(promptMd)).id;
    return idRef.current;
  }

  async function onReply(md: string): Promise<HandoffResult> {
    const parsed = parseOriginReply(md);
    const id = await ensurePromptId();
    await promptRepo.attachReply(id, md, parsed.ok);
    if (!parsed.ok) return { ok: false, error: originReplyProblem(parsed) };
    await profileRepo.update({ stateOfMeMd: parsed.stateOfMeMd, stateOfMeAt: nowIso() });
    setReply({ reply: parsed, promptId: id });
    return { ok: true, message: 'State of Me updated.' };
  }

  return (
    <div className="flex flex-col gap-3">
      <PromptHandoff
        promptMd={promptMd}
        model={MODEL_LABEL.origin}
        onCopied={async () => {
          await ensurePromptId();
        }}
        onReply={onReply}
        pastePlaceholder="Paste Claude's whole reply here."
      />
      {reply ? <NewSuggestions key={reply.promptId + reply.reply.briefMd.length} reply={reply.reply} promptId={reply.promptId} /> : null}
    </div>
  );
}

function NewSuggestions({ reply, promptId }: { reply: OriginReply; promptId: string }) {
  const existing = useExistingNames();
  if (!existing) return null;
  return <NewSuggestionList reply={reply} promptId={promptId} existing={existing} />;
}

function NewSuggestionList({
  reply,
  promptId,
  existing,
}: {
  reply: OriginReply;
  promptId: string;
  existing: { skills: Set<string>; routines: Set<string>; goals: Set<string> };
}) {
  const profile = useProfile();
  // Compared once, when the reply arrives, so rows just added do not vanish mid-review.
  const [fresh] = useState(() => ({
    skills: reply.skills.filter((s) => !existing.skills.has(s.name.trim().toLowerCase())),
    routines: reply.routines.filter((r) => !existing.routines.has(r.name.trim().toLowerCase())),
    goals: reply.goals.filter((g) => !existing.goals.has(g.title.trim().toLowerCase())),
  }));
  const state = useSuggestions(fresh);
  const [added, setAdded] = useState<AddedCounts | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setBusy(true);
    const counts = await addSuggestions(state.accepted, { promptId, rolloverHour: profile?.settings.rolloverHour });
    setAdded(counts);
    setBusy(false);
  }

  if (added) {
    const parts = [
      added.skills ? `${added.skills} ${added.skills === 1 ? 'skill' : 'skills'}` : '',
      added.routines ? `${added.routines} ${added.routines === 1 ? 'routine' : 'routines'}` : '',
      added.goals ? `${added.goals} ${added.goals === 1 ? 'goal' : 'goals'}` : '',
    ].filter(Boolean);
    return <p className="text-mid">{parts.length ? `Added ${parts.join(', ')}.` : 'Nothing added.'}</p>;
  }

  return (
    <div className="flex flex-col gap-2">
      <SuggestionLists state={state} emptyNote="Nothing new to add: every skill, routine and goal Claude suggested is already in your game." />
      {state.skills.length + state.routines.length + state.goals.length > 0 ? (
        <Section>
          <Button onClick={add} disabled={busy || state.acceptedCount === 0} className="self-start" data-testid="add-suggestions">
            Add {state.acceptedCount} to my game
          </Button>
        </Section>
      ) : null}
    </div>
  );
}
