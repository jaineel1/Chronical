import { Link } from 'react-router';
import { PILLAR_LABEL, type DayLog, type PlanBlock } from '@/data/types';
import { PixelSprite } from '@/ui/PixelSprite';
import { Chip, Section, SectionHeader } from '@/ui/primitives';
import { MID_PALETTE, PAPER } from '@/ui/sprites';

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

function Lines({ title, lines, good }: { title: string; lines: string[]; good: boolean }) {
  if (!lines.length) return null;
  return (
    <div className="flex flex-col gap-1.5" data-testid={good ? 'review-right' : 'review-better'}>
      <SectionHeader title={title} />
      <Section>
        <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
          {lines.map((l, i) => (
            <Line key={`${i}-${l}`} text={l} good={good} />
          ))}
        </ul>
      </Section>
    </div>
  );
}

function sortedPlan(plan: PlanBlock[]): PlanBlock[] {
  return [...plan].sort((a, b) => a.start.localeCompare(b.start) || a.end.localeCompare(b.end));
}

/**
 * First thing in the morning: what went right, what to do better, the game master's answer to the
 * rant, and today's plan. `source` is the log of the letter being shown; `today` is today's own log
 * (the plan is stored on the day it is for). Each part hides when empty, and so does the whole block.
 */
export function ReviewBlock({ source, today }: { source: DayLog | null | undefined; today: DayLog | null | undefined }) {
  const right = source?.review?.right ?? [];
  const better = source?.review?.better ?? [];
  const rant = source?.rantReplyMd?.trim() ?? '';
  const plan = today?.plan ?? [];
  if (!right.length && !better.length && !rant && !plan.length) return null;
  const paragraphs = rant ? rant.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean) : [];
  return (
    <div className="flex flex-col gap-3" data-testid="review">
      <Lines title="What went right" lines={right} good />
      <Lines title="Do better today" lines={better} good={false} />
      {paragraphs.length ? (
        <div className="flex flex-col gap-1.5" data-testid="review-rant">
          <SectionHeader title="The game master answers your rant" />
          <Section>
            <div className="flex flex-col gap-2">
              {paragraphs.map((p, i) => (
                <p key={i} className="m-0 break-words">
                  {p}
                </p>
              ))}
            </div>
          </Section>
        </div>
      ) : null}
      {plan.length ? (
        <div className="flex flex-col gap-1.5" data-testid="review-plan">
          <SectionHeader title="Today's plan" note={<Link to="/now">Open the day</Link>} />
          <Section>
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
          </Section>
        </div>
      ) : null}
    </div>
  );
}
