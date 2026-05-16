import { createFileRoute } from "@tanstack/react-router";

import { AppPerformanceLivePage } from "../modules/app-performance";

export const Route = createFileRoute("/app-performance/live")({
  component: AppPerformanceLivePage,
});
