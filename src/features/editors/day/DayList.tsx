import { useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { addDays, formatShortDate, fromDayKey } from '@/lib/dates';
import { formatScreen } from '@/lib/prompt/dayLog';
import { ChevronIcon } from '@/ui/icons';
import { Button, Section, SectionHeader, TextInput } from '@/ui/primitives';
import { ErrorText } from '../lib/ui';
import { useToday } from '../lib/useToday';
import { isDayKey } from './parse';
import { useDayFacts, type DayFacts } from './queries';

const DAYS = 60;

function facts(d: DayFacts): string {
  const parts: string[] = [];
  if (d.log?.weightKg !== undefined) parts.push(`${d.log.weightKg} kg`);
  if (d.log?.sleepHours !== undefined) parts.push(`${d.log.sleepHours} h sleep`);
  if (d.log?.screenMin !== undefined) parts.push(`${formatScreen(d.log.screenMin)} screen`);
  if (d.meals) parts.push(`${d.meals} ${d.meals === 1 ? 'meal' : 'meals'}`);
  if (d.notes) parts.push(`${d.notes} ${d.notes === 1 ? 'note' : 'notes'}`);
  return parts.length ? parts.join(', ') : 'nothing logged';
}

export function DayList() {
  useShellBar('Past days', 'edit any day');
  const today = useToday();
  const navigate = useNavigate();
  const days = useMemo(() => Array.from({ length: DAYS }, (_, i) => addDays(today, -i)), [today]);
  const rows = useDayFacts(days);
  const [jump, setJump] = useState('');
  const [error, setError] = useState<string | null>(null);

  function go(e: FormEvent) {
    e.preventDefault();
    const v = jump.trim();
    if (!isDayKey(v)) {
      setError('Use a date like 2026-03-14.');
      return;
    }
    setError(null);
    navigate(`/edit/day/${v}`);
  }

  return (
    <Page>
      <SectionHeader title="Jump to a date" />
      <form onSubmit={go} aria-label="Jump to a date" className="flex flex-col gap-2 px-2.5 pb-3">
        <div className="flex items-end gap-3">
          <label className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-mid">Date</span>
            <TextInput type="date" value={jump} onChange={(e) => setJump(e.target.value)} max={today} placeholder="2026-03-14" />
          </label>
          <Button type="submit" variant="outline">
            Open
          </Button>
        </div>
        {error ? <ErrorText>{error}</ErrorText> : null}
      </form>

      <SectionHeader title="The last 60 days" note="newest first" />
      {rows ? (
        <Section className="gap-0">
          <ul className="m-0 flex list-none flex-col p-0">
            {rows.map((d, i) => (
              <li key={d.date} className={i ? 'border-t border-faint' : ''}>
                <Link to={`/edit/day/${d.date}`} aria-label={`Edit ${d.date}`} className="flex items-center justify-between gap-3 py-2.5 text-ink no-underline">
                  <span className="flex min-w-0 flex-col">
                    <span>
                      {formatShortDate(d.date)} <span className="text-mid">{fromDayKey(d.date).toLocaleDateString('en', { weekday: 'long' })}</span>
                    </span>
                    <span className="text-mid">{facts(d)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2 text-walnut">
                    edit
                    <ChevronIcon size={12} />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      ) : null}
    </Page>
  );
}
