import '@/theme/anim-rewards.css';

/**
 * A short label ("+2", "Body") that rises off a ticked row and fades. Absolutely placed, so it never
 * moves the row. `nonce` comes from `useDataEdges`; a new one replays it.
 */
export function TickPop({ nonce, text, className = '' }: { nonce: number | undefined; text: string; className?: string }) {
  if (nonce === undefined) return null;
  return (
    <span key={nonce} aria-hidden="true" className={`rw-float absolute top-0 whitespace-nowrap text-mid ${className}`} data-testid="tick-pop">
      {text}
    </span>
  );
}

/** Class for the checkbox that was just ticked: alternates names so every tick restarts the pulse. */
export function pulseClass(nonce: number | undefined): string {
  if (nonce === undefined) return '';
  return nonce % 2 ? 'rw-pulse-a' : 'rw-pulse-b';
}
