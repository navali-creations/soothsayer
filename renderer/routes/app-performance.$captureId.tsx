import { createFileRoute } from "@tanstack/react-router";

import { AppPerformanceCapturePage } from "../modules/app-performance";

export const Route = createFileRoute("/app-performance/$captureId")({
  component: AppPerformanceCaptureRoute,
});

function AppPerformanceCaptureRoute() {
  const { captureId } = Route.useParams();
  return <AppPerformanceCapturePage captureId={captureId} />;
}
