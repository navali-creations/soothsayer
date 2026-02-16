import { createFileRoute } from "@tanstack/react-router";

import { RarityModelComparisonPage } from "../modules/rarity-model";

export const Route = createFileRoute("/rarity-model")({
  component: RarityModelComparisonPage,
});
