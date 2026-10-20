import { beforeEach, describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { db } from '@/data/db';
import { resetAll, stamp } from '@/data/repo';
import type { WebEdge, WebNode } from '@/data/types';
import { WebScreen } from './WebScreen';

function node(label: string, extra: Partial<WebNode>): WebNode {
  return stamp<WebNode>({
    type: 'person',
    label,
    summaryMd: `${label} summary`,
    facts: [],
    firstSeen: '2026-09-01',
    lastSeen: '2026-10-18',
    mentions: 3,
    importance: 3,
    ...extra,
  });
}

function renderWeb() {
  return render(
    <ShellProvider>
      <MemoryRouter>
        <WebScreen />
      </MemoryRouter>
    </ShellProvider>,
  );
}

describe('WebScreen', () => {
  beforeEach(async () => {
    await resetAll();
  });

  it('invites the first night when the web is empty', async () => {
    renderWeb();
    expect(await screen.findByText('The web grows from your nightly logs. Nothing yet.')).toBeInTheDocument();
  });

  it('lists nodes by importance and shows facts, edges and the editor link in the detail', async () => {
    const coach = node('Coach Rao', { importance: 5, refId: 'p1', facts: [{ date: '2026-10-01', text: 'Set the plan' }, { date: '2026-10-15', text: 'Moved long run' }] });
    const goal = node('Sub-4 marathon', { type: 'goal', importance: 4 });
    const edge = stamp<WebEdge>({ from: coach.id, to: goal.id, relation: 'mentor of', weight: 3, firstSeen: '2026-09-01', lastSeen: '2026-10-18' });
    await db.webNodes.bulkAdd([goal, coach]);
    await db.webEdges.add(edge);

    renderWeb();
    const list = await screen.findByTestId('web-list');
    const rows = within(list).getAllByRole('button');
    expect(rows[0]).toHaveTextContent('Coach Rao');
    expect(rows[1]).toHaveTextContent('Sub-4 marathon');

    fireEvent.click(rows[0]!);
    const detail = screen.getByTestId('web-detail');
    expect(within(detail).getByText('Coach Rao summary')).toBeInTheDocument();
    expect(within(detail).getByTestId('web-edges')).toHaveTextContent('mentor of → Sub-4 marathon');
    const facts = within(detail).getByText('Moved long run');
    expect(facts.compareDocumentPosition(within(detail).getByText('Set the plan')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(within(detail).getByRole('link', { name: 'Open in the editor' })).toHaveAttribute('href', '/edit/people/p1');
  });

  it('deletes a node and its edges only after the name is typed', async () => {
    const a = node('Coach Rao', {});
    const b = node('Sub-4 marathon', { type: 'goal', importance: 2 });
    await db.webNodes.bulkAdd([a, b]);
    await db.webEdges.add(stamp<WebEdge>({ from: a.id, to: b.id, relation: 'mentor of', weight: 3, firstSeen: '2026-09-01', lastSeen: '2026-10-18' }));

    renderWeb();
    fireEvent.click((await screen.findAllByRole('button', { name: /Coach Rao/ }))[0]!);
    fireEvent.click(screen.getByRole('button', { name: 'Delete this node' }));
    const confirm = screen.getByRole('button', { name: 'Delete for good' });
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText('Type the name to confirm'), { target: { value: 'Coach Rao' } });
    fireEvent.click(confirm);

    await waitFor(async () => expect(await db.webNodes.count()).toBe(1));
    expect(await db.webEdges.count()).toBe(0);
  });
});
