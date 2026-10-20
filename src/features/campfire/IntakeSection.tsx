import type { DayLog, MealSlot, Settings } from '@/data/types';
import { formatMinutes, intakeReport, mealTimeline, type IntakeRow } from '@/lib/intake/intake';
import { sumNutrition } from '@/lib/nutrition';
import { Bar, Section, SectionHeader } from '@/ui/primitives';
import { TextLink } from './parts';
import type { MealView } from './queries';

const SLOT_STYLE: Record<MealSlot, { label: string; fill: string }> = {
  breakfast: { label: 'Breakfast', fill: 'bg-ink' },
  lunch: { label: 'Lunch', fill: 'bg-walnut' },
  dinner: { label: 'Dinner', fill: 'bg-mid' },
  snack: { label: 'Snack', fill: 'bg-faint' },
};

function figure(row: IntakeRow): string {
  if (row.value === undefined) return '--';
  const n = (v: number, d = 0) => Math.round(v * 10 ** d) / 10 ** d;
  if (row.key === 'screen') return row.target ? `${formatMinutes(row.value)} / ${formatMinutes(row.target)}` : formatMinutes(row.value);
  const unit = row.unit ? ` ${row.unit}` : '';
  const digits = row.key === 'water' || row.key === 'sleep' ? 1 : 0;
  const v = n(row.value, digits).toLocaleString('en-IN', { maximumFractionDigits: digits });
  if (!row.target) return `${v}${unit}`;
  return `${v} / ${n(row.target, digits).toLocaleString('en-IN', { maximumFractionDigits: digits })}${unit}`;
}

function IntakeBar({ row }: { row: IntakeRow }) {
  const hasBar = row.target !== undefined;
  return (
    <div className="flex items-center gap-3" data-testid={`intake-${row.key}`}>
      <span className="w-[84px] shrink-0 truncate">{row.label}</span>
      {hasBar ? <Bar value={row.ratio} max={1} label={`${row.label}, ${figure(row)}`} /> : <span className="flex-1" />}
      <span className={`shrink-0 text-right ${row.tone === 'over' ? 'text-red' : 'text-mid'}`}>{figure(row)}</span>
    </div>
  );
}

function List({ title, lines, testId }: { title: string; lines: string[]; testId: string }) {
  if (lines.length === 0) return null;
  return (
    <div className="flex flex-col gap-1" data-testid={testId}>
      <span className="text-mid">{title}</span>
      {lines.map((l) => (
        <p key={l} className="m-0">
          {l}
        </p>
      ))}
    </div>
  );
}

/** Today's intake against the targets: bars, a meal split, and what went well and what could be better. */
export function IntakeSection({ log, meals, targets }: { log: DayLog | null; meals: MealView[]; targets: Settings['targets'] }) {
  const { total, counted } = sumNutrition(meals.map((m) => m.meal.nutrition));
  const report = intakeReport(targets, {
    nutrition: total,
    waterL: log?.waterL,
    steps: log?.steps,
    sleepHours: log?.sleepHours,
    screenMin: log?.screenMin,
    mealsLogged: meals.length,
    mealsCounted: counted,
  });
  const timeline = mealTimeline(meals.map((m) => ({ slot: m.meal.slot, nutrition: m.meal.nutrition })));
  const hasSplit = timeline.some((s) => s.kcal > 0);
  const hasTargets = !!targets && Object.values(targets).some((v) => typeof v === 'number');
  const kcal = report.rows.find((r) => r.key === 'kcal');
  const note = kcal?.value !== undefined ? (kcal.target ? `${Math.round(kcal.value).toLocaleString('en-IN')} of ${kcal.target.toLocaleString('en-IN')} kcal` : `${Math.round(kcal.value).toLocaleString('en-IN')} kcal`) : kcal?.target ? `target ${kcal.target.toLocaleString('en-IN')} kcal` : undefined;
  const fn = log?.foodNotes;
  const gm = fn && (fn.good.length > 0 || fn.better.length > 0);

  return (
    <>
      <SectionHeader title="Today's intake" note={note} />
      <Section className="gap-3" >
        {!hasTargets ? (
          <span className="text-mid">
            <TextLink to="/vault/settings">Set targets in Settings</TextLink>
            {' to see the bars fill.'}
          </span>
        ) : null}
        {report.rows.map((row) => (
          <IntakeBar key={row.key} row={row} />
        ))}

        {hasSplit ? (
          <div className="flex flex-col gap-1.5" data-testid="meal-split">
            <span className="text-mid">Calories by meal</span>
            <div role="img" aria-label="Calories by meal" className="flex h-2 gap-px bg-paper">
              {timeline
                .filter((s) => s.share > 0)
                .map((s) => (
                  <div key={s.slot} className={SLOT_STYLE[s.slot].fill} style={{ width: `${s.share * 100}%` }} />
                ))}
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-mid">
              {timeline
                .filter((s) => s.share > 0)
                .map((s) => (
                  <span key={s.slot} className="inline-flex items-center gap-1.5">
                    <span aria-hidden="true" className={`inline-block h-2 w-2 ${SLOT_STYLE[s.slot].fill}`} />
                    {SLOT_STYLE[s.slot].label} {Math.round(s.share * 100)}%
                  </span>
                ))}
            </div>
          </div>
        ) : null}

        <List title="Went well" lines={report.good} testId="intake-good" />
        <List title="Could be better" lines={report.better} testId="intake-better" />
        {gm ? (
          <div className="flex flex-col gap-1 border-t border-faint pt-2" data-testid="intake-gm">
            <span className="text-mid">Game master says</span>
            {fn.good.map((l) => (
              <p key={`g-${l}`} className="m-0">
                {l}
              </p>
            ))}
            {fn.better.map((l) => (
              <p key={`b-${l}`} className="m-0 text-mid">
                {l}
              </p>
            ))}
          </div>
        ) : null}
      </Section>
    </>
  );
}
