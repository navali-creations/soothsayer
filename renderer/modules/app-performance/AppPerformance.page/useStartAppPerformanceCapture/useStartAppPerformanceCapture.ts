import { useNavigate } from "@tanstack/react-router";

import { useAppPerformanceShallow } from "~/renderer/store";

export function useStartAppPerformanceCapture() {
  const navigate = useNavigate();
  const { isSampling, startCapture, setStartingCapture } =
    useAppPerformanceShallow((appPerformance) => ({
      isSampling: appPerformance.isSampling,
      startCapture: appPerformance.startCapture,
      setStartingCapture: appPerformance.setStartingCapture,
    }));

  const handleStartDiagnostics = async () => {
    setStartingCapture(true);
    try {
      if (!isSampling) {
        await startCapture();
      }
      await navigate({ to: "/app-performance/live" });
    } finally {
      setStartingCapture(false);
    }
  };

  return handleStartDiagnostics;
}
