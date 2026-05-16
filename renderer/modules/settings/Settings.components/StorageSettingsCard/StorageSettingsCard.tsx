import { useCallback, useEffect, useState } from "react";
import { FiAlertTriangle } from "react-icons/fi";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useStorage } from "~/renderer/store";

import DeleteLeagueModal from "../storage/DeleteLeagueModal/DeleteLeagueModal";
import DiskUsageSection from "../storage/DiskUsageSection/DiskUsageSection";
import LeagueDataSection from "../storage/LeagueDataSection/LeagueDataSection";

const StorageSettingsCard = () => {
  const {
    info,
    leagueUsage,
    isLoading,
    error,
    deletingLeagueId,
    fetchStorageInfo,
    fetchLeagueUsage,
    deleteLeagueData,
  } = useStorage();

  const [leagueToDelete, setLeagueToDelete] =
    useState<LeagueStorageUsage | null>(null);

  // Fetch data on mount
  useEffect(() => {
    fetchStorageInfo();
    fetchLeagueUsage();
  }, [fetchStorageInfo, fetchLeagueUsage]);

  const handleRefresh = useCallback(async () => {
    await Promise.all([fetchStorageInfo(), fetchLeagueUsage()]);
    trackEvent("settings-storage", { action: "refresh" });
  }, [fetchStorageInfo, fetchLeagueUsage]);

  const handleDeleteRequest = useCallback((league: LeagueStorageUsage) => {
    setLeagueToDelete(league);
  }, []);

  const handleDeleteConfirm = useCallback(
    async (leagueId: string) => {
      setLeagueToDelete(null);
      trackEvent("settings-storage", { action: "delete-league", leagueId });
      await deleteLeagueData(leagueId);
    },
    [deleteLeagueData],
  );

  const handleDeleteModalClose = useCallback(() => {
    setLeagueToDelete(null);
  }, []);

  return (
    <>
      <section className="space-y-3">
        <p className="sr-only">Disk usage for application data and database</p>

        {/* Loading state */}
        {isLoading && !info && (
          <div className="flex items-center gap-3 mt-4 text-base-content/60">
            <span className="loading loading-spinner loading-sm" />
            <span className="text-sm">Analyzing storage…</span>
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
          <div className="grid gap-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
            <DiskUsageSection info={info} />

            <LeagueDataSection
              leagueUsage={leagueUsage}
              isLoading={isLoading}
              deletingLeagueId={deletingLeagueId}
              onDeleteRequest={handleDeleteRequest}
            />
          </div>
        )}
      </section>

      <DeleteLeagueModal
        league={leagueToDelete}
        onConfirm={handleDeleteConfirm}
        onClose={handleDeleteModalClose}
      />
    </>
  );
};

export default StorageSettingsCard;
