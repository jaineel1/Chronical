import { Page } from '@/app/Shell';
import { SectionHeader, Section } from '@/ui/primitives';

/** Temporary placeholder. Each feature agent replaces its screen; delete this file once none import it. */
export function Stub({ title, owner }: { title: string; owner: string }) {
  return (
    <Page>
      <SectionHeader title={title} note="coming" />
      <Section>
        <p className="text-mid">This screen is being built ({owner}).</p>
      </Section>
    </Page>
  );
}
