import {
  buildPointSegments,
  buildSegmentGapConnectors,
  colorWithAlpha,
} from "~/renderer/lib/canvas-core";
import type { AppPerformanceSampleDTO } from "~/renderer/modules/app-performance";

export { createFormattedMetricStats as metricStats } from "~/renderer/modules/app-performance/AppPerformance.utils/AppPerformance.utils";

export type MiniLineAxis = "primary" | "secondary";

export interface MiniLine {
  id: string;
  color: string;
  axis?: MiniLineAxis;
  dashed?: boolean;
  connectNullGaps?: boolean;
  value: (sample: AppPerformanceSampleDTO) => number | null;
}

export interface MiniChartConfig {
  id: string;
  title: string;
  yMaxFloor: number;
  format: (value: number | null) => string;
  primaryValue: (sample: AppPerformanceSampleDTO) => number | null;
  lines: MiniLine[];
  secondaryYMaxFloor?: number;
}

export const MAX_MINI_CHART_SAMPLES = 60;
export const CHART_WIDTH = 120;
export const CHART_HEIGHT = 30;
export const CHART_PADDING = 3;

export function getMiniLineGapColor(color: string): string {
  return colorWithAlpha(color, 0.45);
}

export function resolveYMax(
  samples: AppPerformanceSampleDTO[],
  lines: MiniLine[],
  yMaxFloor: number,
  axis: MiniLineAxis = "primary",
): number {
  const values = samples.flatMap((sample) =>
    lines
      .filter((line) => (line.axis ?? "primary") === axis)
      .map((line) => line.value(sample))
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      ),
  );
  return Math.max(yMaxFloor, ...values, 1);
}

export function buildLineSegments(
  samples: AppPerformanceSampleDTO[],
  line: MiniLine,
  yMax: number,
): string[] {
  return buildLinePointSegments(samples, line, yMax)
    .filter((segment) => segment.length > 1)
    .map((segment) => segment.join(" "));
}

export function buildLineGapConnectors(
  samples: AppPerformanceSampleDTO[],
  line: MiniLine,
  yMax: number,
): string[] {
  const segments = buildLinePointSegments(samples, line, yMax);
  return buildSegmentGapConnectors(segments).map(
    ([startPoint, endPoint]) => `${startPoint} ${endPoint}`,
  );
}

function buildLinePointSegments(
  samples: AppPerformanceSampleDTO[],
  line: MiniLine,
  yMax: number,
): string[][] {
  const drawableWidth = CHART_WIDTH - CHART_PADDING * 2;
  const drawableHeight = CHART_HEIGHT - CHART_PADDING * 2;
  const denominator = Math.max(1, samples.length - 1);

  return buildPointSegments(samples, (sample, index) => {
    const value = line.value(sample);
    if (value === null || !Number.isFinite(value)) {
      return null;
    }

    const x = CHART_PADDING + (index / denominator) * drawableWidth;
    const y =
      CHART_PADDING +
      drawableHeight -
      Math.max(0, Math.min(1, value / yMax)) * drawableHeight;
    return `${roundPoint(x)},${roundPoint(y)}`;
  });
}

function roundPoint(value: number): string {
  return value.toFixed(1);
}
