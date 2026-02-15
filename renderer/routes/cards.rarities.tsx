import { createFileRoute } from "@tanstack/react-router";

import { FilterComparisonPage } from "../modules/filters";

export const Route = createFileRoute("/cards/rarities")({
  component: FilterComparisonPage,
});
