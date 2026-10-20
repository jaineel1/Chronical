import { Section, SectionHeader } from '@/ui/primitives';
import { PixelSprite } from '@/ui/PixelSprite';
import { HERO_MAP, HERO_PALETTE, PAPER } from '@/ui/sprites';
import { plural } from './format';
import { usePromptCount } from './queries';
import { RowLink, VaultPage } from './VaultPage';

const CHEST_MAP = [
  '..xxxxxxxx..',
  '.xyyyyyyyyx.',
  'xyyyyyyyyyyx',
  'xxxxxxxxxxxx',
  'xyyyyrryyyyx',
  'xyyyyrryyyyx',
  'xyyyyyyyyyyx',
  'xxxxxxxxxxxx',
] as const;
const CHEST_PALETTE = { x: PAPER.ink, y: PAPER.walnut, r: PAPER.red } as const;

const SECTIONS = [
  { to: 'archive', title: 'Archive', sub: 'Every prompt and reply, searchable' },
  { to: 'letters', title: 'Letters', sub: 'Every morning letter and the affirmations you kept' },
  { to: 'origin', title: 'Origin Sheet', sub: 'Your answers, the State of Me, the origin prompt' },
  { to: 'settings', title: 'Settings', sub: 'Name, day rollover, deep mode, money, models, API key' },
  { to: 'timetable', title: 'Timetable', sub: 'Your weekly classes, so Now and the plans fit around them' },
  { to: 'meals', title: 'Meals', sub: 'Saved meals with grams, calories and macros' },
  { to: 'data', title: 'Data', sub: 'Backup, import, exports, start over' },
  { to: 'sync', title: 'Sync', sub: 'Same game on the laptop and the iPhone, through GitHub' },
  { to: 'guide', title: 'Guide', sub: 'Night 1: how the loop works' },
] as const;

export function VaultIndex() {
  const count = usePromptCount();
  return (
    <VaultPage title="Vault" meta={count === undefined ? undefined : plural(count, 'prompt')} back={null}>
      <div className="relative h-[96px]" aria-hidden="true">
        <PixelSprite map={HERO_MAP} palette={HERO_PALETTE} scale={4} className="absolute top-0 left-3" />
        <PixelSprite map={CHEST_MAP} palette={CHEST_PALETTE} scale={4} className="absolute bottom-[16px] left-[76px]" />
        <div className="absolute inset-x-0 bottom-[14px] h-[2px] bg-faint" />
        <span className="absolute right-0 bottom-[30px] left-[140px] text-mid">Everything you have lived, kept on this device.</span>
      </div>
      <SectionHeader title="The Vault" note="local first" />
      <Section className="gap-0">
        {SECTIONS.map((s) => (
          <RowLink key={s.to} to={`/vault/${s.to}`} title={s.title} sub={s.sub} testId={`vault-${s.to}`} />
        ))}
      </Section>
    </VaultPage>
  );
}
