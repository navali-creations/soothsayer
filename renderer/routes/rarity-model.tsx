import { createFileRoute } from "@tanstack/react-router";

import { RarityModelPage } from "../modules/rarity-model";

export const Route = createFileRoute("/rarity-model")({
  component: RarityModelPage,
});
