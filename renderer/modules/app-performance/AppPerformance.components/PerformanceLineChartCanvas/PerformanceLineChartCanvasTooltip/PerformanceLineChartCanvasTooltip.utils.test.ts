import { resolveTooltipPosition } from "./PerformanceLineChartCanvasTooltip.utils";

describe("PerformanceLineChartCanvasTooltip utils", () => {
  it("places the tooltip to the right of the hovered point when it fits", () => {
    expect(
      resolveTooltipPosition({
        canvasHeight: 220,
        canvasWidth: 640,
        hoverX: 100,
        hoverY: 60,
        tooltipHeight: 160,
        tooltipWidth: 190,
      }),
    ).toEqual({ left: 112, top: 42 });
  });

  it("flips the tooltip to the left near the chart's right edge", () => {
    expect(
      resolveTooltipPosition({
        canvasHeight: 220,
        canvasWidth: 640,
        hoverX: 600,
        hoverY: 60,
        tooltipHeight: 160,
        tooltipWidth: 190,
      }),
    ).toEqual({ left: 398, top: 42 });
  });

  it("keeps the tooltip inside a narrow chart when neither side fully fits", () => {
    expect(
      resolveTooltipPosition({
        canvasHeight: 120,
        canvasWidth: 160,
        hoverX: 80,
        hoverY: 110,
        tooltipHeight: 80,
        tooltipWidth: 190,
      }),
    ).toEqual({ left: 8, top: 32 });
  });
});
