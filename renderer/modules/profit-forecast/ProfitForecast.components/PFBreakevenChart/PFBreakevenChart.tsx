import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { useChartColors } from "~/renderer/hooks";
import { useBoundStore } from "~/renderer/store";

import { formatDivine } from "../../ProfitForecast.utils/ProfitForecast.utils";

/** Custom tooltip for the breakeven chart. */
const PFBreakevenTooltip = ({
  active,
  payload,
  chaosToDivineRatio,
}: {
  active?: boolean;
  payload?: any[];
  chaosToDivineRatio: number;
}) => {
  if (!active || !payload?.length) return null;

  const data = payload[0]?.payload as
    | {
        deckCount: number;
        estimated: number;
        optimistic: number;
      }
    | undefined;
  if (!data) return null;

  return (
    <div className="bg-base-300 border border-base-content/10 rounded-lg p-2.5 shadow-lg text-xs space-y-1">
      <p className="font-medium text-base-content">
        {data.deckCount.toLocaleString("en-US")} decks
      </p>
      <p className="text-primary">
        Optimistic: {formatDivine(data.optimistic, chaosToDivineRatio)}
      </p>
      <p className="text-secondary">
        Estimated: {formatDivine(data.estimated, chaosToDivineRatio)}
      </p>
    </div>
  );
};

/**
 * Breakeven / P&L chart for the Profit Forecast page.
 *
 * Shows estimated and optimistic P&L curves with a break-even reference line.
 * The x-axis is capped at the user's selected batch size.
 *
 * All SVG fill/stroke colors are resolved from CSS custom properties via
 * the `useChartColors` hook, since SVG attributes cannot process
 * `oklch(var(...))` functions directly.
 */
const PFBreakevenChart = () => {
  const c = useChartColors();

  const {
    profitForecast: { chaosToDivineRatio, isLoading, hasData, getPnLCurve },
  } = useBoundStore();

  const dataAvailable = hasData() && !isLoading;
  const curveData = dataAvailable ? getPnLCurve() : [];

  if (!dataAvailable || curveData.length === 0) {
    return (
      <div
        className="flex items-center justify-center text-base-content/50 text-sm h-full"
        data-testid="pf-breakeven-empty"
      >
        No data available for breakeven chart.
      </div>
    );
  }

  return (
    <div className="w-full h-full" data-testid="pf-breakeven-chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={curveData}
          margin={{ top: 5, right: 20, bottom: 5, left: 20 }}
        >
          <defs>
            <linearGradient id="pfOptimisticFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.primary30} stopOpacity={1} />
              <stop offset="100%" stopColor={c.primary02} stopOpacity={1} />
            </linearGradient>
            <linearGradient id="pfEstimatedLine" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c.primary} stopOpacity={1} />
              <stop offset="100%" stopColor={c.primary30} stopOpacity={1} />
            </linearGradient>
          </defs>

          <CartesianGrid strokeDasharray="3 3" stroke={c.bc10} />

          <XAxis
            dataKey="deckCount"
            tickFormatter={(v: number) =>
              v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)
            }
            stroke={c.bc40}
            fontSize={11}
          />

          <YAxis
            tickFormatter={(v: number) => {
              if (chaosToDivineRatio <= 0) return `${v}c`;
              const d = v / chaosToDivineRatio;
              if (Math.abs(d) >= 1000) return `${(d / 1000).toFixed(0)}k d`;
              if (Math.abs(d) >= 100) return `${d.toFixed(0)} d`;
              return `${d.toFixed(1)} d`;
            }}
            stroke={c.bc40}
            fontSize={11}
            width={60}
          />

          {/* Optimistic area — filled confidence band above estimated */}
          <Area
            type="monotone"
            dataKey="optimistic"
            stroke={c.primary60}
            fill="url(#pfOptimisticFill)"
            strokeWidth={1}
            dot={false}
            activeDot={false}
            name="Optimistic"
          />

          {/* Estimated area — cuts out the lower portion so only the band between estimated and optimistic is filled */}
          <Area
            type="monotone"
            dataKey="estimated"
            stroke={c.primary}
            fill={c.b2}
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4, strokeWidth: 2 }}
            name="Estimated"
          />

          {/* Break-even reference line at y=0 */}
          <ReferenceLine
            y={0}
            stroke={c.bc30}
            strokeDasharray="4 4"
            label={{
              value: "Break-even",
              position: "insideTopRight",
              fill: c.bc50,
              fontSize: 10,
            }}
          />

          <Tooltip
            content={
              <PFBreakevenTooltip chaosToDivineRatio={chaosToDivineRatio} />
            }
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default PFBreakevenChart;
