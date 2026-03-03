import { createFileRoute } from "@tanstack/react-router";

import { RarityInsightsPage } from "../modules/rarity-insights";

export const Route = createFileRoute("/rarity-insights")({
  component: RarityInsightsPage,
});
