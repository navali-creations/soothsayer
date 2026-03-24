import type { ActiveDotProps, DotItemDotProps } from "recharts";
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import type { ChartColors } from "~/renderer/hooks";

import { MainBarShape } from "./BarShapes";
import { CHART_HEIGHT, GRADIENT_ID_AREA, GRADIENT_ID_BAR } from "./constants";
import DropTimelineTooltip from "./DropTimelineTooltip";
import { formatAxisDate } from "./helpers";
import type { ChartDataPoint, LeagueMarker } from "./types";

interface MainChartProps {
  visibleData: ChartDataPoint[];
  visibleMaxCumulative: number;
  visibleMaxPerSession: number;
  visibleMarkers: LeagueMarker[];
  c: ChartColors;
}

/**
 * Main chart: cumulative area/line (left Y-axis) + per-day bars (right Y-axis).
 *
 * This is the zoomed view controlled by the brush in the overview chart.
 * Includes league start/end reference lines and a custom tooltip.
 */
const MainChart = ({
  visibleData,
  visibleMaxCumulative,
  visibleMaxPerSession,
  visibleMarkers,
  c,
}: MainChartProps) => {
  return (
    <div className="w-full" style={{ height: CHART_HEIGHT }}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={visibleData}
          margin={{ top: 8, right: 16, left: 8, bottom: 0 }}
        >
          {/* SVG gradient definitions for main chart bars and area */}
          <defs>
            <linearGradient id={GRADIENT_ID_BAR} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255, 255, 255, 1)" />
              <stop offset="100%" stopColor={c.primary} />
            </linearGradient>
            <linearGradient id={GRADIENT_ID_AREA} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.primary} stopOpacity={0.3} />
              <stop offset="100%" stopColor={c.primary} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke={c.bc06}
            vertical={false}
          />

          <XAxis
            dataKey="time"
            type="number"
            domain={["dataMin", "dataMax"]}
            tickFormatter={formatAxisDate}
            tick={{ fill: c.bc35, fontSize: 10 }}
            stroke={c.bc10}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            scale="time"
          />

          {/* Left Y-axis: Cumulative total */}
          <YAxis
            yAxisId="cumulative"
            orientation="left"
            tick={{ fill: c.bc40, fontSize: 10 }}
            stroke={c.bc10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, Math.ceil(visibleMaxCumulative * 1.1) || 1]}
            width={40}
            label={{
              value: "Total",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: {
                fill: c.bc30,
                fontSize: 10,
              },
            }}
          />

          {/* Right Y-axis: Per-day count */}
          <YAxis
            yAxisId="per-session"
            orientation="right"
            tick={{ fill: c.bc20, fontSize: 10 }}
            stroke={c.bc05}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
            domain={[0, Math.ceil(visibleMaxPerSession * 1.2) || 1]}
            width={40}
            label={{
              value: "Per Day",
              angle: 90,
              position: "insideRight",
              offset: 10,
              style: {
                fill: c.bc20,
                fontSize: 10,
              },
            }}
          />

          <Tooltip
            content={DropTimelineTooltip}
            cursor={{
              stroke: c.bc15,
              strokeDasharray: "3 3",
            }}
          />

          {/* League start/end reference lines */}
          {visibleMarkers.map((marker, i) => (
            <ReferenceLine
              key={`marker-${marker.label}-${i}`}
              yAxisId="cumulative"
              x={marker.time}
              stroke={marker.type === "start" ? c.bc20 : c.bc15}
              strokeDasharray="4 4"
              strokeWidth={1}
              label={{
                value: marker.label,
                position: "insideTopRight",
                fill: c.bc30,
                fontSize: 9,
                offset: 4,
              }}
            />
          ))}

          {/* Per-day bars (behind the cumulative line) */}
          <Bar
            yAxisId="per-session"
            dataKey="count"
            fill={c.b2}
            shape={<MainBarShape />}
            isAnimationActive={false}
          />

          {/* Cumulative area + line */}
          <Area
            yAxisId="cumulative"
            type="monotone"
            dataKey="cumulativeCount"
            stroke={c.primary}
            fill={`url(#${GRADIENT_ID_AREA})`}
            strokeWidth={2}
            dot={(props: DotItemDotProps) => {
              const pt = props.payload as ChartDataPoint | undefined;
              if (pt?.isBoundary || pt?.isGap) return <circle r={0} />;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={2.5}
                  fill={c.primary}
                  stroke={c.b2}
                  strokeWidth={1}
                />
              );
            }}
            activeDot={(props: ActiveDotProps) => {
              const pt = (
                props as ActiveDotProps & { payload?: ChartDataPoint }
              ).payload;
              if (pt?.isBoundary || pt?.isGap) return <circle r={0} />;
              return (
                <circle
                  cx={props.cx}
                  cy={props.cy}
                  r={4}
                  fill={c.primary}
                  stroke={c.b2}
                  strokeWidth={2}
                />
              );
            }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default MainChart;
