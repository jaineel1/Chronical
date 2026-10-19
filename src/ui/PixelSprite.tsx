import { useMemo } from 'react';

export interface PixelSpriteProps {
  /** Rows of equal length; '.' is transparent, any other char looks up `palette`. */
  map: readonly string[];
  palette: Readonly<Record<string, string>>;
  /** Pixel size in CSS px. Keep integers so edges stay crisp. */
  scale?: number;
  /** Accessible name; omit for pure decoration. */
  label?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Draws a pixel sprite from a string map with a single box-shadow list.
 * The wrapper element has the sprite's true width and height, so it can be laid out
 * like any other box: no anchor-point surprises when positioning.
 */
export function PixelSprite({ map, palette, scale = 4, label, className, style }: PixelSpriteProps) {
  const rows = map.length;
  const cols = map[0]?.length ?? 0;

  const shadow = useMemo(() => {
    const parts: string[] = [];
    map.forEach((row, r) => {
      for (let c = 0; c < row.length; c++) {
        const ch = row[c]!;
        if (ch === '.') continue;
        const color = palette[ch];
        if (!color) continue;
        parts.push(`${c * scale}px ${r * scale}px 0 0 ${color}`);
      }
    });
    return parts.join(', ');
  }, [map, palette, scale]);

  // The inner pixel is a plain block child, so it sits at the wrapper's top-left without any
  // positioning. That leaves `position` free for callers (e.g. className="absolute top-0 right-6").
  return (
    <div
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={className}
      data-pixel=""
      style={{ width: cols * scale, height: rows * scale, flex: 'none', padding: 0, ...style }}
    >
      <div
        style={{
          display: 'block',
          width: scale,
          height: scale,
          background: 'transparent',
          boxShadow: shadow,
        }}
      />
    </div>
  );
}
