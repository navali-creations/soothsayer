enum SnapshotChannel {
  GetLatestSnapshot = "snapshot:get-latest-snapshot",
  GetSnapshotInfo = "snapshot:get-snapshot-info",
  GetRefreshStatus = "snapshot:get-refresh-status",
  RefreshPrices = "snapshot:refresh-prices",
  OnSnapshotCreated = "snapshot:on-snapshot-created",
  OnSnapshotReused = "snapshot:on-snapshot-reused",
  OnAutoRefreshStarted = "snapshot:on-auto-refresh-started",
  OnAutoRefreshStopped = "snapshot:on-auto-refresh-stopped",
}

export { SnapshotChannel };
