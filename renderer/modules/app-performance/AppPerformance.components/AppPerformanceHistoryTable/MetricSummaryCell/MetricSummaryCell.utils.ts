export interface MetricSummarySparklineLine {
  id: string;
  points: MetricSummarySparklinePoint[];
  color: string;
}

export interface MetricSummarySparklinePoint {
  x: number;
  value: number | null;
}

export interface MetricSummarySparklineRange {
  min: number;
  max: number;
}

export interface MetricSummarySparklineSegment {
  points: string;
  areaPath: string;
}

const SPARKLINE_WIDTH = 100;
const SPARKLINE_HEIGHT = 16;
const SPARKLINE_PADDING_X = 1;
const SPARKLINE_PADDING_Y = 2;

export function resolveMetricSummarySparklineRange(
  lines: MetricSummarySparklineLine[],
): MetricSummarySparklineRange | null {
  const values = lines.flatMap((line) =>
    line.points
      .map((point) => point.value)
      .filter(
        (value): value is number =>
          typeof value === "number" && Number.isFinite(value),
      ),
  );

  if (values.length === 0) return null;

  return {
    min: Math.min(...values),
    max: Math.max(...values),
  };
}

export function buildMetricSummarySparklineSegments({
  points,
  range,
}: {
  points: MetricSummarySparklinePoint[];
  range: MetricSummarySparklineRange;
}): MetricSummarySparklineSegment[] {
  const visiblePoints = points.filter(
    (point) => Number.isFinite(point.x) && isFiniteNumber(point.value),
  ) as Array<{ x: number; value: number }>;
  const segments: MetricSummarySparklineSegment[] = [];
  const valueRange = range.max - range.min;
  const firstX = visiblePoints[0]?.x ?? 0;
  const lastX = visiblePoints.at(-1)?.x ?? firstX;
  const timeRange = lastX - firstX;
  const indexDenominator = Math.max(1, visiblePoints.length - 1);
  const drawableWidth = SPARKLINE_WIDTH - SPARKLINE_PADDING_X * 2;
  const drawableHeight = SPARKLINE_HEIGHT - SPARKLINE_PADDING_Y * 2;
  const current: Array<{ x: number; y: number }> = [];

  visiblePoints.forEach((point, index) => {
    const x =
      SPARKLINE_PADDING_X +
      (timeRange > 0
        ? (point.x - firstX) / timeRange
        : index / indexDenominator) *
        drawableWidth;
    const y =
      valueRange === 0
        ? SPARKLINE_HEIGHT / 2
        : SPARKLINE_PADDING_Y +
          (1 - (point.value - range.min) / valueRange) * drawableHeight;

    current.push({ x, y });
  });

  pushSegment(segments, current);
  return segments;
}

function pushSegment(
  segments: MetricSummarySparklineSegment[],
  points: Array<{ x: number; y: number }>,
): void {
  if (points.length <= 1) return;

  const linePoints = points
    .map((point) => `${roundPoint(point.x)},${roundPoint(point.y)}`)
    .join(" ");
  const pathPoints = points
    .map(
      (point, index) =>
        `${index === 0 ? "M" : "L"} ${roundPoint(point.x)},${roundPoint(point.y)}`,
    )
    .join(" ");
  const firstPoint = points[0];
  const lastPoint = points.at(-1)!;

  segments.push({
    points: linePoints,
    areaPath: `${pathPoints} L ${roundPoint(lastPoint.x)},${roundPoint(
      SPARKLINE_HEIGHT,
    )} L ${roundPoint(firstPoint.x)},${roundPoint(SPARKLINE_HEIGHT)} Z`,
  });
}

function isFiniteNumber(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function roundPoint(value: number): string {
  return value.toFixed(1);
}
