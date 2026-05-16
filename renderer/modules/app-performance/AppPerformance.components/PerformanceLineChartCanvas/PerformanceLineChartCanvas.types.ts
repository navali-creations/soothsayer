import type {
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
} from "../../AppPerformance.types";

export interface PerformanceLine {
  id: string;
  label: string;
  color: string;
  value: (sample: AppPerformanceSampleDTO) => number | null;
  axis?: "primary" | "secondary";
  dashed?: boolean;
  connectNullGaps?: boolean;
  valueFormatter?: (value: number | null) => string;
}

export interface PerformanceLineChartCanvasProps {
  samples: AppPerformanceSampleDTO[];
  routeMarkers: AppPerformanceRouteMarkerDTO[];
  lines: PerformanceLine[];
  xRange?: TimeRange | null;
  showBrush?: boolean;
  live?: boolean;
  captureDurationMs?: number | null;
  yMin?: number;
  yMaxFloor?: number;
  secondaryYMin?: number;
  secondaryYMaxFloor?: number;
  valueFormatter: (value: number | null) => string;
  secondaryValueFormatter?: (value: number | null) => string;
  xValueFormatter?: (value: number) => string;
  xTicks?: readonly number[];
  emptyLabel?: string;
  dense?: boolean;
  onXRangeChange?: (range: TimeRange | null) => void;
}

export interface HoverState {
  x: number;
  y: number;
  sample: AppPerformanceSampleDTO | null;
  marker: AppPerformanceRouteMarkerDTO | null;
}

export interface TimeRange {
  startMs: number;
  endMs: number;
}

export interface FullXDomain {
  xMin: number;
  xMax: number;
}

export interface ChartDomains extends FullXDomain {
  yMin: number;
  yMax: number;
  secondaryYMin: number;
  secondaryYMax: number;
}

export type BrushDragMode = "start" | "end" | "range" | null;

export interface BrushDragState {
  mode: BrushDragMode;
  originX: number;
  originRange: {
    start: number;
    end: number;
  };
}
