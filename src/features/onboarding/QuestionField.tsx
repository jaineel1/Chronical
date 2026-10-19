import { useEffect, useId, useState, type ReactNode } from 'react';
import type { OnboardingAnswer } from '@/data/types';
import { Chip, Field, TextArea, TextInput } from '@/ui/primitives';
import { likertValue, numberValue, otherKey, unitKey, type Answers, type Question } from './questions';

type SetAnswer = (id: string, value: OnboardingAnswer | undefined) => void;

const NUMBER_CLASS = '[appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none';

/** The question, with its hint tucked under it in a quieter serif so it never reads as the next label. */
function QuestionLabel({ q }: { q: Question }) {
  return (
    <>
      {q.text}
      {q.hint ? <span className="mt-0.5 block font-serif text-[15px] leading-[1.4] italic">{q.hint}</span> : null}
    </>
  );
}

const NEEDED = <span className="text-red">The game needs this one.</span>;

/** Number input that keeps what is typed ("7.") while storing a number or nothing. */
function NumberInput({ id, value, onChange, q }: { id: string; value: number | undefined; onChange: (n: number | undefined) => void; q: Question }) {
  const [text, setText] = useState(value === undefined ? '' : String(value));
  useEffect(() => {
    setText((t) => {
      const current = t.trim() === '' ? undefined : Number(t);
      return current === value ? t : value === undefined ? '' : String(value);
    });
  }, [value]);
  return (
    <TextInput
      id={id}
      type="number"
      inputMode="decimal"
      min={q.min}
      max={q.max}
      step={q.step ?? 'any'}
      value={text}
      placeholder={q.placeholder}
      className={NUMBER_CLASS}
      onChange={(e) => {
        setText(e.target.value);
        const raw = e.target.value.trim();
        const n = raw === '' ? undefined : Number(raw);
        onChange(n !== undefined && Number.isFinite(n) ? n : undefined);
      }}
    />
  );
}

/** A group of chips (T, L) labelled like a Field, without a <label> that would click the first chip. */
function ChoiceGroup({ q, missing, children, after }: { q: Question; missing: boolean; children: ReactNode; after?: ReactNode }) {
  const labelId = `${useId()}-label`;
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-1.5">
      <span id={labelId} className="text-mid">
        <QuestionLabel q={q} />
      </span>
      <div className="flex flex-wrap gap-1.5">{children}</div>
      {after}
      {missing ? NEEDED : null}
    </div>
  );
}

/** A question with its control: S line, M box, T chips (+ something else), L five chips, N number + unit. */
export function QuestionField({ q, answers, setAnswer, missing = false }: { q: Question; answers: Answers; setAnswer: SetAnswer; missing?: boolean }) {
  const inputId = `${useId()}-input`;
  const raw = answers[q.id];
  const label = <QuestionLabel q={q} />;
  const below = missing ? NEEDED : undefined;

  let body: ReactNode;
  switch (q.type) {
    case 'S':
      body = (
        <Field label={label} hint={below}>
          <TextInput
            id={inputId}
            value={typeof raw === 'string' ? raw : ''}
            placeholder={q.placeholder}
            autoComplete={q.id === 'identity-01' ? 'given-name' : 'off'}
            className="font-serif"
            onChange={(e) => setAnswer(q.id, e.target.value)}
          />
        </Field>
      );
      break;
    case 'M':
      body = (
        <Field label={label} hint={below}>
          <TextArea id={inputId} rows={3} value={typeof raw === 'string' ? raw : ''} placeholder={q.placeholder} onChange={(e) => setAnswer(q.id, e.target.value)} />
        </Field>
      );
      break;
    case 'N':
      body = (
        <Field label={label} hint={below}>
          <span className="flex items-baseline gap-3">
            <span className="w-28 shrink-0">
              <NumberInput id={inputId} q={q} value={numberValue(raw)} onChange={(n) => setAnswer(q.id, n ?? null)} />
            </span>
            {q.unit ? <span className="text-mid">{q.unit}</span> : null}
            {q.unitFree ? (
              <span className="w-24 shrink-0">
                <TextInput
                  aria-label="Currency"
                  placeholder="currency"
                  value={typeof answers[unitKey(q.id)] === 'string' ? (answers[unitKey(q.id)] as string) : ''}
                  onChange={(e) => setAnswer(unitKey(q.id), e.target.value)}
                />
              </span>
            ) : null}
          </span>
        </Field>
      );
      break;
    case 'T': {
      const picked = Array.isArray(raw) ? raw : [];
      const toggle = (o: string) => setAnswer(q.id, picked.includes(o) ? picked.filter((p) => p !== o) : [...picked, o]);
      const other = answers[otherKey(q.id)];
      body = (
        <ChoiceGroup
          q={q}
          missing={missing}
          after={
            q.allowOther ? (
              <TextInput
                aria-label={`${q.text}: something else`}
                placeholder="Something else"
                className="font-serif"
                value={typeof other === 'string' ? other : ''}
                onChange={(e) => setAnswer(otherKey(q.id), e.target.value)}
              />
            ) : null
          }
        >
          {q.options!.map((o) => (
            <Chip key={o} active={picked.includes(o)} onClick={() => toggle(o)}>
              {o}
              {picked.includes(o) ? <span className="sr-only">, chosen</span> : null}
            </Chip>
          ))}
        </ChoiceGroup>
      );
      break;
    }
    case 'L': {
      const v = likertValue(raw);
      body = (
        <ChoiceGroup q={q} missing={missing}>
          {q.labels!.map((l, i) => (
            <Chip key={l} active={v === i + 1} onClick={() => setAnswer(q.id, v === i + 1 ? null : i + 1)}>
              <span className="sr-only">{i + 1} of 5, </span>
              {l}
              {v === i + 1 ? <span className="sr-only">, chosen</span> : null}
            </Chip>
          ))}
        </ChoiceGroup>
      );
      break;
    }
  }

  return (
    <div id={`q-${q.id}`} data-question={q.id} className="scroll-mt-6">
      {body}
    </div>
  );
}
