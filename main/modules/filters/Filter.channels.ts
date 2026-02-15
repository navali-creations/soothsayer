enum FilterChannel {
  // Filter scanning
  ScanFilters = "filters:scan",
  GetFilters = "filters:get-all",
  GetFilter = "filters:get",

  // Filter parsing
  ParseFilter = "filters:parse",

  // Filter selection
  SelectFilter = "filters:select",
  GetSelectedFilter = "filters:get-selected",

  // Rarity source
  GetRaritySource = "filters:get-rarity-source",
  SetRaritySource = "filters:set-rarity-source",

  // Filter card rarity editing
  UpdateFilterCardRarity = "filters:update-card-rarity",

  // Rarity application
  ApplyFilterRarities = "filters:apply-rarities",
  OnFilterRaritiesApplied = "filters:on-rarities-applied",
}

export { FilterChannel };
