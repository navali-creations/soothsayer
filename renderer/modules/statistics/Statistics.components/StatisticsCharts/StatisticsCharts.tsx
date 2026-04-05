import { useCallback, useEffect, useMemo } from "react";

import { CombinedChartCanvas } from "~/renderer/components/CombinedChartCanvas";
import type {
  BrushRange,
  MetricKey,
} from "~/renderer/components/CombinedChartCanvas/chart-types/chart-types";
import {
  METRICS,
  resolveColor,
  transformChartData,
} from "~/renderer/components/CombinedChartCanvas/chart-types/chart-types";
import { LegendIcon } from "~/renderer/components/CombinedChartCanvas/LegendIcon";
import { useChartColors } from "~/renderer/hooks";
import { useStatistics } from "~/renderer/store";

interface StatisticsChartsProps {
  isDataLoading?: boolean;
}

export const StatisticsCharts = ({
  isDataLoading = false,
}: StatisticsChartsProps) => {
  const c = useChartColors();

  const {
    statScope,
    selectedLeague,
    chartRawData,
    isChartLoading,
    hiddenMetrics,
    brushRange,
    fetchChartData,
    toggleChartMetric,
    setBrushRange,
  } = useStatistics();

  useEffect(() => {
    const league =
      statScope === "league" && selectedLeague ? selectedLeague : undefined;
    fetchChartData("poe1", league);
  }, [statScope, selectedLeague, fetchChartData]);

  const chartData = useMemo(
    () => transformChartData(chartRawData),
    [chartRawData],
  );

  const showBrush = chartData.length > 10;

  const defaultBrushEnd = useMemo(
    () => Math.min(29, Math.max(0, chartData.length - 1)),
    [chartData.length],
  );

  useEffect(() => {
    setBrushRange({ startIndex: 0, endIndex: defaultBrushEnd });
  }, [defaultBrushEnd, setBrushRange]);

  const handleBrushChange = useCallback(
    (range: BrushRange) => setBrushRange(range),
    [setBrushRange],
  );

  const handleLegendClick = useCallback(
    (key: MetricKey) => toggleChartMetric(key),
    [toggleChartMetric],
  );

  const isStale = isChartLoading || isDataLoading;

  if (chartData.length < 2) {
    return (
      <div
        className="card bg-base-200 shadow-xl flex-1"
        data-testid="statistics-charts"
      >
        <div className="card-body p-4 items-center justify-center">
          <p className="text-base-content/50 text-sm text-center py-8">
            At least 2 completed sessions are needed to display trends.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col gap-4 flex-1 min-h-0"
      data-testid="statistics-charts"
    >
      <div className="card bg-base-200 shadow-xl flex-1 min-h-0 relative">
        <div
          className={`absolute inset-0 bg-base-200/60 backdrop-blur-[1px] flex items-center justify-center z-20 rounded-lg pointer-events-none transition-opacity duration-200 ${
            isStale ? "opacity-100" : "opacity-0"
          }`}
        >
          <span className="loading loading-spinner loading-sm text-primary" />
        </div>
        <div className="card-body p-4 gap-0">
          <div className="flex items-center gap-2 mb-1">
            <h2 className="card-title text-sm shrink-0">Session Overview</h2>
            <div className="flex items-center gap-3 ml-auto">
              {METRICS.map((metric) => {
                const isHidden = hiddenMetrics.has(metric.key);
                const color =
                  metric.rawVisual === "area"
                    ? c.secondary30
                    : resolveColor(c, metric.colorVar);

                return (
                  <button
                    key={metric.key}
                    type="button"
                    className={`flex items-center gap-1.5 text-[11px] cursor-pointer transition-opacity ${
                      isHidden ? "opacity-30" : "opacity-100"
                    }`}
                    onClick={() => handleLegendClick(metric.key)}
                  >
                    <LegendIcon
                      visual={metric.rawVisual}
                      color={isHidden ? c.bc30 : color}
                    />
                    <span className="text-base-content/60">{metric.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <CombinedChartCanvas
            chartData={chartData}
            c={c}
            hiddenMetrics={hiddenMetrics}
            showBrush={showBrush}
            brushRange={brushRange}
            onBrushChange={handleBrushChange}
            statScope={statScope}
          />
        </div>
      </div>
    </div>
  );
};
