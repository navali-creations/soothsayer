import { memo } from "react";

import { ProfitSparkline } from "~/renderer/components/ProfitSparkline";
import type { LinePoint } from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline/types/types";

interface StaticProfitSparklineProps {
  /** The line points to render. */
  linePoints: LinePoint[];
  /** Explicit height in pixels. When omitted the component fills its parent via CSS. */
  height?: number;
  className?: string;
  /** Line stroke color. Defaults to cyan. */
  lineColor?: string;
}

/**
 * Static sparkline for completed sessions.
 *
 * Thin wrapper around the unified ProfitSparkline for backward compatibility.
 */
const StaticProfitSparkline = memo(
  ({
    linePoints,
    height,
    className,
    lineColor,
  }: StaticProfitSparklineProps) => (
    <ProfitSparkline
      linePoints={linePoints}
      height={height}
      className={className}
      lineColor={lineColor}
      testId="static-profit-sparkline"
    />
  ),
);

StaticProfitSparkline.displayName = "StaticProfitSparkline";

export { StaticProfitSparkline };
export default StaticProfitSparkline;
