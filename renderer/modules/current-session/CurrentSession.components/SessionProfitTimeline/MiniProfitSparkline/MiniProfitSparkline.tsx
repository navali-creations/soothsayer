import { memo } from "react";

import { ProfitSparkline } from "~/renderer/components/ProfitSparkline";

import { timelineBuffer } from "../timeline-buffer/timeline-buffer";

interface MiniProfitSparklineProps {
  /** Explicit height in pixels. When omitted the component fills its parent via CSS. */
  height?: number;
  className?: string;
}

/**
 * Live sparkline for the active session.
 *
 * Thin wrapper around the unified ProfitSparkline, pre-wired to the
 * shared `timelineBuffer` singleton as a live data source.
 */
const MiniProfitSparkline = memo(
  ({ height, className }: MiniProfitSparklineProps) => (
    <ProfitSparkline
      dataSource={timelineBuffer}
      height={height}
      className={className}
    />
  ),
);

MiniProfitSparkline.displayName = "MiniProfitSparkline";

export { MiniProfitSparkline };
export default MiniProfitSparkline;
