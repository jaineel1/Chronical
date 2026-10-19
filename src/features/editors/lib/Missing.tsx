import { Page } from '@/app/Shell';
import { Empty } from '@/ui/primitives';
import { TextLink } from './ui';

/** Shown when an editor's id points at nothing (deleted, or a stale link). */
export function Missing({ what, back }: { what: string; back: string }) {
  return (
    <Page>
      <Empty action={<TextLink to={back}>Back to the list</TextLink>}>This {what} is not here any more.</Empty>
    </Page>
  );
}
