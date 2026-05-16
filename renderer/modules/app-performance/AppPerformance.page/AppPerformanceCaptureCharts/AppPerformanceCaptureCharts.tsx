import { useAppPerformanceShallow } from "~/renderer/store";

import { PerformanceMetricGrid } from "../../AppPerformance.components";
import type { AppPerformanceChartConfig } from "../../AppPerformance.utils/AppPerformance.utils";
import { AppPerformanceChartGrid } from "../AppPerformanceChartGrid/AppPerformanceChartGrid";

interface AppPerformanceCaptureChartsProps {
  charts: AppPerformanceChartConfig[];
}

export function AppPerformanceCaptureCharts({
  charts,
}: AppPerformanceCaptureChartsProps) {
  const { focusedChart, isSampling } = useAppPerformanceShallow(
    (appPerformance) => ({
      focusedChart: appPerformance.focusedChart,
      isSampling: appPerformance.isSampling,
    }),
  );
  const visibleCharts =
    focusedChart === null
      ? charts
      : charts.filter((chart) => chart.key === focusedChart);
  const compactCharts =
    focusedChart === null
      ? []
      : charts.filter((chart) => chart.key !== focusedChart);

  return (
    <>
      {isSampling && <PerformanceMetricGrid />}
      <div className="flex min-h-0 flex-col gap-4">
        <AppPerformanceChartGrid charts={visibleCharts} />
        {compactCharts.length > 0 && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AppPerformanceChartGrid charts={compactCharts} compact />
          </div>
        )}
      </div>
    </>
  );
}
