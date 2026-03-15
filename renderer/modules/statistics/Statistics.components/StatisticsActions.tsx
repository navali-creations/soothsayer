import { useEffect } from "react";
import { FiDownload } from "react-icons/fi";

import { Dropdown, Flex } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import { formatRelativeTime } from "~/renderer/utils";

interface StatisticsActionsProps {
  availableLeagues: string[];
  currentScope: string;
}

export const StatisticsActions = ({
  availableLeagues,
  currentScope,
}: StatisticsActionsProps) => {
  const {
    statistics: {
      selectedLeague,
      setStatScope,
      setSelectedLeague,
      snapshotMeta,
      isExporting,
      fetchSnapshotMeta,
      exportAll,
      exportIncremental,
    },
  } = useBoundStore();

  useEffect(() => {
    fetchSnapshotMeta(currentScope);
  }, [currentScope, fetchSnapshotMeta]);

  const handleScopeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;

    if (value === "all-time") {
      setStatScope("all-time");
      setSelectedLeague("");
    } else {
      setStatScope("league");
      setSelectedLeague(value);
    }
  };

  const handleExportAll = async () => {
    const result = await exportAll(currentScope);
    if (result.success) {
      trackEvent("csv-export", {
        type: "all",
        scope: currentScope,
        source: "statistics",
      });
    } else if (!result.canceled) {
      alert(result.error ?? "Failed to export CSV. Please try again.");
    }
  };

  const handleExportIncremental = async () => {
    const result = await exportIncremental(currentScope);
    if (result.success) {
      trackEvent("csv-export", {
        type: "incremental",
        scope: currentScope,
        newDrops: newTotalDrops,
        source: "statistics",
      });
    } else if (!result.canceled) {
      alert(result.error ?? "Failed to export CSV. Please try again.");
    }
  };

  const selectValue = selectedLeague || "all-time";

  const hasSnapshot = snapshotMeta?.exists ?? false;
  const newTotalDrops = snapshotMeta?.newTotalDrops ?? 0;
  const hasNewCards = hasSnapshot && newTotalDrops > 0;

  const incrementalSublabel = (() => {
    if (newTotalDrops === 0) return "Nothing new since last export";
    const dropWord = newTotalDrops === 1 ? "card" : "cards";
    return `You've found ${newTotalDrops} ${dropWord} since last export`;
  })();

  return (
    <Flex className="gap-2 items-center">
      <select
        className="select select-sm"
        value={selectValue}
        onChange={handleScopeChange}
      >
        <option value="all-time">All-Time</option>
        {availableLeagues.map((league) => (
          <option key={league} value={league}>
            {league}
          </option>
        ))}
      </select>

      <Dropdown
        trigger={
          <>
            Export CSV
            {isExporting ? (
              <span className="loading loading-spinner loading-xs" />
            ) : (
              <FiDownload size={14} />
            )}
          </>
        }
        className="btn btn-primary btn-sm"
        position="dropdown-end"
        width="w-max"
        padding="p-0"
        contentClassName="mt-1"
      >
        <ul className="menu menu-md gap-0.5">
          <li>
            <button
              type="button"
              onClick={handleExportAll}
              disabled={isExporting}
              className="flex flex-col items-end gap-0"
            >
              <span className="font-medium">Export All Cards</span>
              <span className="text-xs text-base-content/40 leading-tight whitespace-nowrap">
                {currentScope === "all-time"
                  ? "Everything you've found"
                  : `Everything in ${currentScope}`}
              </span>
            </button>
          </li>

          {hasSnapshot && (
            <li>
              <button
                type="button"
                onClick={handleExportIncremental}
                disabled={isExporting || !hasNewCards}
                className="flex flex-col items-end gap-0"
              >
                <span className="flex items-center gap-2 justify-end">
                  {hasNewCards && (
                    <span className="badge badge-soft badge-info badge-sm">
                      +{newTotalDrops}
                    </span>
                  )}
                  <span className="font-medium">Export Latest Cards</span>
                </span>
                <span className="text-xs text-base-content/40 leading-tight whitespace-nowrap">
                  {incrementalSublabel}
                </span>
              </button>
            </li>
          )}
        </ul>

        {hasSnapshot && snapshotMeta?.exportedAt && (
          <div className="px-2 py-1 mb-1 text-xs text-base-content/40 border-t border-base-300 mt-1 flex items-center justify-end">
            <span>
              Last exported {formatRelativeTime(snapshotMeta.exportedAt)}
            </span>
          </div>
        )}
      </Dropdown>
    </Flex>
  );
};
