import { describe, expect, it } from 'vitest';
import { PARTS, QUESTIONS, answeredCount, choiceValues, isAnswered, missingRequired, otherKey, questionsForPart, type Question } from './questions';

describe('Origin Sheet questions', () => {
  it('has exactly 118 questions in ten parts with the agreed sizes', () => {
    expect(QUESTIONS).toHaveLength(118);
    expect(PARTS.map((p) => [p.id, questionsForPart(p.id).length])).toEqual([
      ['identity', 10],
      ['body', 18],
      ['skin', 10],
      ['mind', 14],
      ['dopamine', 10],
      ['work', 16],
      ['money', 12],
      ['people', 10],
      ['goals', 10],
      ['today', 8],
    ]);
    expect(PARTS.map((p) => p.n)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('numbers ids per part in order and never repeats an id or a text', () => {
    for (const part of PARTS) {
      questionsForPart(part.id).forEach((q, i) => expect(q.id).toBe(`${part.id}-${String(i + 1).padStart(2, '0')}`));
    }
    expect(new Set(QUESTIONS.map((q) => q.id)).size).toBe(118);
    expect(new Set(QUESTIONS.map((q) => q.text.toLowerCase())).size).toBe(118);
  });

  it('gives every type what it needs', () => {
    for (const q of QUESTIONS) {
      if (q.type === 'T') expect(q.options?.length, q.id).toBeGreaterThan(1);
      else expect(q.options, q.id).toBeUndefined();
      if (q.type === 'L') expect(q.labels, q.id).toHaveLength(5);
      if (q.allowOther) expect(q.type, q.id).toBe('T');
      if (q.unit || q.unitFree || q.step !== undefined) expect(q.type, q.id).toBe('N');
    }
  });

  it('keeps the house style: no exclamation marks, no emoji, short labels', () => {
    for (const q of QUESTIONS) {
      const all = [q.text, q.hint, q.placeholder, ...(q.options ?? []), ...(q.labels ?? [])].filter(Boolean).join(' ');
      expect(all, q.id).not.toMatch(/!/);
      expect(all, q.id).not.toMatch(/\p{Extended_Pictographic}/u);
      for (const l of q.labels ?? []) expect(l.length, `${q.id} ${l}`).toBeLessThanOrEqual(10);
    }
    for (const p of PARTS) expect(p.intro).not.toMatch(/!/);
  });

  it('keeps required minimal: the name plus one or two anchors per part', () => {
    const required = QUESTIONS.filter((q) => q.required).map((q) => q.id);
    expect(required).toContain('identity-01');
    for (const part of PARTS) {
      expect(questionsForPart(part.id).filter((q) => q.required).length, part.id).toBeLessThanOrEqual(2);
    }
    expect(required.length).toBeLessThanOrEqual(14);
  });

  it('knows what counts as answered', () => {
    const t = QUESTIONS.find((q) => q.id === 'body-16') as Question;
    expect(isAnswered(t, {})).toBe(false);
    expect(isAnswered(t, { 'body-16': [] })).toBe(false);
    expect(isAnswered(t, { [otherKey('body-16')]: 'night shifts' })).toBe(true);
    expect(choiceValues(t, { 'body-16': ['Exams', 'Travel'], [otherKey('body-16')]: ' night shifts ' })).toEqual(['Travel', 'Exams', 'night shifts']);
    const n = QUESTIONS.find((q) => q.id === 'body-02') as Question;
    expect(isAnswered(n, { 'body-02': 0 })).toBe(true);
    expect(isAnswered(n, { 'body-02': null })).toBe(false);
    const l = QUESTIONS.find((q) => q.id === 'mind-05') as Question;
    expect(isAnswered(l, { 'mind-05': 6 })).toBe(false);
    expect(isAnswered(l, { 'mind-05': 3 })).toBe(true);
    expect(answeredCount({ 'identity-01': 'Riya', 'body-02': 61, 'mind-05': 3, 'skin-03': '  ' })).toBe(3);
    expect(missingRequired('body', { 'body-02': 61 }).map((q) => q.id)).toEqual(['body-04']);
  });
});
