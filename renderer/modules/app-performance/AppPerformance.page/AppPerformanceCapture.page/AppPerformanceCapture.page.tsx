import { useEffect, useState } from "react";

import { useAppPerformanceShallow } from "~/renderer/store";

import { AppPerformanceCaptureView } from "../AppPerformanceCaptureView/AppPerformanceCaptureView";
import { CaptureLoadingState } from "../CaptureLoadingState/CaptureLoadingState";
import { CaptureMissingState } from "../CaptureMissingState/CaptureMissingState";

interface AppPerformanceCapturePageProps {
  captureId: string;
}

export function AppPerformanceCapturePage({
  captureId: routeCaptureId,
}: AppPerformanceCapturePageProps) {
  const [requestedCaptureId, setRequestedCaptureId] = useState<string | null>(
    null,
  );
  const {
    captureId: loadedCaptureId,
    isLoadingCapture,
    loadCapture,
  } = useAppPerformanceShallow((appPerformance) => ({
    captureId: appPerformance.captureId,
    isLoadingCapture: appPerformance.isLoadingCapture,
    loadCapture: appPerformance.loadCapture,
  }));

  useEffect(() => {
    if (loadedCaptureId === routeCaptureId) {
      setRequestedCaptureId(routeCaptureId);
      return;
    }
    if (requestedCaptureId === routeCaptureId) return;

    setRequestedCaptureId(routeCaptureId);
    void loadCapture(routeCaptureId);
  }, [loadedCaptureId, loadCapture, requestedCaptureId, routeCaptureId]);

  const hasLoadedRouteCapture = loadedCaptureId === routeCaptureId;
  const hasRequestedRouteCapture = requestedCaptureId === routeCaptureId;
  const isLoadingRouteCapture =
    !hasLoadedRouteCapture && (!hasRequestedRouteCapture || isLoadingCapture);
  const isMissingRouteCapture =
    hasRequestedRouteCapture && !isLoadingCapture && !hasLoadedRouteCapture;

  if (isLoadingRouteCapture) return <CaptureLoadingState />;
  if (isMissingRouteCapture) return <CaptureMissingState />;

  return <AppPerformanceCaptureView />;
}
