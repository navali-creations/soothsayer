import { type ReactNode, useCallback, useState } from "react";
import { FiActivity, FiArchive, FiDatabase, FiFile } from "react-icons/fi";

import type { StorageInfo } from "~/main/modules/storage/Storage.types";

import { formatBytes } from "../storage.utils/storage.utils";
import { DiskUsageBar } from "./DiskUsageBar/DiskUsageBar";

const CATEGORY_ICON_MAP: Record<string, ReactNode> = {
  database: <FiDatabase className="w-3.5 h-3.5" />,
  cache: <FiArchive className="w-3.5 h-3.5" />,
  other: <FiFile className="w-3.5 h-3.5" />,
};

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

      {/* Breakdown */}
      {(info.breakdown.length > 0 ||
        info.diagnosticsCaptureUsage.captureCount > 0) && (
        <div
          className="rounded-lg bg-base-100 p-3"
          data-testid="storage-breakdown"
        >
          <div className="mb-2 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <FiDatabase className="w-3.5 h-3.5 shrink-0 text-base-content/50" />
              <span className="truncate text-xs font-semibold text-base-content/70">
                What's using space?
              </span>
            </div>
            <span
              className="shrink-0 text-xs tabular-nums text-base-content/50"
              data-testid="storage-breakdown-total"
            >
              {formatBytes(info.appDataSizeBytes)}
            </span>
          </div>

          <div className="space-y-1" data-testid="storage-breakdown-content">
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

            {info.diagnosticsCaptureUsage.captureCount > 0 && (
              <div className="flex items-center gap-3 py-1.5">
                <FiActivity className="w-3.5 h-3.5 text-base-content/50 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium truncate">
                      Performance history
                    </span>
                    <span className="text-xs tabular-nums text-base-content/50 shrink-0">
                      {formatBytes(
                        info.diagnosticsCaptureUsage.estimatedSizeBytes,
                      )}
                    </span>
                  </div>
                  <div className="w-full bg-base-300 rounded-full h-1 overflow-hidden mt-1">
                    <div
                      className="bg-primary/60 h-1 rounded-full transition-all duration-300"
                      style={{
                        width: `${Math.max(
                          Math.min(
                            info.appDataSizeBytes > 0
                              ? (info.diagnosticsCaptureUsage
                                  .estimatedSizeBytes /
                                  info.appDataSizeBytes) *
                                  100
                              : 0,
                            100,
                          ),
                          0.5,
                        )}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DiskUsageSection;
