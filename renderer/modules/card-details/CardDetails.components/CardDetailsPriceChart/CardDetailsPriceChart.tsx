import { useMemo } from "react";
import { FiClock } from "react-icons/fi";
import {
  Area,
  Bar,
  Brush,
  CartesianGrid,
  ComposedChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartColors } from "~/renderer/hooks";
import { useCardDetails } from "~/renderer/store";

import ChartTooltip from "./ChartTooltip";
import { BRUSH_HEIGHT, CHART_HEIGHT } from "./constants";
import {
  formatAxisDate,
  formatRate,
  formatVolume,
  mapHistoryToChartData,
} from "./helpers";
import PriceChartEmpty from "./PriceChartEmpty";
import PriceChartError from "./PriceChartError";
import type { ChartDataPoint } from "./types";

// ─── Main Component ────────────────────────────────────────────────────────

/**
 * Price history chart for the card details page.
 *
 * Renders a ComposedChart with:
 * - Area/Line: Divine Orb rate over time (primary Y-axis, left)
 * - Bar chart: Volume as bars (secondary Y-axis, right)
 * - Brush: Recharts <Brush> at bottom for pan/zoom
 * - Tooltip: Date, divine rate, volume
 * - ResponsiveContainer: fills parent width
 *
 * All SVG fill/stroke colors are resolved from CSS custom properties via
 * the `useChartColors` hook, since SVG attributes cannot process
 * `oklch(var(...))` functions directly.
 *
 * Brush theming is additionally handled via CSS overrides in components.css.
 *
 * States: loading skeleton, error message, empty state, stale cache indicator.
 */
const CardDetailsPriceChart = () => {
  const c = useChartColors();

  const { priceHistory, isLoadingPriceHistory, priceHistoryError } =
    useCardDetails();

  // Map history data for Recharts
  const chartData = useMemo<ChartDataPoint[]>(() => {
    if (!priceHistory?.priceHistory?.length) return [];
    return mapHistoryToChartData(priceHistory.priceHistory);
  }, [priceHistory]);

  // Calculate domain for Y axes
  const { rateDomain, volumeDomain } = useMemo(() => {
    if (chartData.length === 0) {
      return {
        rateDomain: [0, 1] as [number, number],
        volumeDomain: [0, 1] as [number, number],
      };
    }

    const rates = chartData.map((d) => d.rate);
    const volumes = chartData.map((d) => d.volume);

    const minRate = Math.min(...rates);
    const maxRate = Math.max(...rates);
    const maxVolume = Math.max(...volumes);

    // Add 10% padding to the rate domain
    const ratePadding = (maxRate - minRate) * 0.1 || maxRate * 0.1 || 1;

    return {
      rateDomain: [
        Math.max(0, minRate - ratePadding),
        maxRate + ratePadding,
      ] as [number, number],
      volumeDomain: [0, maxVolume * 1.2 || 1] as [number, number],
    };
  }, [chartData]);

  // Loading state
  if (isLoadingPriceHistory) {
    return (
      <div className="bg-base-200 rounded-lg p-4 space-y-3">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Price History
        </h3>
        <div
          className="flex items-center justify-center bg-base-300/50 rounded-lg animate-pulse"
          style={{ height: CHART_HEIGHT }}
        >
          <div className="flex items-center gap-2 text-base-content/30">
            <span className="loading loading-spinner loading-md" />
            <span className="text-sm">Loading chart data…</span>
          </div>
        </div>
      </div>
    );
  }

  if (priceHistoryError) return <PriceChartError />;
  if (!priceHistory || chartData.length === 0) return <PriceChartEmpty />;

  // Derive data window from the history itself
  const firstDate = chartData[0]?.dateLabel ?? "";
  const lastDate = chartData[chartData.length - 1]?.dateLabel ?? "";
  const dataPointCount = chartData.length;

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase text-base-content/50">
          Price History
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-base-content/30">
            {firstDate} – {lastDate} · {dataPointCount} data points
          </span>
          {priceHistory.isFromCache && priceHistory.fetchedAt && (
            <span className="badge badge-xs badge-ghost gap-1 text-base-content/40">
              <FiClock className="w-2.5 h-2.5" />
              Cached
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
        <ComposedChart
          data={chartData}
          margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id="rateGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={c.primary} stopOpacity={0.3} />
              <stop offset="95%" stopColor={c.primary} stopOpacity={0.02} />
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
            tick={{ fontSize: 10, fill: c.bc35 }}
            stroke={c.bc10}
            tickLine={false}
            axisLine={false}
            minTickGap={40}
            scale="time"
          />

          {/* Left Y-axis: Rate (divine orbs) */}
          <YAxis
            yAxisId="rate"
            orientation="left"
            domain={rateDomain}
            tickFormatter={formatRate}
            tick={{ fontSize: 10, fill: c.bc35 }}
            stroke={c.bc10}
            tickLine={false}
            axisLine={false}
            width={50}
          />

          {/* Right Y-axis: Volume */}
          <YAxis
            yAxisId="volume"
            orientation="right"
            domain={volumeDomain}
            tickFormatter={formatVolume}
            tick={{ fontSize: 10, fill: c.bc15 }}
            stroke={c.bc05}
            tickLine={false}
            axisLine={false}
            width={50}
          />

          <Tooltip
            content={<ChartTooltip />}
            cursor={{
              stroke: c.bc15,
              strokeDasharray: "3 3",
            }}
          />

          {/* Volume bars (behind the rate line) */}
          <Bar
            yAxisId="volume"
            dataKey="volume"
            fill="rgba(255, 255, 255, 1)"
            radius={[2, 2, 0, 0]}
            isAnimationActive={false}
          />

          {/* Rate area + line */}
          <Area
            yAxisId="rate"
            type="monotone"
            dataKey="rate"
            stroke={c.primary}
            strokeWidth={2}
            fill="url(#rateGradient)"
            dot={false}
            activeDot={{
              r: 4,
              stroke: c.primary,
              strokeWidth: 2,
              fill: c.b1,
            }}
            isAnimationActive={false}
          />

          {/* Brush for pan/zoom — theming also handled via CSS in components.css */}
          {chartData.length > 14 && (
            <Brush
              dataKey="time"
              height={BRUSH_HEIGHT}
              stroke={c.bc15}
              fill={c.b2}
              travellerWidth={8}
              tickFormatter={formatAxisDate}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
};

export default CardDetailsPriceChart;
