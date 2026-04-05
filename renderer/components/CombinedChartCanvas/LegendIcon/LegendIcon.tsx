import type { MetricConfig } from "../chart-types/chart-types";

export function LegendIcon({
  visual,
  color,
}: {
  visual: MetricConfig["rawVisual"];
  color: string;
}) {
  const size = 12;

  if (visual === "area") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="shrink-0">
        <path
          d="M0 8 L3 5 L6 7 L9 3 L12 5 L12 12 L0 12 Z"
          fill={color}
          fillOpacity={0.25}
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg width={size} height={size} viewBox="0 0 12 12" className="shrink-0">
      <circle cx="2" cy="9" r="1.5" fill={color} fillOpacity={0.5} />
      <circle cx="6" cy="4" r="1.5" fill={color} fillOpacity={0.5} />
      <circle cx="10" cy="7" r="1.5" fill={color} fillOpacity={0.5} />
    </svg>
  );
}
