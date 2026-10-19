import { Link } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { ChevronIcon } from '@/ui/icons';
import { SectionHeader } from '@/ui/primitives';
import { useWorldCounts } from './queries';

export function EditIndex() {
  useShellBar('Edit', 'your world');
  const c = useWorldCounts();
  if (!c) return <Page>{null}</Page>;

  const rows = [
    { to: '/edit/routines', label: 'Routines', note: `${c.routinesActive} active${c.routinesArchived ? `, ${c.routinesArchived} archived` : ''}` },
    { to: '/edit/goals', label: 'Goals', note: `${c.goalsActive} active of ${c.goals}` },
    { to: '/edit/skills', label: 'Skills', note: `${c.skills} ranked` },
    { to: '/edit/people', label: 'People', note: `${c.people} ${c.people === 1 ? 'branch' : 'branches'}` },
    { to: '/edit/books', label: 'Books', note: `${c.booksReading} reading of ${c.books}` },
  ];

  return (
    <Page>
      <SectionHeader title="Your world" note="what the game is made of" />
      <nav aria-label="Editors" className="flex flex-col px-2.5">
        {rows.map((r, i) => (
          <Link key={r.to} to={r.to} className={`flex items-center justify-between gap-3 py-3 text-ink no-underline ${i ? 'border-t border-faint' : ''}`}>
            <span>{r.label}</span>
            <span className="flex items-center gap-3 text-mid">
              {r.note}
              <ChevronIcon size={12} />
            </span>
          </Link>
        ))}
      </nav>
    </Page>
  );
}
