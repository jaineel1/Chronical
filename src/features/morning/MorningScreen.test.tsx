import { beforeEach, describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { ShellProvider } from '@/app/shellContext';
import { dayLogRepo, profileRepo, resetAll } from '@/data/repo';
import { addDays, nowIso, todayKey } from '@/lib/dates';
import { MorningScreen } from './MorningScreen';
import { firstSentences, lessonLine, lowerFirst, sentences, toParagraphs, wordCount } from './letterText';

function renderMorning() {
  return render(
    <ShellProvider>
      <MemoryRouter initialEntries={['/']}>
        <MorningScreen />
      </MemoryRouter>
    </ShellProvider>,
  );
}

describe('MorningScreen', () => {
  beforeEach(async () => {
    await resetAll();
    await profileRepo.ensure('Asha');
    const start = new Date();
    start.setDate(start.getDate() - 9);
    await profileRepo.update({ onboardedAt: nowIso(), startedAt: start.toISOString() });
  });

  it('invites the first Campfire before any letter', async () => {
    renderMorning();
    expect(await screen.findByText("No letter yet. Tonight's Campfire writes the first one.")).toBeInTheDocument();
    expect(screen.getByRole('link', { name: "Open tonight's log" })).toHaveAttribute('href', '/campfire');
    expect(screen.queryByText("Today's quests")).not.toBeInTheDocument();
  });

  it('says which night an older letter came from, omits empty quests, and marks a generic affirmation', async () => {
    const date = addDays(todayKey(), -3);
    await dayLogRepo.update(date, {
      briefMd: 'Day 7. You slept 8 hours.\n\nKeep going.',
      affirmations: ['You are enough.'],
      warnings: ['Sleep slipped twice.'],
      insights: ['Runs follow early nights.'],
      lessonMd: 'From Atomic Habits: never miss twice.',
    });
    renderMorning();
    expect(await screen.findByText('From Night 7')).toBeInTheDocument();
    expect(screen.getByTestId('letter')).toHaveTextContent('ay 7. You slept 8 hours.');
    expect(screen.queryByText("Today's quests")).not.toBeInTheDocument();
    expect(screen.getByText('(generic)')).toBeInTheDocument();
    expect(screen.getByText('Sleep slipped twice.')).toHaveClass('text-red');
    expect(screen.getByText('Pattern noticed: runs follow early nights.')).toBeInTheDocument();
    expect(screen.getByText('Lesson for today, from Atomic Habits: never miss twice.')).toBeInTheDocument();
  });
});

describe('letter text', () => {
  it('splits paragraphs and sentences without breaking numbers', () => {
    expect(toParagraphs('# Hi\nline one\nline two\n\n- a list line\n\n---')).toEqual(['Hi line one line two', 'a list line']);
    expect(sentences('Day 23. You ran 8.5 km at 5:52. Then rest.')).toEqual(['Day 23.', 'You ran 8.5 km at 5:52.', 'Then rest.']);
    expect(firstSentences('One. Two. Three.')).toEqual({ text: 'One. Two.', more: true });
    expect(firstSentences('One. Two.')).toEqual({ text: 'One. Two.', more: false });
    expect(firstSentences('One. Two.\n\nThree.')).toEqual({ text: 'One. Two.', more: true });
    expect(wordCount('Day 23. You ran 8 km — at 5:52.')).toBe(8);
  });

  it('formats insights and lessons', () => {
    expect(lowerFirst('Late nights hurt.')).toBe('late nights hurt.');
    expect(lowerFirst('Mentor went quiet.', ['Mentor'])).toBe('Mentor went quiet.');
    expect(lowerFirst('I slept.')).toBe('I slept.');
    expect(lessonLine("From Deep Work: schedule the block, don't decide in the moment.")).toBe(
      "Lesson for today, from Deep Work: schedule the block, don't decide in the moment.",
    );
    expect(lessonLine('Rest is training.')).toBe('Lesson for today: Rest is training.');
  });
});
