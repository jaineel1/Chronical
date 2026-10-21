import { describe, expect, it } from 'vitest';
import { shieldNames, splitByNames } from './linkNames';

const targets = [
  { name: 'Run', to: '/edit/routines/r1' },
  { name: 'Run club', to: '/edit/goals/g1' },
  { name: 'Mentor', to: '/edit/people/p1' },
];

describe('splitByNames', () => {
  it('links the longest name first, ignores case, and only whole words', () => {
    expect(splitByNames('Skipped run club; mentor said run, not running.', targets)).toEqual([
      { text: 'Skipped ' },
      { text: 'run club', to: '/edit/goals/g1' },
      { text: '; ' },
      { text: 'mentor', to: '/edit/people/p1' },
      { text: ' said ' },
      { text: 'run', to: '/edit/routines/r1' },
      { text: ', not running.' },
    ]);
  });

  it('returns the text untouched when nothing matches', () => {
    expect(splitByNames('Sleep slipped twice.', targets)).toEqual([{ text: 'Sleep slipped twice.' }]);
    expect(splitByNames('Hello', [])).toEqual([{ text: 'Hello' }]);
  });
});

describe('shieldNames', () => {
  it('reads one note and the summary of several', () => {
    expect(shieldNames(['Run, 4 day streak: shield used, none left this week'])).toEqual(['Run']);
    expect(shieldNames(['Shields used on Run, Read and Stretch. None left this week for them.'])).toEqual(['Run', 'Read', 'Stretch']);
    expect(shieldNames(['Sleep slipped twice.'])).toEqual([]);
  });
});
