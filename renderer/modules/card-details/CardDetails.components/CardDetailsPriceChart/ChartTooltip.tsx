import { formatDateFull } from "./helpers";
import type { CustomTooltipProps } from "./types";

/**
 * Custom Recharts tooltip for the price history chart.
 *
 * Displays the date, divine orb rate, and trade volume for the hovered
 * data point.
 */
const ChartTooltip = ({ active, payload }: CustomTooltipProps) => {
  if (!active || !payload || payload.length === 0) return null;

  const dataPoint = payload[0]?.payload;
  if (!dataPoint) return null;

  const date = new Date(dataPoint.time);
  const dateStr = formatDateFull(date.toISOString());

  return (
    <div className="bg-base-300 border border-base-content/10 rounded-lg px-3 py-2 shadow-lg text-sm">
      <p className="text-base-content/60 text-xs mb-1">{dateStr}</p>
      <div className="space-y-0.5">
        <p className="font-semibold tabular-nums">
          <span className="text-primary">●</span> {dataPoint.rate.toFixed(2)}{" "}
          div
        </p>
        <p className="text-base-content/60 tabular-nums">
          <span className="text-base-content/20">●</span> Vol:{" "}
          {dataPoint.volume.toLocaleString()}
        </p>
      </div>
    </div>
  );
};

export default ChartTooltip;
