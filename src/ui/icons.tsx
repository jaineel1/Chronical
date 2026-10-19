import type { SVGProps } from 'react';

/**
 * Pixel icons on a 10×10 grid, drawn with rects so they stay crisp at any integer scale.
 * All take `currentColor`, so the parent's text colour decides the fill.
 */
type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Base({ size = 18, children, ...rest }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 10 10"
      shapeRendering="crispEdges"
      fill="currentColor"
      data-pixel=""
      {...rest}
    >
      {children}
    </svg>
  );
}

export function SunIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="3" width="4" height="4" />
      <rect x="4" y="0" width="2" height="1" />
      <rect x="4" y="9" width="2" height="1" />
      <rect x="0" y="4" width="1" height="2" />
      <rect x="9" y="4" width="1" height="2" />
      <rect x="1" y="1" width="1" height="1" />
      <rect x="8" y="1" width="1" height="1" />
      <rect x="1" y="8" width="1" height="1" />
      <rect x="8" y="8" width="1" height="1" />
    </Base>
  );
}

export function MapIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="0" y="1" width="10" height="1" />
      <rect x="0" y="8" width="10" height="1" />
      <rect x="0" y="1" width="1" height="8" />
      <rect x="9" y="1" width="1" height="8" />
      <rect x="2" y="3" width="2" height="1" />
      <rect x="4" y="4" width="2" height="1" />
      <rect x="6" y="5" width="2" height="1" />
    </Base>
  );
}

export function FireIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4" y="0" width="1" height="1" />
      <rect x="3" y="1" width="2" height="1" />
      <rect x="6" y="2" width="1" height="1" />
      <rect x="2" y="2" width="4" height="1" />
      <rect x="2" y="3" width="5" height="2" />
      <rect x="1" y="5" width="7" height="2" />
      <rect x="2" y="7" width="5" height="1" />
      <rect x="1" y="9" width="8" height="1" />
    </Base>
  );
}

export function PersonIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="0" width="4" height="4" />
      <rect x="2" y="5" width="6" height="5" />
      <rect x="1" y="6" width="1" height="2" />
      <rect x="8" y="6" width="1" height="2" />
    </Base>
  );
}

export function PeopleIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4" y="4" width="2" height="6" />
      <rect x="1" y="1" width="3" height="3" />
      <rect x="6" y="1" width="3" height="3" />
      <rect x="3" y="3" width="4" height="2" />
    </Base>
  );
}

export function ChestIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="1" y="2" width="8" height="2" />
      <rect x="0" y="4" width="10" height="5" />
      <rect x="4" y="5" width="2" height="2" fill="var(--color-ink)" />
    </Base>
  );
}

export function BarsIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="0" y="7" width="2" height="3" />
      <rect x="3" y="5" width="2" height="5" />
      <rect x="6" y="2" width="2" height="8" />
      <rect x="8" y="0" width="2" height="1" />
    </Base>
  );
}

export function StarIcon(p: IconProps) {
  return (
    <svg aria-hidden="true" width={p.size ?? 18} height={p.size ?? 18} viewBox="0 0 9 9" shapeRendering="crispEdges" fill="currentColor" data-pixel="">
      <rect x="4" y="0" width="1" height="1" />
      <rect x="3" y="1" width="3" height="1" />
      <rect x="0" y="2" width="9" height="1" />
      <rect x="1" y="3" width="7" height="1" />
      <rect x="2" y="4" width="5" height="1" />
      <rect x="2" y="5" width="5" height="1" />
      <rect x="1" y="6" width="3" height="1" />
      <rect x="5" y="6" width="3" height="1" />
      <rect x="0" y="7" width="2" height="1" />
      <rect x="7" y="7" width="2" height="1" />
    </svg>
  );
}

export function PlusIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="4" y="1" width="2" height="8" />
      <rect x="1" y="4" width="8" height="2" />
    </Base>
  );
}

export function ChevronIcon(p: IconProps) {
  return (
    <Base {...p}>
      <rect x="3" y="1" width="1" height="1" />
      <rect x="4" y="2" width="1" height="1" />
      <rect x="5" y="3" width="1" height="1" />
      <rect x="6" y="4" width="1" height="2" />
      <rect x="5" y="6" width="1" height="1" />
      <rect x="4" y="7" width="1" height="1" />
      <rect x="3" y="8" width="1" height="1" />
    </Base>
  );
}
