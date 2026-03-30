import { useEffect, useMemo } from "react";
import { FiDownload } from "react-icons/fi";

import {
  createCardCountColumn,
  createCardNameColumn,
  createCardRatioColumn,
  Dropdown,
  Table,
} from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import { formatRelativeTime } from "~/renderer/utils";

import type { CardEntry } from "../../Statistics.types";

interface StatisticsTableProps {
  cardData: CardEntry[];
  isDataLoading?: boolean;
  currentScope: string;
}

export const StatisticsTable = ({
  cardData,
  isDataLoading = false,
  currentScope,
}: StatisticsTableProps) => {
  const {
    statistics: {
      statScope,
      searchQuery,
      showUncollectedCards,
      toggleShowUncollectedCards,
      uncollectedCardNames,
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

  // When "Show Uncollected" is enabled, compute uncollected cards from
  // the full stacked-deck-eligible card list minus what the user has found.
  const displayData = useMemo(() => {
    if (!showUncollectedCards || uncollectedCardNames.length === 0) {
      return cardData;
    }

    const uncollected: CardEntry[] = uncollectedCardNames.map((name) => ({
      name,
      count: 0,
      ratio: 0,
    }));

    return uncollected;
  }, [cardData, showUncollectedCards, uncollectedCardNames]);

  const totalCount = useMemo(
    () => cardData.reduce((sum, card) => sum + card.count, 0),
    [cardData],
  );

  const columns = useMemo(
    () => [
      createCardNameColumn(),
      createCardCountColumn(),
      createCardRatioColumn(totalCount),
    ],
    [totalCount],
  );

  const hasSnapshot = snapshotMeta?.exists ?? false;
  const newTotalDrops = snapshotMeta?.newTotalDrops ?? 0;
  const hasNewCards = hasSnapshot && newTotalDrops > 0;

  const incrementalSublabel = (() => {
    if (newTotalDrops === 0) return "Nothing new since last export";
    const dropWord = newTotalDrops === 1 ? "card" : "cards";
    return `You've found ${newTotalDrops} ${dropWord} since last export`;
  })();

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

  return (
    <div className="card bg-base-200 shadow-xl flex-1 min-h-0 relative">
      <div
        className={`absolute inset-0 bg-base-200/60 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-lg pointer-events-none transition-opacity duration-200 ${
          isDataLoading ? "opacity-100" : "opacity-0"
        }`}
      >
        <span className="loading loading-spinner loading-sm text-primary" />
      </div>
      <div className="card-body p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between shrink-0">
          <h2 className="card-title text-sm">Card Collection</h2>

          <div className="flex items-center gap-3">
            {statScope === "league" && (
              <label
                className="flex items-center gap-1.5 cursor-pointer"
                data-testid="show-uncollected-toggle"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-xs checkbox-primary"
                  checked={showUncollectedCards}
                  onChange={toggleShowUncollectedCards}
                  data-testid="show-uncollected-checkbox"
                />
                <span className="text-[11px] text-base-content/60">
                  Show Uncollected
                </span>
              </label>
            )}

            <Dropdown
              trigger={
                <>
                  Export CSV
                  {isExporting ? (
                    <span className="loading loading-spinner loading-xs" />
                  ) : (
                    <FiDownload size={12} />
                  )}
                </>
              }
              className="btn btn-primary btn-xs text-[11px]"
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
          </div>
        </div>

        {displayData.length === 0 && !isDataLoading ? (
          <div className="text-center py-12 text-base-content/50">
            <p className="text-lg">
              {showUncollectedCards
                ? "You've collected every card!"
                : "No cards collected yet"}
            </p>
            <p className="text-sm">
              {showUncollectedCards
                ? "All stacked deck cards have been found at least once."
                : "Start a session and open divination cards in Path of Exile!"}
            </p>
          </div>
        ) : (
          <div className="flex-1 min-h-0">
            <Table
              data={displayData}
              columns={columns}
              enableSorting={true}
              enablePagination={true}
              pageSize={20}
              hoverable={true}
              globalFilter={searchQuery}
              emptyMessage="No cards match your search"
              stickyHeader={true}
            />
          </div>
        )}
      </div>
    </div>
  );
};
