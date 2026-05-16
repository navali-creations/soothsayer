import clsx from "clsx";
import { FiEye, FiEyeOff } from "react-icons/fi";

import {
  formatBytes,
  formatPercentage,
} from "../../storage.utils/storage.utils";

export interface BarSegment {
  label: string;
  bytes: number;
  colorClass: string;
}

interface DiskUsageBarProps {
  segments: BarSegment[];
  totalBytes: number;
  path?: string;
  onRevealToggle?: () => void;
  isRevealed?: boolean;
}

export function DiskUsageBar({
  segments,
  totalBytes,
  path,
  onRevealToggle,
  isRevealed,
}: DiskUsageBarProps) {
  const usedBytes = segments.reduce((sum, segment) => sum + segment.bytes, 0);
  const fraction = totalBytes > 0 ? usedBytes / totalBytes : 0;
  const visibleSegments = segments.filter((segment) => segment.bytes > 0);

  return (
    <div className="space-y-1.5">
      {path && (
        <div className="group flex items-center gap-1.5">
          <p className="truncate font-mono text-xs text-base-content/60">
            {path}
          </p>
          {onRevealToggle && (
            <button
              type="button"
              onClick={onRevealToggle}
              className="shrink-0 text-base-content/40 transition-colors hover:text-base-content/70"
              title={isRevealed ? "Hide full path" : "Reveal full path"}
            >
              {isRevealed ? (
                <FiEyeOff className="h-3 w-3" />
              ) : (
                <FiEye className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      )}
      <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-base-300">
        {segments.map((segment) => {
          const pct = totalBytes > 0 ? (segment.bytes / totalBytes) * 100 : 0;
          if (pct < 0.01) return null;
          return (
            <div
              key={segment.label}
              className={clsx(
                segment.colorClass,
                "h-2.5 transition-all duration-300 first:rounded-l-full last:rounded-r-full",
              )}
              style={{ width: `${Math.max(pct, 0.3)}%` }}
              title={`${segment.label}: ${formatBytes(segment.bytes)}`}
            />
          );
        })}
      </div>
      <div className="flex items-center justify-between text-xs text-base-content/70">
        <span>
          {formatBytes(usedBytes)} used of {formatBytes(totalBytes)} (
          {formatPercentage(fraction)})
        </span>
        <span>{formatBytes(totalBytes - usedBytes)} free</span>
      </div>
      {visibleSegments.length > 1 && (
        <div className="mt-0.5 flex flex-wrap gap-x-5 gap-y-2">
          {visibleSegments.map((segment) => {
            const segmentFraction =
              totalBytes > 0 ? segment.bytes / totalBytes : 0;
            return (
              <div key={segment.label} className="flex items-start gap-1.5">
                <div
                  className={clsx(
                    "mt-0.5 h-2 w-2 shrink-0 rounded-full",
                    segment.colorClass,
                  )}
                />
                <div className="flex flex-col">
                  <span className="text-xs leading-tight text-base-content/70">
                    {segment.label}
                  </span>
                  <span className="text-[10px] leading-tight text-base-content/40 tabular-nums">
                    {formatBytes(segment.bytes)} (
                    {formatPercentage(segmentFraction)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
