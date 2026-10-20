import { Page } from '@/app/Shell';
import { useShellBar } from '@/app/shellContext';
import { Empty, Section } from '@/ui/primitives';

/** Placeholder: replaced by the Timetable feature. */
export function TimetableScreen() {
  useShellBar('Timetable');
  return (
    <Page>
      <Section>
        <Empty>Timetable is on its way.</Empty>
      </Section>
    </Page>
  );
}
