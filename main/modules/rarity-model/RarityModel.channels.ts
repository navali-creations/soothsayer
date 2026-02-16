enum RarityModelChannel {
  // Rarity model scanning
  ScanRarityModels = "rarity-model:scan",
  GetRarityModels = "rarity-model:get-all",
  GetRarityModel = "rarity-model:get",

  // Rarity model parsing
  ParseRarityModel = "rarity-model:parse",

  // Rarity model selection
  SelectRarityModel = "rarity-model:select",
  GetSelectedRarityModel = "rarity-model:get-selected",

  // Rarity source
  GetRaritySource = "rarity-model:get-rarity-source",
  SetRaritySource = "rarity-model:set-rarity-source",

  // Rarity model card rarity editing
  UpdateRarityModelCardRarity = "rarity-model:update-card-rarity",

  // Rarity application
  ApplyRarityModelRarities = "rarity-model:apply-rarities",
  OnRarityModelRaritiesApplied = "rarity-model:on-rarities-applied",
}

export { RarityModelChannel };
