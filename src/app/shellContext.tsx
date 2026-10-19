import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export interface ShellBar {
  /** Left side of the top bar, e.g. "Morning" or "Sunday, 18 October". */
  title: string;
  /** Right side, muted, e.g. "Day 23, level 7". */
  meta?: string;
}

interface ShellContextValue {
  bar: ShellBar | null;
  setBar: (bar: ShellBar | null) => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [bar, setBarState] = useState<ShellBar | null>(null);
  const setBar = useCallback((next: ShellBar | null) => setBarState(next), []);
  const value = useMemo(() => ({ bar, setBar }), [bar, setBar]);
  return <ShellContext.Provider value={value}>{children}</ShellContext.Provider>;
}

export function useShellContext(): ShellContextValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShellContext must be used inside ShellProvider');
  return ctx;
}

/**
 * Screens call this to set the dark top bar's text. Pass `null` meta to show only a title.
 * The bar resets when the screen unmounts, so a route without a call falls back to its route name.
 */
export function useShellBar(title: string, meta?: string) {
  const { setBar } = useShellContext();
  useEffect(() => {
    setBar({ title, meta });
    return () => setBar(null);
  }, [title, meta, setBar]);
}
