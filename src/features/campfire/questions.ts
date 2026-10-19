/**
 * Rotating night questions. Three a night, chosen by the day number so the same night always
 * shows the same three, and the mix changes from night to night. Answers are stored on
 * DayLog.answers under the question id, so ids must never change once shipped.
 */
export interface NightQuestion {
  id: string;
  text: string;
}

export const QUESTION_BANK: readonly NightQuestion[] = [
  { id: 'avoid', text: 'What did you avoid today?' },
  { id: 'better', text: 'Who did you make better today?' },
  { id: 'eighty', text: 'What would 80-year-old you say about today?' },
  { id: 'again', text: 'What did you do today that you would do again tomorrow?' },
  { id: 'energy', text: 'Where did your energy go today?' },
  { id: 'drain', text: 'What drained you today, and could you have seen it coming?' },
  { id: 'hour', text: 'Which hour of today mattered most?' },
  { id: 'learned', text: 'What do you know tonight that you did not know this morning?' },
  { id: 'honest', text: 'Where were you less than honest today, even with yourself?' },
  { id: 'harder', text: 'What did you make harder than it needed to be?' },
  { id: 'thanks', text: 'Who would you thank for today, and did you?' },
  { id: 'stopped', text: 'What did you stop yourself from doing?' },
  { id: 'surprise', text: 'What surprised you today?' },
  { id: 'body', text: 'What did your body tell you today?' },
  { id: 'phone', text: 'What were you avoiding the last time you picked up your phone?' },
  { id: 'scared', text: 'What scared you a little today, and did you do it anyway?' },
  { id: 'promise', text: 'Did you keep the promise you made this morning?' },
  { id: 'redo', text: 'If you could redo one moment of today, which one?' },
  { id: 'thought', text: 'Who did you think about but not contact?' },
  { id: 'small', text: 'What small win would nobody else notice?' },
  { id: 'future', text: 'What did today buy for the person you will be in a year?' },
  { id: 'wasted', text: 'What took time today and gave nothing back?' },
  { id: 'focus', text: 'When were you most focused today, and what made it possible?' },
  { id: 'kind', text: 'What kind thing did you do that nobody asked for?' },
  { id: 'excuse', text: 'What excuse did you hear yourself make today?' },
  { id: 'rest', text: 'Did you rest today, or just stop?' },
  { id: 'protect', text: 'What is the one thing tomorrow must not lose?' },
  { id: 'curious', text: 'What are you curious about right now?' },
  { id: 'compare', text: 'Who did you compare yourself to today, and was it fair?' },
  { id: 'enough', text: 'What would have made today enough?' },
];

/** Three distinct questions for a night. Offsets 0, 11 and 19 never collide in a bank of 30. */
export function questionsFor(dayNo: number): NightQuestion[] {
  const n = QUESTION_BANK.length;
  const base = (((dayNo * 7) % n) + n) % n;
  return [0, 11, 19].map((offset) => QUESTION_BANK[(base + offset) % n]!);
}
