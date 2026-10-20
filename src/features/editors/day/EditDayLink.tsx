import { TextLink } from '../lib/ui';

/** A quiet "Edit this day" link to the day editor, for other screens to place. */
export function EditDayLink({ date }: { date: string }) {
  return <TextLink to={`/edit/day/${date}`}>Edit this day</TextLink>;
}
