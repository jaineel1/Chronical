import { Link, useNavigate } from 'react-router';
import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { PILLAR_LABEL } from '@/data/types';
import { Button, Empty, SectionHeader } from '@/ui/primitives';
import { formatAmount } from '../lib/progress';
import { formatSkillLevel, skillBand } from '../lib/skills';
import { useSkillsAll } from '../queries';

export function SkillList() {
  const skills = useSkillsAll();
  const navigate = useNavigate();
  useShellBar('Skills', skills ? `${skills.length} ranked` : undefined);
  if (!skills) return <Page>{null}</Page>;

  return (
    <Page>
      <SectionHeader title="Skills" note="out of 100" />
      {skills.length === 0 ? (
        <div className="px-2.5">
          <Empty>Add a skill the game master can rank.</Empty>
        </div>
      ) : (
        <ul className="m-0 flex list-none flex-col p-0 px-2.5">
          {skills.map((s, i) => (
            <li key={s.id} className={i ? 'border-t border-faint' : ''}>
              <Link to={`/edit/skills/${s.id}`} className="flex items-baseline gap-3 py-2 text-ink no-underline">
                <span className="flex min-w-0 flex-1 flex-col">
                  <span>{s.name}</span>
                  <span className="text-mid">
                    {PILLAR_LABEL[s.pillar]} · {formatAmount(s.hours)} h
                  </span>
                </span>
                <span className="w-8 shrink-0 text-right">{formatSkillLevel(s.level)}</span>
                <span className="w-[72px] shrink-0 text-right text-mid">{skillBand(s.level).toLowerCase()}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
      <div className="px-2.5 pt-2">
        <Button onClick={() => navigate('/edit/skills/new')}>Add a skill</Button>
      </div>
    </Page>
  );
}
