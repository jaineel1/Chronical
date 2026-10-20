import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { noteRepo, resetAll } from '@/data/repo';
import { LifeFeed } from './LifeFeed';
import { RantSection } from './RantSection';

const DATE = '2026-10-20';

describe('RantSection', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('saves each rant as a note for the day and lists it', async () => {
    render(<RantSection date={DATE} log={null} />);
    const save = screen.getByRole('button', { name: 'Save the rant' });
    expect(save).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/Everything, unfiltered/), { target: { value: 'The lab ran over again.' } });
    fireEvent.click(save);
    await waitFor(() => expect(screen.getByTestId('rant-note')).toHaveTextContent('The lab ran over again.'));
    const notes = await noteRepo.forDate(DATE);
    expect(notes).toHaveLength(1);
    expect(notes[0]).toMatchObject({ kind: 'rant', text: 'The lab ran over again.' });
    await waitFor(() => expect(screen.getByLabelText(/Everything, unfiltered/)).toHaveValue(''));
  });

  it('shows the game master reply once it is in', () => {
    render(<RantSection date={DATE} log={{ rantReplyMd: 'Sounds like a long day.' } as never} />);
    expect(screen.getByText('The game master answers')).toBeInTheDocument();
    expect(screen.getByText('Sounds like a long day.')).toBeInTheDocument();
  });
});

describe('LifeFeed', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('adds a timestamped line and deletes it', async () => {
    render(<LifeFeed date={DATE} />);
    fireEvent.change(screen.getByLabelText('Life line'), { target: { value: 'Lunch with Riya, talked about the hackathon' } });
    fireEvent.click(screen.getByRole('button', { name: 'Add' }));
    const row = await screen.findByTestId('life-note');
    expect(row).toHaveTextContent(/^\d{2}:\d{2}Lunch with Riya, talked about the hackathon/);
    expect((await noteRepo.forDate(DATE)).map((n) => [n.kind, n.text])).toEqual([['life', 'Lunch with Riya, talked about the hackathon']]);

    fireEvent.click(screen.getByRole('button', { name: /^Delete Lunch with Riya/ }));
    await waitFor(() => expect(screen.queryByTestId('life-note')).not.toBeInTheDocument());
    expect(await noteRepo.forDate(DATE)).toHaveLength(0);
  });
});
