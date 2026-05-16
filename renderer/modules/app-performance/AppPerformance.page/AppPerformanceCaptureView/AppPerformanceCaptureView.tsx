import { useMemo } from "react";

import { PageContainer } from "~/renderer/components";
import { useChartColors } from "~/renderer/hooks";
import { useAppPerformanceShallow } from "~/renderer/store";

import { AppPerformanceActions } from "../../AppPerformance.components";
import { createAppPerformanceChartConfigs } from "../../AppPerformance.utils/AppPerformance.utils";
import { AppPerformanceCaptureCharts } from "../AppPerformanceCaptureCharts/AppPerformanceCaptureCharts";

export function AppPerformanceCaptureView() {
  const colors = useChartColors();
  const { error, captureStartedAt, captureStoppedAt, isSampling } =
    useAppPerformanceShallow((appPerformance) => ({
      error: appPerformance.error,
      captureStartedAt: appPerformance.captureStartedAt,
      captureStoppedAt: appPerformance.captureStoppedAt,
      isSampling: appPerformance.isSampling,
    }));
  const charts = useMemo(
    () => createAppPerformanceChartConfigs({ colors }),
    [colors],
  );

  let subtitle = "Diagnostics capture";
  if (isSampling && captureStartedAt) {
    subtitle = `Capture started ${new Date(captureStartedAt).toLocaleString()}`;
  } else if (captureStoppedAt) {
    subtitle = `Viewing capture from ${new Date(
      captureStartedAt ?? captureStoppedAt,
    ).toLocaleString()}`;
  }

  return (
    <PageContainer>
      <PageContainer.Header
        title="App Performance"
        subtitle={subtitle}
        actions={<AppPerformanceActions />}
      />
      <PageContainer.Content className="space-y-4">
        {error && (
          <div role="alert" className="alert alert-error text-sm">
            {error}
          </div>
        )}
        <AppPerformanceCaptureCharts charts={charts} />
      </PageContainer.Content>
    </PageContainer>
  );
}
