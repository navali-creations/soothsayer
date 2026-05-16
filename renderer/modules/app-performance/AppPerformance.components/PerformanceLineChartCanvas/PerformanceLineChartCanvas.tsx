import { memo } from "react";

import type {
  PerformanceLine,
  PerformanceLineChartCanvasProps,
} from "./PerformanceLineChartCanvas.types";
import { PerformanceLineChartCanvasTooltip } from "./PerformanceLineChartCanvasTooltip/PerformanceLineChartCanvasTooltip";
import { usePerformanceLineChartCanvasNode } from "./usePerformanceLineChartCanvasNode";

export type { PerformanceLine, PerformanceLineChartCanvasProps };

export const PerformanceLineChartCanvas = memo(
  (props: PerformanceLineChartCanvasProps) => {
    const chart = usePerformanceLineChartCanvasNode(props);

    return (
      <div
        ref={chart.containerRef}
        className={chart.containerClassName}
        onDoubleClick={chart.handleDoubleClick}
        onPointerDown={chart.handlePointerDown}
        onPointerMove={chart.handlePointerMove}
        onPointerUp={chart.handlePointerUp}
        onPointerCancel={chart.handlePointerUp}
        onPointerLeave={chart.handlePointerLeave}
      >
        <canvas
          ref={chart.canvasRef}
          data-chart-point-count={props.samples.length}
          data-testid="app-performance-line-chart-canvas"
          className="absolute inset-0 h-full w-full"
        />

        <PerformanceLineChartCanvasTooltip
          hover={chart.hover}
          canvasHeight={chart.canvasSize.height}
          canvasWidth={chart.canvasSize.width}
          lines={chart.lines}
          valueFormatter={chart.valueFormatter}
          secondaryValueFormatter={chart.secondaryValueFormatter}
          xValueFormatter={chart.xValueFormatter}
        />
      </div>
    );
  },
);
