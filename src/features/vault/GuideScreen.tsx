import { Link } from 'react-router';
import { Section, SectionHeader } from '@/ui/primitives';
import { VaultPage } from './VaultPage';

/** Night 1: the whole loop on one page, in the letter's voice. */
export function GuideScreen() {
  return (
    <VaultPage title="Guide" meta="Night 1">
      <SectionHeader title="How the loop works" note="two minutes a night" />
      <Section className="pb-2">
        <div className="letter">
          <p>
            <span className="drop">E</span>very night, sit at the Campfire. Tick the routines you did, log your weight, sleep, mood and screen time, and write
            one line about the day. Then press Send: Chronicle turns the night into one prompt and copies it.
          </p>
          <p>
            Paste that prompt into a new chat with Claude and wait for the reply. Copy the whole reply, come back, and paste it into the box under the
            button. In the morning there is a letter waiting, three quests for the day, the stat changes, and anything the game master noticed.
          </p>
          <p>
            Miss a routine and its shield covers you once a week. Miss again and you get a warning, never a penalty. The game is honest, not cruel.
          </p>
        </div>
      </Section>

      <SectionHeader title="Which model" />
      <Section className="pb-2">
        <div className="letter">
          <p>
            Use Haiku for the nightly log: it is quick, it is cheap, and a night is about 9,000 tokens. Use Sonnet for the bigger reads, the weekly review,
            the Origin Sheet, deep mode and skill ranks, where it pays to think longer. The button tells you which one each prompt was written for.
          </p>
        </div>
      </Section>

      <SectionHeader title="On your phone" />
      <Section className="pb-2">
        <div className="letter">
          <p>
            On iPhone, open Chronicle in Safari, tap Share, then Add to Home Screen. On Android, open it in Chrome, tap the menu, then Install app or Add to
            Home screen. It then opens like an app, full screen, and works offline.
          </p>
        </div>
      </Section>

      <SectionHeader title="Backups" />
      <Section className="gap-2 pb-2">
        <div className="letter">
          <p>
            Your whole game lives in this browser on this device. Once a week, export a backup from the Vault and keep the file somewhere else. Safari on
            iPhone can clear a site&apos;s data after seven days without a visit, so the Home Screen icon and the weekly backup both matter.
          </p>
        </div>
        <Link to="/vault/data" className="self-start no-underline">
          Open Data to export a backup
        </Link>
      </Section>

      <SectionHeader title="What stays here" />
      <Section className="pb-4">
        <div className="letter">
          <p>
            Everything you log stays on this device. Chronicle sends nothing anywhere on its own: the only thing that leaves is the text you copy and paste
            into Claude yourself. If you add an API key in Settings, the prompts you choose to send with it go to Anthropic directly from this browser, and
            nowhere else. Turn on Leave money out and your money answers never appear in a prompt.
          </p>
        </div>
      </Section>
    </VaultPage>
  );
}
