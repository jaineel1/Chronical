import type { CSSProperties, ReactNode } from 'react';
import '@/theme/anim-rewards.css';

/**
 * The same row as `StatRow` (name | 4px bar | value | trailing), with a bar that can fill from
 * `from` to `value` once. Without `from` it renders exactly like `StatRow`.
 */
export function FillStatRow({
  name,
  value,
  from,
  max = 10,
  trailing,
  nameWidth = 84,
}: {
  name: string;
  value: number;
  /** The value before; the bar steps from here to `value` when it mounts. */
  from?: number;
  max?: number;
  trailing?: ReactNode;
  nameWidth?: number;
}) {
  const pct = (v: number) => Math.max(0, Math.min(100, (v / max) * 100));
  const to = `${pct(value)}%`;
  const animate = from !== undefined && from !== value;
  const style: CSSProperties & Record<'--rw-from' | '--rw-to', string> = { width: to, '--rw-from': `${pct(from ?? value)}%`, '--rw-to': to };
  return (
    <div className="flex items-center gap-3">
      <span style={{ width: nameWidth }} className="shrink-0 truncate">
        {name}
      </span>
      <div className="h-1 flex-1 bg-faint">
        <div className={`h-1 bg-mid ${animate ? 'rw-fill' : ''}`} style={style} data-testid={animate ? 'bar-fill' : undefined} />
      </div>
      <span className="w-[30px] shrink-0 text-right">{value.toFixed(1)}</span>
      {trailing}
    </div>
  );
}
