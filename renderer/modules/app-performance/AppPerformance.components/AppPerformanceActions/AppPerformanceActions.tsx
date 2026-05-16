import { useNavigate } from "@tanstack/react-router";
import { FiDownload } from "react-icons/fi";

import { AnimatedStopIcon, BackButton, Button } from "~/renderer/components";
import { useAppPerformanceShallow, useBoundStore } from "~/renderer/store";

export function AppPerformanceActions() {
  const navigate = useNavigate();
  const {
    captureId,
    captureStoppedAt,
    exportReport,
    isExporting,
    isSampling,
    stopCapture,
  } = useAppPerformanceShallow((appPerformance) => ({
    captureId: appPerformance.captureId,
    captureStoppedAt: appPerformance.captureStoppedAt,
    exportReport: appPerformance.exportReport,
    isExporting: appPerformance.isExporting,
    isSampling: appPerformance.isSampling,
    stopCapture: appPerformance.stopCapture,
  }));
  const canExport = Boolean(captureId && captureStoppedAt && !isSampling);

  const handleStop = async () => {
    await stopCapture();
    const stoppedCaptureId = useBoundStore.getState().appPerformance.captureId;
    if (stoppedCaptureId) {
      await navigate({
        to: "/app-performance/$captureId",
        params: { captureId: stoppedCaptureId },
        replace: true,
      });
    }
  };

  if (isSampling) {
    return (
      <div className="flex items-center gap-2">
        <BackButton fallback="/app-performance" />
        <Button type="button" variant="ghost" size="sm" onClick={handleStop}>
          <AnimatedStopIcon />
          Stop diagnostics
        </Button>
      </div>
    );
  }

  if (!canExport) {
    return <BackButton fallback="/app-performance" />;
  }

  return (
    <div className="flex items-center gap-2">
      <BackButton fallback="/app-performance" />
      <Button
        type="button"
        variant="primary"
        size="sm"
        loading={isExporting}
        onClick={exportReport}
      >
        <FiDownload />
        Export report
      </Button>
    </div>
  );
}
