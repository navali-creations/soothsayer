import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useEffect, useMemo, useState } from "react";
import { FiTrash2 } from "react-icons/fi";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import { Table } from "~/renderer/components";

import { formatBytes } from "./storage.utils";

// ============================================================================
// League table column definitions
// ============================================================================

const leagueColumnHelper = createColumnHelper<LeagueStorageUsage>();

const createLeagueColumns = (
  deletingLeagueId: string | null,
  onDelete: (league: LeagueStorageUsage) => void,
): ColumnDef<LeagueStorageUsage, any>[] => [
  leagueColumnHelper.accessor("leagueName", {
    header: "League",
    enableSorting: true,
    meta: { alignStart: true },
    cell: (info) => {
      const league = info.row.original;
      return (
        <div className="flex items-center gap-2">
          <span className="text-sm">{info.getValue()}</span>
          {league.hasActiveSession && (
            <span className="badge badge-success badge-xs">Active</span>
          )}
        </div>
      );
    },
  }),
  leagueColumnHelper.accessor("sessionCount", {
    header: "Sessions",
    enableSorting: true,
    cell: (info) => (
      <span className="text-sm tabular-nums">{info.getValue()}</span>
    ),
  }),
  leagueColumnHelper.accessor("snapshotCount", {
    header: "Snapshots",
    enableSorting: true,
    cell: (info) => (
      <span className="text-sm tabular-nums">{info.getValue()}</span>
    ),
  }),
  leagueColumnHelper.display({
    id: "size",
    header: "Size",
    enableSorting: false,
    cell: (info) => (
      <span className="text-xs text-base-content/60 tabular-nums">
        ~{formatBytes(info.row.original.estimatedSizeBytes)}
      </span>
    ),
  }),
  leagueColumnHelper.display({
    id: "actions",
    header: "",
    enableSorting: false,
    cell: (info) => {
      const league = info.row.original;
      const isDeleting = deletingLeagueId === league.leagueId;
      const anyDeleting = deletingLeagueId != null;

      return (
        <button
          type="button"
          className="btn btn-ghost btn-xs btn-square text-error disabled:text-error/30"
          disabled={league.hasActiveSession || anyDeleting}
          onClick={() => onDelete(league)}
          title={
            league.hasActiveSession
              ? "Cannot delete while session is active"
              : `Delete all data for ${league.leagueName}`
          }
        >
          {isDeleting ? (
            <span className="loading loading-spinner loading-xs" />
          ) : (
            <FiTrash2 className="w-3.5 h-3.5" />
          )}
        </button>
      );
    },
  }),
];

// ============================================================================
// Main section
// ============================================================================

type GameTab = "poe1" | "poe2";

interface LeagueDataSectionProps {
  leagueUsage: LeagueStorageUsage[];
  isLoading: boolean;
  deletingLeagueId: string | null;
  onDeleteRequest: (league: LeagueStorageUsage) => void;
}

const LeagueDataSection = ({
  leagueUsage,
  isLoading,
  deletingLeagueId,
  onDeleteRequest,
}: LeagueDataSectionProps) => {
  const [activeTab, setActiveTab] = useState<GameTab>("poe1");

  const poe1Leagues = useMemo(
    () => leagueUsage.filter((l) => l.game === "poe1"),
    [leagueUsage],
  );
  const poe2Leagues = useMemo(
    () => leagueUsage.filter((l) => l.game === "poe2"),
    [leagueUsage],
  );

  const hasPoe1 = poe1Leagues.length > 0;
  const hasPoe2 = poe2Leagues.length > 0;
  const activeLeagues = activeTab === "poe1" ? poe1Leagues : poe2Leagues;

  // Auto-select tab with data
  useEffect(() => {
    if (!hasPoe1 && hasPoe2) {
      setActiveTab("poe2");
    }
  }, [hasPoe1, hasPoe2]);

  const leagueColumns = useMemo(
    () => createLeagueColumns(deletingLeagueId, onDeleteRequest),
    [deletingLeagueId, onDeleteRequest],
  );

  return (
    <div className="space-y-2">
      <span className="text-sm font-semibold">League Data</span>

      {leagueUsage.length === 0 && !isLoading && (
        <p className="text-sm text-base-content/50 py-3">
          No league data to clean up
        </p>
      )}

      {leagueUsage.length > 0 && (
        <div className="space-y-2">
          {/* Tabs — only show if both games have data */}
          {hasPoe1 && hasPoe2 && (
            <div
              role="tablist"
              className="tabs tabs-boxed tabs-sm bg-base-200 w-fit"
            >
              <button
                type="button"
                role="tab"
                className={`tab ${activeTab === "poe1" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("poe1")}
              >
                PoE1
                <span className="badge badge-ghost badge-xs ml-1.5">
                  {poe1Leagues.length}
                </span>
              </button>
              <button
                type="button"
                role="tab"
                className={`tab ${activeTab === "poe2" ? "tab-active" : ""}`}
                onClick={() => setActiveTab("poe2")}
              >
                PoE2
                <span className="badge badge-ghost badge-xs ml-1.5">
                  {poe2Leagues.length}
                </span>
              </button>
            </div>
          )}

          {/* Single-game heading when only one game has data */}
          {hasPoe1 !== hasPoe2 && (
            <p className="text-xs text-base-content/50">
              {hasPoe1 ? "Path of Exile 1" : "Path of Exile 2"}
            </p>
          )}

          {/* League table */}
          <Table
            data={activeLeagues}
            columns={leagueColumns}
            compact
            enableSorting
          />
        </div>
      )}
    </div>
  );
};

export default LeagueDataSection;
