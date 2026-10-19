import { useEffect, useRef, useState } from 'react';
import { createDebouncedSaver, type DebouncedSaver } from '@/features/onboarding/saver';

/**
 * A text setting that saves itself ~400 ms after typing stops, and on unmount, so leaving the page
 * mid-word loses nothing. Returns the local value and its setter.
 */
export function useSavedField(initial: string, save: (value: string) => Promise<unknown>, delay = 400): [string, (v: string) => void] {
  const [value, setValue] = useState(initial);
  const saveRef = useRef(save);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);
  const saverRef = useRef<DebouncedSaver<string> | null>(null);
  if (!saverRef.current) saverRef.current = createDebouncedSaver<string>((v) => saveRef.current(v), delay);
  const saver = saverRef.current;
  useEffect(() => () => void saver.flush(), [saver]);
  return [
    value,
    (v: string) => {
      setValue(v);
      saver.schedule(v);
    },
  ];
}
