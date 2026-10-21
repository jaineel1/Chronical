import { useState } from 'react';
import { Link } from 'react-router';
import { dayLogRepo } from '@/data/repo';
import { PILLAR_LABEL, type DayLog, type PlanBlock } from '@/data/types';
import { PixelSprite } from '@/ui/PixelSprite';
import { Chip } from '@/ui/primitives';
import { MID_PALETTE, PAPER } from '@/ui/sprites';
import { EditableSection } from './edit/EditableSection';
import { EditActions } from './edit/EditActions';
import { LineListEditor, LineListFields } from './edit/LineListEditor';
import { PlanEditor } from './edit/PlanEditor';
import { ProseEditor } from './edit/ProseEditor';

const CHECK_MAP = ['.....', '....x', 'x..x.', '.xx..', '..x..'] as const;
const CROSS_MAP = ['x...x', '.x.x.', '..x..', '.x.x.', 'x...x'] as const;
const RED_PALETTE = { x: PAPER.red } as const;

function Line({ text, good }: { text: string; good: boolean }) {
  return (
    <li className="flex items-start gap-2">
      <PixelSprite
        map={good ? CHECK_MAP : CROSS_MAP}
        palette={good ? MID_PALETTE : RED_PALETTE}
        scale={2}
        className="mt-[5px]"
      />
      <span className={`min-w-0 flex-1 break-words ${good ? 'text-mid' : ''}`}>{text}</span>
    </li>
  );
}

function LineUl({ lines, good }: { lines: string[]; good: boolean }) {
  return (
    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
      {lines.map((l, i) => (
        <Line key={`${i}-${l}`} text={l} good={good} />
      ))}
    </ul>
  );
}

/** What went right / do better: one list of the reply's review, saved back with the other list kept. */
function Lines({ title, source, side }: { title: string; source: DayLog; side: 'right' | 'better' }) {
  const good = side === 'right';
  const lines = source.review?.[side] ?? [];
  if (!lines.length) return null;
  return (
    <EditableSection
      title={title}
      label={title.toLowerCase()}
      testId={good ? 'review-right' : 'review-better'}
      edit={(close) => (
        <LineListEditor
          label={title}
          initial={lines}
          onSave={async (next) => {
            const review = { right: source.review?.right ?? [], better: source.review?.better ?? [], [side]: next };
            await dayLogRepo.update(source.date, { review });
            close();
          }}
          onCancel={close}
        />
      )}
    >
      <LineUl lines={lines} good={good} />
    </EditableSection>
  );
}

function FoodEditor({ source, close }: { source: DayLog; close: () => void }) {
  const [good, setGood] = useState(source.foodNotes?.good ?? []);
  const [better, setBetter] = useState(source.foodNotes?.better ?? []);
  const clean = (l: string[]) => l.map((x) => x.trim()).filter(Boolean);
  return (
    <EditActions
      onSave={async () => {
        await dayLogRepo.update(source.date, { foodNotes: { good: clean(good), better: clean(better) } });
        close();
      }}
      onCancel={close}
    >
      <div className="flex flex-col gap-3">
        <LineListFields label="Went well" lines={good} onChange={setGood} />
        <LineListFields label="Could be better" lines={better} onChange={setBetter} />
      </div>
    </EditActions>
  );
}

function sortedPlan(plan: PlanBlock[]): PlanBlock[] {
  return [...plan].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

/**
 * First thing in the morning: what went right, what to do better, the game master's answer to the
 * rant, the food notes, and today's plan. `source` is the log of the letter being shown; `today` is
 * today's own log (the plan is stored on the day it is for). Each part hides when empty, and so does
 * the whole block.
 */
export function ReviewBlock({ source, today }: { source: DayLog | null | undefined; today: DayLog | null | undefined }) {
  const rant = source?.rantReplyMd?.trim() ?? '';
  const plan = today?.plan ?? [];
  const foodGood = source?.foodNotes?.good ?? [];
  const foodBetter = source?.foodNotes?.better ?? [];
  const hasFood = foodGood.length > 0 || foodBetter.length > 0;
  const hasReview = (source?.review?.right.length ?? 0) > 0 || (source?.review?.better.length ?? 0) > 0;
  if (!hasReview && !rant && !plan.length && !hasFood) return null;
  const paragraphs = rant ? rant.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
  return (
    <div className="flex flex-col gap-3" data-testid="review">
      {source ? <Lines title="What went right" source={source} side="right" /> : null}
      {source ? <Lines title="Do better today" source={source} side="better" /> : null}
      {source && paragraphs.length ? (
        <EditableSection
          title="The game master answers your rant"
          label="the rant answer"
          testId="review-rant"
          edit={(close) => (
            <ProseEditor
              label="The rant answer"
              initial={rant}
              rows={8}
              onSave={async (rantReplyMd) => {
                await dayLogRepo.update(source.date, { rantReplyMd: rantReplyMd || undefined });
                close();
              }}
              onCancel={close}
            />
          )}
        >
          <div className="flex flex-col gap-2">
            {paragraphs.map((p, i) => (
              <p key={i} className="m-0 break-words">
                {p}
              </p>
            ))}
          </div>
        </EditableSection>
      ) : null}
      {source && hasFood ? (
        <EditableSection title="Food notes" label="the food notes" testId="review-food" edit={(close) => <FoodEditor source={source} close={close} />}>
          <div className="flex flex-col gap-1.5">
            {foodGood.length ? <LineUl lines={foodGood} good /> : null}
            {foodBetter.length ? <LineUl lines={foodBetter} good={false} /> : null}
          </div>
        </EditableSection>
      ) : null}
      {today && plan.length ? (
        <EditableSection
          title="Today's plan"
          note={<Link to="/now">Open the day</Link>}
          label="today's plan"
          testId="review-plan"
          edit={(close) => (
            <PlanEditor
              initial={sortedPlan(plan)}
              onSave={async (next) => {
                await dayLogRepo.update(today.date, { plan: next });
                close();
              }}
              onCancel={close}
            />
          )}
        >
          <ul className="m-0 flex list-none flex-col p-0">
            {sortedPlan(plan).map((b, i) => (
              <li key={b.id} className={`flex flex-wrap items-baseline gap-x-3 gap-y-1 py-1.5 ${i > 0 ? 'border-t border-faint' : ''}`}>
                <span className="shrink-0 text-mid">
                  {b.start}-{b.end}
                </span>
                <span className="min-w-0 flex-1 break-words">{b.text}</span>
                {b.pillar ? <Chip>{PILLAR_LABEL[b.pillar]}</Chip> : null}
              </li>
            ))}
          </ul>
        </EditableSection>
      ) : null}
    </div>
  );
}
