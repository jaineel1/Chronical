import { describe, expect, it } from 'vitest';
import { isDayKey, parseLoreReply, parseValueUnit } from './lore';

const CANONICAL = `## FACTS
- Started running in March after a bad exam season.
- Runs best before 7 AM; afternoon runs feel heavy.

## ACHIEVEMENTS
2026-10-12 | Long run 22 km | 22 km
2026-10-18 | 8 km at 5:52 pace | 8 km

## LESSONS
none

## UPDATES
level: 64
goal: Sub-4 marathon in January

## REPLY
I will remember the March start and the early mornings. The 22 km run is the longest yet, and it moves Running to 64.
`;

describe('parseLoreReply', () => {
  it('parses the canonical reply', () => {
    const r = parseLoreReply(CANONICAL);
    expect(r.ok).toBe(true);
    expect(r.errors).toEqual([]);
    expect(r.facts).toEqual(['Started running in March after a bad exam season.', 'Runs best before 7 AM; afternoon runs feel heavy.']);
    expect(r.achievements).toEqual([
      { date: '2026-10-12', text: 'Long run 22 km', value: 22, unit: 'km' },
      { date: '2026-10-18', text: '8 km at 5:52 pace', value: 8, unit: 'km' },
    ]);
    expect(r.lessons).toEqual([]);
    expect(r.updates).toEqual({ level: '64', goal: 'Sub-4 marathon in January' });
    expect(r.replyMd).toMatch(/^I will remember/);
  });

  it('is ok with only a REPLY', () => {
    const r = parseLoreReply('## REPLY\nNoted. I will keep it.');
    expect(r.ok).toBe(true);
    expect(r.facts).toEqual([]);
  });

  it('is ok with only FACTS', () => {
    const r = parseLoreReply('## FACTS\n- Mentor ran a design studio for ten years.');
    expect(r.ok).toBe(true);
    expect(r.replyMd).toBe('');
  });

  it('rejects text without FACTS or REPLY', () => {
    const r = parseLoreReply('Thanks for sharing. Running sounds great.');
    expect(r.ok).toBe(false);
    expect(r.errors[0]).toBe('No ## FACTS or ## REPLY section in the reply.');
  });

  it('rejects FACTS that only say none and an empty REPLY', () => {
    const r = parseLoreReply('## FACTS\nnone\n## REPLY\n');
    expect(r.ok).toBe(false);
  });

  it('accepts "none" in every optional section', () => {
    const r = parseLoreReply('## FACTS\n- One fact.\n## ACHIEVEMENTS\nnone\n## LESSONS\n- none\n## UPDATES\nnone\n## REPLY\nOk.');
    expect(r.achievements).toEqual([]);
    expect(r.lessons).toEqual([]);
    expect(r.updates).toEqual({});
  });

  it('reads achievements with none for the date or the value', () => {
    const r = parseLoreReply('## FACTS\n- x\n## ACHIEVEMENTS\nnone | Shipped the invoice PDFs | none\n2026-10-01 | First 10 km | 10 km');
    expect(r.achievements).toEqual([
      { date: undefined, text: 'Shipped the invoice PDFs' },
      { date: '2026-10-01', text: 'First 10 km', value: 10, unit: 'km' },
    ]);
  });

  it('reads two-cell and one-cell achievement lines', () => {
    const r = parseLoreReply('## FACTS\n- x\n## ACHIEVEMENTS\n2026-10-03 | Squat 70 kg x 5\nBench 60 kg | 60 kg\n- Gave a talk to the class');
    expect(r.achievements).toEqual([
      { date: '2026-10-03', text: 'Squat 70 kg x 5' },
      { text: 'Bench 60 kg', value: 60, unit: 'kg' },
      { text: 'Gave a talk to the class' },
    ]);
  });

  it('normalizes slash dates and reports unreadable ones', () => {
    const r = parseLoreReply('## FACTS\n- x\n## ACHIEVEMENTS\n2026/9/5 | Ran 5 km | 5 km\nlast Sunday | Ran 12 km | 12 km');
    expect(r.achievements[0]!.date).toBe('2026-09-05');
    expect(r.achievements[1]!.date).toBeUndefined();
    expect(r.errors).toEqual(['Could not read the date "last Sunday"; used today instead.']);
  });

  it('rejects impossible dates', () => {
    expect(isDayKey('2026-02-30')).toBe(false);
    expect(isDayKey('2026-02-28')).toBe(true);
    expect(isDayKey('26-02-28')).toBe(false);
  });

  it('parses value and unit cells', () => {
    expect(parseValueUnit('22 km')).toEqual({ value: 22, unit: 'km' });
    expect(parseValueUnit('1,240 pts')).toEqual({ value: 1240, unit: 'pts' });
    expect(parseValueUnit('7.5')).toEqual({ value: 7.5 });
    expect(parseValueUnit('none')).toEqual({});
    expect(parseValueUnit('about a week')).toEqual({});
  });

  it('canonicalizes update keys and strips quotes and bold', () => {
    const r = parseLoreReply('## FACTS\n- x\n## UPDATES\n- contact_every_days: 10\n- **Want closer**: yes\n- Notes: "Ask about the studio move."\n- target date = 2027-01-18\n- mood: great');
    expect(r.updates).toEqual({
      contactEveryDays: '10',
      wantCloser: 'yes',
      notes: 'Ask about the studio move.',
      targetDate: '2027-01-18',
      mood: 'great',
    });
  });

  it('skips updates that say no change', () => {
    const r = parseLoreReply('## FACTS\n- x\n## UPDATES\nlevel: no change\nstatus: done');
    expect(r.updates).toEqual({ status: 'done' });
  });

  it('reads lessons for books', () => {
    const r = parseLoreReply('## FACTS\n- Read it on the train.\n## LESSONS\n- Schedule the block the night before.\n* Never miss twice.\n## REPLY\nTwo lessons kept.');
    expect(r.lessons).toEqual(['Schedule the block the night before.', 'Never miss twice.']);
  });

  it('handles bold headers, aliases and a code fence', () => {
    const r = parseLoreReply('```\n**FACT**\n- Likes coffee meetings.\n**RESPONSE**\nI will remember the coffee.\n```');
    expect(r.ok).toBe(true);
    expect(r.facts).toEqual(['Likes coffee meetings.']);
    expect(r.replyMd).toBe('I will remember the coffee.');
  });

  it('keeps multi-paragraph replies', () => {
    const r = parseLoreReply('## REPLY\nFirst paragraph.\n\nSecond paragraph.');
    expect(r.replyMd).toBe('First paragraph.\n\nSecond paragraph.');
  });

  it('survives empty input', () => {
    expect(parseLoreReply('').ok).toBe(false);
    expect(parseLoreReply(undefined as unknown as string).ok).toBe(false);
  });

  it('reports an achievement line with only a date', () => {
    const r = parseLoreReply('## FACTS\n- x\n## ACHIEVEMENTS\n2026-10-01 | none | 5 km');
    expect(r.achievements).toEqual([]);
    expect(r.errors[0]).toMatch(/without text/);
  });

  it('reads a markdown table of achievements', () => {
    const r = parseLoreReply('## FACTS\n- x\n## ACHIEVEMENTS\n| 2026-10-12 | Long run 22 km | 22 km |');
    expect(r.achievements).toEqual([{ date: '2026-10-12', text: 'Long run 22 km', value: 22, unit: 'km' }]);
  });
});
