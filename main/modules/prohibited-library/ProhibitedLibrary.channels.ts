enum ProhibitedLibraryChannel {
  // Data lifecycle
  Reload = "prohibited-library:reload",
  GetStatus = "prohibited-library:get-status",
  GetCardWeights = "prohibited-library:get-card-weights",

  // Card flags
  GetFromBossCards = "prohibited-library:get-from-boss-cards",

  // Events (main → renderer)
  OnDataRefreshed = "prohibited-library:on-data-refreshed",
  OnLoadError = "prohibited-library:on-load-error",
}

export { ProhibitedLibraryChannel };
