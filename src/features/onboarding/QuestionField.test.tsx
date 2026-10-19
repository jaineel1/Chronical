import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { OnboardingAnswer } from '@/data/types';
import { QuestionField } from './QuestionField';
import { QUESTIONS, otherKey, unitKey, type Answers } from './questions';

function q(id: string) {
  return QUESTIONS.find((x) => x.id === id)!;
}

/** Renders one question against a live answer map and exposes the latest map. */
function Harness({ id, initial = {}, missing = false, onAnswers }: { id: string; initial?: Answers; missing?: boolean; onAnswers: (a: Answers) => void }) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const set = (key: string, value: OnboardingAnswer | undefined) => {
    setAnswers((prev) => {
      const next = { ...prev };
      if (value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0)) delete next[key];
      else next[key] = value;
      onAnswers(next);
      return next;
    });
  };
  return <QuestionField q={q(id)} answers={answers} setAnswer={set} missing={missing} />;
}

describe('QuestionField', () => {
  it('toggles chips in a multi-select and keeps the "something else" line apart', () => {
    let latest: Answers = {};
    render(<Harness id="body-16" onAnswers={(a) => (latest = a)} />);
    fireEvent.click(screen.getByRole('button', { name: /^Exams/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Travel/ }));
    expect(latest['body-16']).toEqual(['Exams', 'Travel']);
    expect(screen.getByRole('button', { name: /^Exams\s*, chosen/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Exams/ }));
    expect(latest['body-16']).toEqual(['Travel']);
    fireEvent.change(screen.getByRole('textbox', { name: /something else/ }), { target: { value: 'night shifts' } });
    expect(latest[otherKey('body-16')]).toBe('night shifts');
    // The group is labelled by the question, and clicking the label text does not tick a chip.
    expect(screen.getByRole('group', { name: /What usually breaks the training streak/ })).toBeInTheDocument();
    fireEvent.click(screen.getByText('What usually breaks the training streak?'));
    expect(latest['body-16']).toEqual(['Travel']);
  });

  it('stores numbers as numbers and clears them when emptied', () => {
    let latest: Answers = {};
    render(<Harness id="body-02" onAnswers={(a) => (latest = a)} />);
    const input = screen.getByLabelText(/Weight this morning, roughly/);
    fireEvent.change(input, { target: { value: '72.5' } });
    expect(latest['body-02']).toBe(72.5);
    expect(screen.getByText('kg')).toBeInTheDocument();
    fireEvent.change(input, { target: { value: '' } });
    expect(latest['body-02']).toBeUndefined();
  });

  it('lets a free unit be typed beside the number', () => {
    let latest: Answers = {};
    render(<Harness id="money-03" onAnswers={(a) => (latest = a)} />);
    fireEvent.change(screen.getByLabelText(/Roughly what you spend a month/), { target: { value: '18000' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Currency' }), { target: { value: 'INR' } });
    expect(latest['money-03']).toBe(18000);
    expect(latest[unitKey('money-03')]).toBe('INR');
  });

  it('picks one of five on a Likert scale and clears it on a second tap', () => {
    let latest: Answers = {};
    render(<Harness id="mind-05" onAnswers={(a) => (latest = a)} />);
    fireEvent.click(screen.getByRole('button', { name: /Most days/ }));
    expect(latest['mind-05']).toBe(4);
    fireEvent.click(screen.getByRole('button', { name: /Every day/ }));
    expect(latest['mind-05']).toBe(5);
    fireEvent.click(screen.getByRole('button', { name: /Every day/ }));
    expect(latest['mind-05']).toBeUndefined();
  });

  it('shows the hint under the question and the red note only when needed', () => {
    const { rerender } = render(<Harness id="dopamine-01" onAnswers={() => {}} />);
    expect(screen.getByText(/Digital Wellbeing on Android/)).toBeInTheDocument();
    expect(screen.queryByText('The game needs this one.')).toBeNull();
    rerender(<Harness id="dopamine-01" missing onAnswers={() => {}} />);
    expect(screen.getByText('The game needs this one.')).toBeInTheDocument();
  });
});
