import { useCallback, useState } from "react";
import { FiArchive, FiDatabase, FiEye, FiEyeOff, FiFile } from "react-icons/fi";

import type { StorageInfo } from "~/main/modules/storage/Storage.types";
import { Accordion } from "~/renderer/components";

import { formatBytes, formatPercentage } from "./storage.utils";

// ============================================================================
// Breakdown icon mapping
// ============================================================================

const CATEGORY_ICON_MAP: Record<string, React.ReactNode> = {
  database: <FiDatabase className="w-3.5 h-3.5" />,
  cache: <FiArchive className="w-3.5 h-3.5" />,
  other: <FiFile className="w-3.5 h-3.5" />,
};

// ============================================================================
// Stacked disk usage bar
// ============================================================================

interface BarSegment {
  label: string;
  bytes: number;
  colorClass: string;
}

const DiskUsageBar = ({
  segments,
  totalBytes,
  path,
  onRevealToggle,
  isRevealed,
}: {
  segments: BarSegment[];
  totalBytes: number;
  path?: string;
  onRevealToggle?: () => void;
  isRevealed?: boolean;
}) => {
  const usedBytes = segments.reduce((sum, s) => sum + s.bytes, 0);
  const fraction = totalBytes > 0 ? usedBytes / totalBytes : 0;
  const visibleSegments = segments.filter((s) => s.bytes > 0);

  return (
    <div className="space-y-1.5">
      {path && (
        <div className="flex items-center gap-1.5 group">
          <p className="text-xs font-mono text-base-content/60 truncate">
            {path}
          </p>
          {onRevealToggle && (
            <button
              type="button"
              onClick={onRevealToggle}
              className="text-base-content/40 hover:text-base-content/70 transition-colors shrink-0"
              title={isRevealed ? "Hide full path" : "Reveal full path"}
            >
              {isRevealed ? (
                <FiEyeOff className="w-3 h-3" />
              ) : (
                <FiEye className="w-3 h-3" />
              )}
            </button>
          )}
        </div>
      )}
      <div className="w-full bg-base-300 rounded-full h-2.5 overflow-hidden flex">
        {segments.map((seg) => {
          const pct = totalBytes > 0 ? (seg.bytes / totalBytes) * 100 : 0;
          if (pct < 0.01) return null;
          return (
            <div
              key={seg.label}
              className={`${seg.colorClass} h-2.5 transition-all duration-300 first:rounded-l-full last:rounded-r-full`}
              style={{ width: `${Math.max(pct, 0.3)}%` }}
              title={`${seg.label}: ${formatBytes(seg.bytes)}`}
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
      {/* Legend — labels in one row, size + percentage stacked below each */}
      {visibleSegments.length > 1 && (
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-0.5">
          {visibleSegments.map((seg) => {
            const segFraction = totalBytes > 0 ? seg.bytes / totalBytes : 0;
            return (
              <div key={seg.label} className="flex items-start gap-1.5">
                <div
                  className={`w-2 h-2 rounded-full ${seg.colorClass} mt-0.5 shrink-0`}
                />
                <div className="flex flex-col">
                  <span className="text-xs text-base-content/70 leading-tight">
                    {seg.label}
                  </span>
                  <span className="text-[10px] text-base-content/40 tabular-nums leading-tight">
                    {formatBytes(seg.bytes)} ({formatPercentage(segFraction)})
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main section
// ============================================================================

interface DiskUsageSectionProps {
  info: StorageInfo;
}

const DiskUsageSection = ({ info }: DiskUsageSectionProps) => {
  const [revealedPaths, setRevealedPaths] = useState<{
    appDataPath: string;
  } | null>(null);
  const [isRevealed, setIsRevealed] = useState(false);

  const handleRevealToggle = useCallback(async () => {
    if (isRevealed) {
      // Hide — just toggle the flag, keep cached paths for next reveal
      setIsRevealed(false);
      return;
    }

    // Reveal — fetch full paths if not cached yet
    if (!revealedPaths) {
      try {
        const paths = await window.electron.storage.revealPaths();
        setRevealedPaths(paths);
      } catch {
        // If reveal fails, stay masked
        return;
      }
    }
    setIsRevealed(true);
  }, [isRevealed, revealedPaths]);

  const displayPath =
    isRevealed && revealedPaths ? revealedPaths.appDataPath : info.appDataPath;

  const dbSizeBytes = info.dbSizeBytes;
  const otherAppDataBytes = info.appDataSizeBytes - info.dbSizeBytes;
  const otherDiskUsed = Math.max(
    0,
    info.diskTotalBytes - info.diskFreeBytes - info.appDataSizeBytes,
  );

  const isDifferentDrive =
    info.diskTotalBytes !== info.dbDiskTotalBytes ||
    info.diskFreeBytes !== info.dbDiskFreeBytes;

  return (
    <div className="space-y-4">
      {/* Stacked disk usage bar */}
      <div className="space-y-1.5">
        <span className="text-sm font-semibold">Disk Usage</span>
        <DiskUsageBar
          path={displayPath}
          onRevealToggle={handleRevealToggle}
          isRevealed={isRevealed}
          segments={[
            {
              label: "Other disk usage",
              bytes: otherDiskUsed,
              colorClass: "bg-base-content/20",
            },
            {
              label: "Soothsayer size",
              bytes: otherAppDataBytes,
              colorClass: "bg-secondary",
            },
            {
              label: "Database",
              bytes: dbSizeBytes,
              colorClass: "bg-warning",
            },
          ]}
          totalBytes={info.diskTotalBytes}
        />
      </div>

      {isDifferentDrive && (
        <div className="text-xs text-info flex items-center gap-1.5">
          <FiDatabase className="w-3 h-3" />
          Database is on a different drive than application data
        </div>
      )}

      {/* Breakdown accordion */}
      {info.breakdown.length > 0 && (
        <Accordion
          title="What's using space?"
          icon={<FiDatabase className="w-3.5 h-3.5" />}
          headerRight={formatBytes(info.appDataSizeBytes)}
        >
          <div>
            {info.breakdown.map((item) => {
              const itemFraction =
                info.appDataSizeBytes > 0
                  ? item.sizeBytes / info.appDataSizeBytes
                  : 0;
              const pct = Math.min(itemFraction * 100, 100);

              return (
                <div
                  key={item.category}
                  className="flex items-center gap-3 py-1.5"
                >
                  <span className="text-base-content/50 shrink-0">
                    {CATEGORY_ICON_MAP[item.category] ?? (
                      <FiFile className="w-3.5 h-3.5" />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate">
                        {item.label}
                      </span>
                      <span className="text-xs text-base-content/50 shrink-0 tabular-nums">
                        {formatBytes(item.sizeBytes)}
                      </span>
                    </div>
                    <div className="w-full bg-base-300 rounded-full h-1 overflow-hidden mt-1">
                      <div
                        className="bg-primary/60 h-1 rounded-full transition-all duration-300"
                        style={{
                          width: `${Math.max(pct, 0.5)}%`,
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </Accordion>
      )}
    </div>
  );
};

export default DiskUsageSection;
