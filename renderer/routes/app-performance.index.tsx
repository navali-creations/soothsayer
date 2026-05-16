import { createFileRoute } from "@tanstack/react-router";

import { AppPerformancePage } from "../modules/app-performance";

export const Route = createFileRoute("/app-performance/")({
  component: AppPerformancePage,
});
