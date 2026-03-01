import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle, FiHardDrive } from "react-icons/fi";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import DeleteLeagueModal from "./storage/DeleteLeagueModal";
import DiskUsageSection from "./storage/DiskUsageSection";
import LeagueDataSection from "./storage/LeagueDataSection";

const StorageSettingsCard = () => {
  const {
    storage: {
      info,
      leagueUsage,
      isLoading,
      error,
      deletingLeagueId,
      fetchStorageInfo,
      fetchLeagueUsage,
      deleteLeagueData,
    },
  } = useBoundStore();

  const [leagueToDelete, setLeagueToDelete] =
    useState<LeagueStorageUsage | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchStorageInfo();
    fetchLeagueUsage();
  }, [fetchStorageInfo, fetchLeagueUsage]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchStorageInfo(), fetchLeagueUsage()]);
  }, [fetchStorageInfo, fetchLeagueUsage]);

  const handleDeleteRequest = useCallback((league: LeagueStorageUsage) => {
    setLeagueToDelete(league);
  }, []);

  const handleDeleteConfirm = useCallback(
    async (leagueId: string) => {
      setLeagueToDelete(null);
      await deleteLeagueData(leagueId);
    },
    [deleteLeagueData],
  );

  const handleDeleteModalClose = useCallback(() => {
    setLeagueToDelete(null);
  }, []);

  return (
    <>
      <div className="card bg-base-100 shadow-xl">
        <div className="card-body">
          <div className="flex items-center gap-2">
            <FiHardDrive className="w-5 h-5" />
            <h2 className="card-title">Storage</h2>
          </div>
          <p className="text-sm text-base-content/60">
            Disk usage for application data and database
          </p>

          {/* Loading skeleton */}
          {isLoading && !info && (
            <div className="flex items-center justify-center py-8">
              <span className="loading loading-spinner loading-md" />
            </div>
          )}

          {/* Error state */}
          {error && (
            <div role="alert" className="alert alert-error mt-4 text-sm">
              <FiAlertTriangle className="w-4 h-4" />
              <span>{error}</span>
              <Button variant="ghost" size="sm" onClick={handleRefresh}>
                Retry
              </Button>
            </div>
          )}

          {/* Storage info */}
          {info && (
            <div className="space-y-4 mt-4">
              <DiskUsageSection info={info} />

              <div className="divider my-0" />

              <LeagueDataSection
                leagueUsage={leagueUsage}
                isLoading={isLoading}
                deletingLeagueId={deletingLeagueId}
                onDeleteRequest={handleDeleteRequest}
              />
            </div>
          )}
        </div>
      </div>

      <DeleteLeagueModal
        league={leagueToDelete}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteModalClose}
      />
    </>
  );
};

export default StorageSettingsCard;
