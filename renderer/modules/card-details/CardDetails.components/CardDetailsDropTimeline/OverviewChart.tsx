import {
  Area,
  AreaChart,
  Bar,
  Brush,
  ComposedChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartColors } from "~/renderer/hooks";

import { OverviewBarShape } from "./BarShapes";
import { BRUSH_HEIGHT, OVERVIEW_HEIGHT } from "./constants";
import { formatAxisDate } from "./helpers";
import type { ChartDataPoint } from "./types";

interface OverviewChartProps {
  chartData: ChartDataPoint[];
  maxPerSession: number;
  brushStartIndex: number | undefined;
  brushEndIndex: number | undefined;
  handleBrushChange: (newState: {
    startIndex?: number;
    endIndex?: number;
  }) => void;
  c: ChartColors;
}

/**
 * Overview chart: per-day bars with count labels + brush with cumulative
 * area line rendered inside.
 *
 * Sits below the main chart and provides pan/zoom navigation via the
 * Recharts Brush component.
 */
const OverviewChart = ({
  chartData,
  maxPerSession,
  brushStartIndex,
  brushEndIndex,
  handleBrushChange,
  c,
}: OverviewChartProps) => {
  return (
    <div className="w-full px-1" style={{ height: OVERVIEW_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={chartData}
          margin={{ top: 14, right: 12, left: 12, bottom: 0 }}
        >
          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            hide
            scale="time"
          />

          {/* Hidden Y axis for bars */}
          <YAxis
            yAxisId="overview-bar"
            hide
            domain={[0, Math.ceil(maxPerSession * 1.4) || 1]}
          />

          {/* Bars with count labels — fill carries c.b2 for stroke color */}
          <Bar
            yAxisId="overview-bar"
            dataKey="count"
            fill={c.b2}
            shape={<OverviewBarShape />}
            isAnimationActive={false}
            label={
              ((props: Record<string, unknown>) => {
                const value = props.value as number;
                if (!value || value <= 0) return <text />;
                const index = props.index as number;
                const x = props.x as number;
                const y = props.y as number;
                const width = props.width as number;

                // Only show label for the largest count within a cluster
                // of nearby bars to avoid overlapping text.
                const clusterThreshold = 14; // px — if bars are closer than this, they overlap
                for (let j = 0; j < chartData.length; j++) {
                  if (j === index) continue;
                  const neighbor = chartData[j];
                  if (
                    !neighbor ||
                    neighbor.count <= 0 ||
                    neighbor.isBoundary ||
                    neighbor.isGap
                  )
                    continue;
                  // Estimate neighbor x position relative to this bar
                  // Use time difference scaled to chart width as approximation
                  const timeDomain =
                    chartData[chartData.length - 1].time - chartData[0].time;
                  if (timeDomain <= 0) break;
                  const chartWidth = 600; // approximate; labels only hide in dense clusters
                  const neighborX =
                    ((neighbor.time - chartData[0].time) / timeDomain) *
                    chartWidth;
                  const thisX =
                    ((chartData[index].time - chartData[0].time) / timeDomain) *
                    chartWidth;
                  const dist = Math.abs(neighborX - thisX);
                  if (dist < clusterThreshold && neighbor.count > value) {
                    return <text />; // a nearby bar has a bigger count — suppress this label
                  }
                }

                return (
                  <text
                    x={x + width / 2}
                    y={y - 4}
                    textAnchor="middle"
                    fill={c.bc50}
                    fontSize={8}
                  >
                    {value}
                  </text>
                );
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
              }) as any
            }
          />

          {/* Brush with cumulative line rendered inside */}
          <Brush
            dataKey="time"
            height={BRUSH_HEIGHT}
            stroke={c.bc15}
            fill={c.b2}
            travellerWidth={8}
            tickFormatter={formatAxisDate}
            startIndex={brushStartIndex}
            endIndex={brushEndIndex}
            onChange={handleBrushChange}
          >
            <AreaChart data={chartData}>
              <Area
                type="monotone"
                dataKey="cumulativeCount"
                stroke={c.primary}
                fill={c.primary15}
                strokeWidth={1}
                dot={false}
                isAnimationActive={false}
              />
            </AreaChart>
          </Brush>
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default OverviewChart;
