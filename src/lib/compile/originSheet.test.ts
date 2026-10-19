import { describe, expect, it } from 'vitest';
import { compileOriginSheet, countWords, formatAnswer } from './originSheet';
import { PARTS, QUESTIONS, otherKey, unitKey, type Answers, type Question } from '@/features/onboarding/questions';

const DATE = '2026-10-19';

/** One plausible answer for every question of the sheet. */
function fullAnswers(): Answers {
  const a: Answers = {};
  for (const q of QUESTIONS) {
    switch (q.type) {
      case 'S':
        a[q.id] = `short answer for ${q.id}`;
        break;
      case 'M':
        a[q.id] = `first line for ${q.id}\nsecond line`;
        break;
      case 'T':
        a[q.id] = [q.options![1]!, q.options![0]!];
        break;
      case 'L':
        a[q.id] = 4;
        break;
      case 'N':
        a[q.id] = 7;
        break;
    }
  }
  a['identity-01'] = 'Riya';
  return a;
}

function q(id: string): Question {
  return QUESTIONS.find((x) => x.id === id)!;
}

describe('compileOriginSheet', () => {
  it('writes a titled sheet with all ten parts when everything is answered', () => {
    const md = compileOriginSheet(fullAnswers(), { date: DATE });
    expect(md.startsWith('# Origin Sheet — Riya, Monday, 19 October 2026\n')).toBe(true);
    for (const p of PARTS) expect(md).toContain(`## Part ${p.n}: ${p.name}\n`);
    expect(md.match(/^\*\*Q\*\* /gm)).toHaveLength(118);
    expect(md.match(/^\*\*A\*\* /gm)).toHaveLength(118);
    expect(md.endsWith('\n')).toBe(true);
  });

  it('formats each type the way Claude should read it', () => {
    const a: Answers = {
      'body-02': 72,
      'body-08': 6.5,
      'body-16': ['Exams', 'Travel'],
      [otherKey('body-16')]: 'night shifts',
      'mind-05': 4,
      'work-06': 7.9,
      'money-03': 18000,
      [unitKey('money-03')]: 'INR',
      'identity-07': '  calm,   stubborn,  funny ',
      'today-01': 'Gym at 6.\r\n\r\n\r\nShipped the form.',
    };
    expect(formatAnswer(q('body-02'), a)).toBe('72 kg');
    expect(formatAnswer(q('body-08'), a)).toBe('6.5 h');
    expect(formatAnswer(q('body-16'), a)).toBe('Travel, Exams, night shifts');
    expect(formatAnswer(q('mind-05'), a)).toBe('4/5 — Most days');
    expect(formatAnswer(q('work-06'), a)).toBe('7.9');
    expect(formatAnswer(q('money-03'), a)).toBe('18000 INR');
    expect(formatAnswer(q('identity-07'), a)).toBe('calm, stubborn, funny');
    expect(formatAnswer(q('today-01'), a)).toBe('Gym at 6.\n\nShipped the form.');
  });

  it('removes the Money part entirely when money is excluded', () => {
    const answers = fullAnswers();
    const withMoney = compileOriginSheet(answers, { date: DATE });
    const without = compileOriginSheet(answers, { date: DATE, excludeMoney: true });
    expect(withMoney).toContain('## Part 7: Money');
    expect(without).not.toContain('## Part 7: Money');
    for (const mq of QUESTIONS.filter((x) => x.part === 'money')) expect(without).not.toContain(mq.text);
    expect(without).toContain('## Part 6: Work');
    expect(without).toContain('## Part 8: People');
  });

  it('skips unanswered questions and empty parts', () => {
    const md = compileOriginSheet({ 'identity-01': 'Riya', 'body-02': 61, 'body-03': null, 'skin-03': '   ', 'mind-08': [] }, { date: DATE });
    expect(md).toBe('# Origin Sheet — Riya, Monday, 19 October 2026\n\n## Part 1: Identity\n**Q** What should the game call you?\n**A** Riya\n\n## Part 2: Body\n**Q** Weight this morning, roughly\n**A** 61 kg\n');
    expect(md).not.toContain('Part 3');
    expect(md).not.toContain('Part 4');
  });

  it('is deterministic and ignores the order answers were given in', () => {
    const a = fullAnswers();
    const reversed = Object.fromEntries(Object.entries(a).reverse());
    expect(compileOriginSheet(a, { date: DATE })).toBe(compileOriginSheet(reversed, { date: DATE }));
    expect(compileOriginSheet(a, { date: DATE })).toBe(compileOriginSheet({ ...a }, { date: DATE }));
  });

  it('falls back to the display name and says when nothing is answered', () => {
    expect(compileOriginSheet({}, { date: DATE, displayName: 'Kabir' })).toBe('# Origin Sheet — Kabir, Monday, 19 October 2026\n\n_No answers yet._\n');
  });
});

describe('countWords', () => {
  it('counts words, not markup', () => {
    expect(countWords('# Title here\n\n**Q** How old?\n**A** 20 years')).toBe(6);
    expect(countWords('')).toBe(0);
  });
});
