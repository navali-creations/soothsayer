import { describe, expect, it, vi } from "vitest";

import {
  clipToBrushBounds,
  drawBrushTraveller,
  fillBrushBounds,
  insetBrushBounds,
  strokeBrushBounds,
} from "./brush-visuals";

function mockCtx(): CanvasRenderingContext2D {
  return {
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    arcTo: vi.fn(),
    closePath: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
}

describe("brush visuals", () => {
  it("insets bounds while preserving a drawable minimum size", () => {
    expect(
      insetBrushBounds({ left: 10, right: 20, top: 30, bottom: 36 }, 8, 4),
    ).toEqual({
      left: 18,
      right: 19,
      top: 34,
      bottom: 35,
    });
  });

  it("fills, clips, and strokes brush bounds", () => {
    const ctx = mockCtx();
    const bounds = { left: 10, right: 110, top: 20, bottom: 50 };

    fillBrushBounds(ctx, bounds);
    clipToBrushBounds(ctx, bounds);
    strokeBrushBounds(ctx, bounds);

    expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 30);
    expect(ctx.beginPath).toHaveBeenCalled();
    expect(ctx.rect).toHaveBeenCalledWith(10, 20, 100, 30);
    expect(ctx.clip).toHaveBeenCalled();
    expect(ctx.strokeRect).toHaveBeenCalledWith(10.5, 20.5, 99, 29);
  });

  it("draws a rounded brush traveller with grip lines", () => {
    const ctx = mockCtx();

    drawBrushTraveller({
      ctx,
      x: 40,
      bounds: { left: 10, right: 110, top: 20, bottom: 50 },
      width: 8,
      colors: {
        fill: "#111",
        stroke: "#222",
        grip: "#333",
      },
    });

    expect(ctx.arcTo).toHaveBeenCalledTimes(4);
    expect(ctx.closePath).toHaveBeenCalledTimes(1);
    expect(ctx.fill).toHaveBeenCalledTimes(1);
    expect(ctx.stroke).toHaveBeenCalledTimes(2);
    expect(ctx.moveTo).toHaveBeenCalledWith(38.5, 31);
    expect(ctx.lineTo).toHaveBeenCalledWith(38.5, 39);
    expect(ctx.moveTo).toHaveBeenCalledWith(41.5, 31);
    expect(ctx.lineTo).toHaveBeenCalledWith(41.5, 39);
  });
});
