import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { DayLog } from '@/data/types';
import { ReviewBlock } from './ReviewBlock';

function log(extra: Partial<DayLog>): DayLog {
  return { id: 'd', createdAt: '', updatedAt: '', date: '2026-10-20', ...extra } as DayLog;
}

function renderBlock(source: DayLog | null, today: DayLog | null) {
  return render(
    <MemoryRouter>
      <ReviewBlock source={source} today={today} />
    </MemoryRouter>,
  );
}

describe('ReviewBlock', () => {
  it('renders right, better, the rant answer and the plan', () => {
    const d = log({
      review: { right: ['Ran 8 km before class'], better: ['Phone out of bed by 23:00'] },
      rantReplyMd: 'That sounded like a long day.\n\nSleep first.',
      plan: [
        { id: 'b', start: '09:00', end: '10:00', text: 'Study session', pillar: 'MIND' },
        { id: 'a', start: '06:30', end: '07:00', text: 'Run', pillar: 'BODY' },
      ],
    });
    renderBlock(d, d);
    expect(screen.getByText('What went right')).toBeInTheDocument();
    expect(screen.getByText('Ran 8 km before class')).toBeInTheDocument();
    expect(screen.getByText('Do better today')).toBeInTheDocument();
    expect(screen.getByText('Phone out of bed by 23:00')).toBeInTheDocument();
    expect(screen.getByText('The game master answers your rant')).toBeInTheDocument();
    expect(screen.getByText('Sleep first.')).toBeInTheDocument();
    expect(screen.getByText("Today's plan")).toBeInTheDocument();
    const rows = screen.getByTestId('review-plan').querySelectorAll('li');
    expect(rows[0]).toHaveTextContent('06:30-07:00');
    expect(rows[0]).toHaveTextContent('Body');
    expect(rows[1]).toHaveTextContent('09:00-10:00');
    expect(screen.getByRole('link', { name: 'Open the day' })).toHaveAttribute('href', '/now');
  });

  it('hides empty parts and the whole block for older data', () => {
    const { container, rerender } = renderBlock(log({ review: { right: ['One thing'], better: [] } }), null);
    expect(screen.getByText('What went right')).toBeInTheDocument();
    expect(screen.queryByText('Do better today')).not.toBeInTheDocument();
    expect(screen.queryByText("Today's plan")).not.toBeInTheDocument();
    rerender(
      <MemoryRouter>
        <ReviewBlock source={log({})} today={log({})} />
      </MemoryRouter>,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
