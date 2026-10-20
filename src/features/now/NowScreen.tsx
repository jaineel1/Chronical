import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { Empty, Section } from '@/ui/primitives';

/** Placeholder: replaced by the Now feature. */
export function NowScreen() {
  useShellBar('Now');
  return (
    <Page>
      <Section>
        <Empty>Now is on its way.</Empty>
      </Section>
    </Page>
  );
}
