import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { Empty, Section } from '@/ui/primitives';

/** Placeholder: replaced by the Mind web feature. */
export function WebScreen() {
  useShellBar('Mind web');
  return (
    <Page>
      <Section>
        <Empty>Mind web is on its way.</Empty>
      </Section>
    </Page>
  );
}
