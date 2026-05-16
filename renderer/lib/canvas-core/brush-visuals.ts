export interface BrushBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface BrushTravellerColors {
  fill: string;
  stroke: string;
  grip: string;
}

export function insetBrushBounds(
  bounds: BrushBounds,
  insetX: number,
  insetY: number,
): BrushBounds {
  return {
    left: bounds.left + insetX,
    right: Math.max(bounds.left + insetX + 1, bounds.right - insetX),
    top: bounds.top + insetY,
    bottom: Math.max(bounds.top + insetY + 1, bounds.bottom - insetY),
  };
}

export function fillBrushBounds(
  ctx: CanvasRenderingContext2D,
  bounds: BrushBounds,
): void {
  ctx.fillRect(
    bounds.left,
    bounds.top,
    bounds.right - bounds.left,
    bounds.bottom - bounds.top,
  );
}

export function clipToBrushBounds(
  ctx: CanvasRenderingContext2D,
  bounds: BrushBounds,
): void {
  ctx.beginPath();
  ctx.rect(
    bounds.left,
    bounds.top,
    bounds.right - bounds.left,
    bounds.bottom - bounds.top,
  );
  ctx.clip();
}

export function strokeBrushBounds(
  ctx: CanvasRenderingContext2D,
  bounds: BrushBounds,
): void {
  ctx.strokeRect(
    bounds.left + 0.5,
    bounds.top + 0.5,
    Math.max(0, bounds.right - bounds.left - 1),
    Math.max(0, bounds.bottom - bounds.top - 1),
  );
}

export function drawBrushTraveller({
  ctx,
  x,
  bounds,
  width,
  colors,
}: {
  ctx: CanvasRenderingContext2D;
  x: number;
  bounds: BrushBounds;
  width: number;
  colors: BrushTravellerColors;
}): void {
  const x0 = x - width / 2;
  const y0 = bounds.top - 1;
  const height = bounds.bottom - bounds.top + 2;
  const radius = 3;

  ctx.beginPath();
  ctx.moveTo(x0 + radius, y0);
  ctx.lineTo(x0 + width - radius, y0);
  ctx.arcTo(x0 + width, y0, x0 + width, y0 + radius, radius);
  ctx.lineTo(x0 + width, y0 + height - radius);
  ctx.arcTo(x0 + width, y0 + height, x0 + width - radius, y0 + height, radius);
  ctx.lineTo(x0 + radius, y0 + height);
  ctx.arcTo(x0, y0 + height, x0, y0 + height - radius, radius);
  ctx.lineTo(x0, y0 + radius);
  ctx.arcTo(x0, y0, x0 + radius, y0, radius);
  ctx.closePath();

  ctx.fillStyle = colors.fill;
  ctx.fill();
  ctx.strokeStyle = colors.stroke;
  ctx.lineWidth = 1;
  ctx.stroke();

  ctx.strokeStyle = colors.grip;
  const middleY = y0 + height / 2;
  ctx.beginPath();
  ctx.moveTo(x - 1.5, middleY - 4);
  ctx.lineTo(x - 1.5, middleY + 4);
  ctx.moveTo(x + 1.5, middleY - 4);
  ctx.lineTo(x + 1.5, middleY + 4);
  ctx.stroke();
}
