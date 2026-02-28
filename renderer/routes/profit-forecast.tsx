import { createFileRoute } from "@tanstack/react-router";

import { ProfitForecastPage } from "../modules/profit-forecast";

export const Route = createFileRoute("/profit-forecast")({
  component: ProfitForecastPage,
});
