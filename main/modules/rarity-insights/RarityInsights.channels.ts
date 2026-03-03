enum RarityInsightsChannel {
  // Rarity insights scanning
  ScanRarityInsights = "rarity-insights:scan",
  GetAllRarityInsights = "rarity-insights:get-all",
  GetRarityInsights = "rarity-insights:get",

  // Rarity insights parsing
  ParseRarityInsights = "rarity-insights:parse",

  // Rarity insights selection
  SelectRarityInsights = "rarity-insights:select",
  GetSelectedRarityInsights = "rarity-insights:get-selected",

  // Rarity source
  GetRaritySource = "rarity-insights:get-rarity-source",
  SetRaritySource = "rarity-insights:set-rarity-source",

  // Rarity insights card rarity editing
  UpdateRarityInsightsCardRarity = "rarity-insights:update-card-rarity",

  // Rarity application
  ApplyRarityInsightsRarities = "rarity-insights:apply-rarities",
  OnRarityInsightsRaritiesApplied = "rarity-insights:on-rarities-applied",
}

export { RarityInsightsChannel };
