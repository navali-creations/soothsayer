import { CiWavePulse1 } from "react-icons/ci";

export type LegendVisual =
  | "area"
  | "scatter"
  | "bar"
  | "line"
  | "dashed-line"
  | "zigzag-gap";

export function LegendIcon({
  visual,
  color,
}: {
  visual: LegendVisual;
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

  if (visual === "line") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="shrink-0">
        <path
          d="M1 9 L4 6 L7 7 L11 3"
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  if (visual === "bar") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="shrink-0">
        <rect x="1" y="6" width="2.5" height="5" rx="0.8" fill={color} />
        <rect x="4.75" y="4" width="2.5" height="7" rx="0.8" fill={color} />
        <rect x="8.5" y="2" width="2.5" height="9" rx="0.8" fill={color} />
      </svg>
    );
  }

  if (visual === "dashed-line") {
    return (
      <svg width={size} height={size} viewBox="0 0 12 12" className="shrink-0">
        <line
          x1="1"
          y1="6"
          x2="11"
          y2="6"
          stroke={color}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray="2.5 2"
        />
      </svg>
    );
  }

  if (visual === "zigzag-gap") {
    const gapIconSize = 18;
    return (
      <span
        data-testid="legend-zigzag-gap-icon"
        className="inline-flex shrink-0 items-center justify-center leading-none"
        style={{
          width: gapIconSize,
          height: gapIconSize,
          color,
          transform: "rotate(90deg)",
        }}
      >
        <CiWavePulse1 size={gapIconSize} />
      </span>
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
