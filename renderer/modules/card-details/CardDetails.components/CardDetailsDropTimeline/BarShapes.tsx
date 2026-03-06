import { BAR_WIDTH, GRADIENT_ID_BAR } from "./constants";
import type { BarShapeProps } from "./types";

// ─── Custom Bar Shapes ─────────────────────────────────────────────────────
// Recharts' default Bar rendering on numeric/time axes can collapse bars to
// sub-pixel widths when many points span a large domain.  These custom shape
// renderers guarantee a minimum visible width and skip invisible points
// (boundaries / gaps with count === 0).

/** Main chart bar — gradient fill, 1px border matching section bg for spacing, skips zero-count points. */
export function MainBarShape({
  x,
  y,
  width,
  height,
  fill,
  payload,
  radius = 2,
}: BarShapeProps) {
  if (x == null || y == null || width == null || height == null) return null;
  if (!payload || payload.count === 0) return null;

  const w = BAR_WIDTH;
  const cx = x + width / 2 - w / 2; // centre the bar on the original position
  const h = Math.max(height, 1);

  // `fill` carries c.b2 (section background) from the <Bar> component,
  // used as the stroke so bars blend into the background with spacing.
  return (
    <rect
      x={cx}
      y={y}
      width={w}
      height={h}
      fill={`url(#${GRADIENT_ID_BAR})`}
      stroke={fill}
      strokeWidth={1}
      rx={radius}
      ry={radius}
    />
  );
}

/** Overview chart bar — flat semi-transparent fill, 1px bg-colored border for spacing.
 *  `fill` is repurposed to carry c.b2 (section background) for the stroke;
 *  the actual bar fill is hardcoded to semi-transparent white. */
export function OverviewBarShape({
  x,
  y,
  width,
  height,
  fill,
  payload,
}: BarShapeProps) {
  if (x == null || y == null || width == null || height == null) return null;
  if (!payload || payload.count === 0) return null;

  const w = BAR_WIDTH;
  const cx = x + width / 2 - w / 2;
  const h = Math.max(height, 1);

  return (
    <rect
      x={cx}
      y={y}
      width={w}
      height={h}
      fill="rgba(255, 255, 255, 0.5)"
      stroke={fill}
      strokeWidth={1}
      rx={1}
      ry={1}
    />
  );
}
