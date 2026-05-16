import { useAppPerformanceShallow } from "~/renderer/store";

import { AppPerformanceCaptureView } from "../AppPerformanceCaptureView/AppPerformanceCaptureView";
import { LiveCaptureEmptyState } from "../LiveCaptureEmptyState/LiveCaptureEmptyState";
import { useStartAppPerformanceCapture } from "../useStartAppPerformanceCapture/useStartAppPerformanceCapture";

export function AppPerformanceLivePage() {
  const handleStartDiagnostics = useStartAppPerformanceCapture();
  const { error, isSampling, isStartingCapture } = useAppPerformanceShallow(
    (appPerformance) => ({
      error: appPerformance.error,
      isSampling: appPerformance.isSampling,
      isStartingCapture: appPerformance.isStartingCapture,
    }),
  );

  if (!isSampling) {
    return (
      <LiveCaptureEmptyState
        error={error}
        isStartingCapture={isStartingCapture}
        onStartDiagnostics={handleStartDiagnostics}
      />
    );
  }

  return <AppPerformanceCaptureView />;
}
