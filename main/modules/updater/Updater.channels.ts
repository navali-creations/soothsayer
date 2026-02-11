enum UpdaterChannel {
  CheckForUpdates = "updater:check-for-updates",
  GetUpdateInfo = "updater:get-update-info",
  DownloadUpdate = "updater:download-update",
  InstallUpdate = "updater:install-update",
  OnUpdateAvailable = "updater:on-update-available",
  OnDownloadProgress = "updater:on-download-progress",
}

export { UpdaterChannel };
