import { describe, expect, it, vi } from "vitest";

const mockEnsureCanvasBackingStore = vi.hoisted(() => vi.fn(() => true));
const mockSetupCanvas = vi.hoisted(() => vi.fn());
const mockDrawDonutIndicator = vi.hoisted(() => vi.fn());
const mockDrawMonotoneCurve = vi.hoisted(() => vi.fn());

vi.mock("~/renderer/lib/canvas-core", () => ({
  clamp: (value: number, min: number, max: number) =>
    Math.max(min, Math.min(max, value)),
  createLinearMapper: (
    domainMin: number,
    domainMax: number,
    rangeMin: number,
    rangeMax: number,
  ) => {
    const fn = (value: number) => {
      const span = domainMax - domainMin || 1;
      return rangeMin + ((value - domainMin) / span) * (rangeMax - rangeMin);
    };
    fn.inverse = (pixel: number) => {
      const span = rangeMax - rangeMin || 1;
      return domainMin + ((pixel - rangeMin) / span) * (domainMax - domainMin);
    };
    return fn;
  },
  drawDonutIndicator: mockDrawDonutIndicator,
  drawMonotoneCurve: mockDrawMonotoneCurve,
  ensureCanvasBackingStore: mockEnsureCanvasBackingStore,
  evenTicks: (min: number, max: number, count: number) =>
    Array.from({ length: count }, (_, index) =>
      count === 1 ? min : min + ((max - min) * index) / (count - 1),
    ),
  setupCanvas: mockSetupCanvas,
}));

import {
  computeDomains,
  computeLayout,
  computeTooltipStyle,
  drawPFBreakevenChartCanvas,
  mapCategoryX,
  type PnLCurvePoint,
} from "./PFBreakevenChart.utils";

function makeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    fillText: vi.fn(),
    strokeRect: vi.fn(),
    setLineDash: vi.fn(),
    arc: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
  } as unknown as CanvasRenderingContext2D;
}

const colors = {
  bc06: "rgba(255,255,255,0.06)",
  bc15: "rgba(255,255,255,0.15)",
  bc20: "rgba(255,255,255,0.2)",
  bc30: "rgba(255,255,255,0.3)",
  bc35: "rgba(255,255,255,0.35)",
  bc40: "rgba(255,255,255,0.4)",
  bc50: "rgba(255,255,255,0.5)",
  bc100: "#fff",
  primary: "#00f",
  primary15: "rgba(0,0,255,0.15)",
  primary30: "rgba(0,0,255,0.3)",
  secondary: "#0f0",
  secondary60: "rgba(0,255,0,0.6)",
  b2: "#222",
  success50: "rgba(0,255,0,0.5)",
} as any;

const curveData: PnLCurvePoint[] = [
  { deckCount: 200, estimated: -200, optimistic: 100 },
  { deckCount: 1000, estimated: 200, optimistic: 1000 },
  { deckCount: 2000, estimated: 20000, optimistic: 220000 },
];

describe("PFBreakevenChart utils", () => {
  it("computes layouts, domains, category x positions, and tooltip styles", () => {
    const layout = computeLayout(800, 260);
    expect(layout).toMatchObject({
      chartLeft: 62,
      chartRight: 766,
      chartTop: 10,
      chartBottom: 222,
    });
    expect(computeLayout(10, 10)).toMatchObject({
      chartWidth: 0,
      chartHeight: 0,
    });
    expect(mapCategoryX(0, 1, layout)).toBe(layout.chartLeft + 352);

    const singleDomain = computeDomains([
      { deckCount: 5, estimated: 0, optimistic: 0 },
    ]);
    expect(singleDomain.x).toEqual({ min: 4, max: 6 });
    expect(singleDomain.y.min).toBeLessThan(0);
    expect(singleDomain.y.max).toBeGreaterThan(0);

    expect(
      computeTooltipStyle({
        tooltip: { visible: false, x: 0, y: 0, dataPoint: curveData[0] },
        tooltipSize: { width: 0, height: 0 },
        canvasSize: { width: 800, height: 260 },
      }),
    ).toEqual({ display: "none" });
    expect(
      computeTooltipStyle({
        tooltip: { visible: true, x: 790, y: 250, dataPoint: curveData[0] },
        tooltipSize: { width: 120, height: 80 },
        canvasSize: { width: 800, height: 260 },
      }),
    ).toMatchObject({
      left: "658px",
      top: "158px",
      pointerEvents: "none",
    });
  });

  it("draws chart canvas and handles setup fallbacks", () => {
    const ctx = makeCtx();
    const layout = computeLayout(800, 260);
    const canvas = document.createElement("canvas");
    const domains = computeDomains(curveData);

    mockEnsureCanvasBackingStore.mockReturnValueOnce(false);
    drawPFBreakevenChartCanvas({
      canvas,
      sourceElement: null,
      domains,
      curveData,
      layout,
      canvasSize: { width: 800, height: 260 },
      chaosToDivineRatio: 0,
      hoverIndex: 0,
      c: colors,
    });
    expect(mockSetupCanvas).not.toHaveBeenCalled();

    mockEnsureCanvasBackingStore.mockReturnValue(true);
    mockSetupCanvas.mockReturnValueOnce(null);
    drawPFBreakevenChartCanvas({
      canvas,
      sourceElement: null,
      domains,
      curveData,
      layout,
      canvasSize: { width: 800, height: 260 },
      chaosToDivineRatio: 0,
      hoverIndex: 0,
      c: colors,
    });
    expect(ctx.strokeRect).not.toHaveBeenCalled();

    mockSetupCanvas.mockReturnValueOnce({ ctx, width: 800, height: 260 });
    drawPFBreakevenChartCanvas({
      canvas,
      sourceElement: null,
      domains,
      curveData,
      layout,
      canvasSize: { width: 0, height: 0 },
      chaosToDivineRatio: 0,
      hoverIndex: 0,
      c: colors,
    });

    expect(ctx.strokeRect).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalledWith(
      "Break-even",
      expect.any(Number),
      expect.any(Number),
    );
    expect(ctx.fillText).toHaveBeenCalledWith(
      expect.stringContaining("c"),
      expect.any(Number),
      expect.any(Number),
    );
    expect(mockDrawMonotoneCurve).toHaveBeenCalled();
    expect(mockDrawDonutIndicator).toHaveBeenCalled();
  });
});
