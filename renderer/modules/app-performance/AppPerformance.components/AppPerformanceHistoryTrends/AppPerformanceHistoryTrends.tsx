import clsx from "clsx";
import { useMemo, useState } from "react";

import { useChartColors } from "~/renderer/hooks";
import { useAppPerformanceShallow } from "~/renderer/store";

import {
  createTrendSpecs,
  type TrendSpecId,
} from "./AppPerformanceHistoryTrends.utils";
import { TrendCard } from "./TrendCard/TrendCard";

export function AppPerformanceHistoryTrends() {
  const colors = useChartColors();
  const { captures, isLoading } = useAppPerformanceShallow(
    (appPerformance) => ({
      captures: appPerformance.captureHistory,
      isLoading: appPerformance.isLoadingHistory,
    }),
  );
  const [focusedTrend, setFocusedTrend] = useState<TrendSpecId | null>(null);
  const specs = useMemo(() => createTrendSpecs(colors), [colors]);
  const visibleSpecs =
    focusedTrend === null
      ? specs
      : specs.filter((spec) => spec.id === focusedTrend);
  const compactSpecs =
    focusedTrend === null
      ? []
      : specs.filter((spec) => spec.id !== focusedTrend);

  if (isLoading && captures.length === 0) {
    return (
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-3">
        {specs.map((spec) => (
          <div
            key={spec.id}
            className="h-60 animate-pulse rounded-lg bg-base-200 shadow-xl"
          />
        ))}
      </div>
    );
  }

  if (captures.length === 0) return null;

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">Trends</span>
        <span className="text-xs text-base-content/45">
          Latest {captures.length} reports
        </span>
      </div>
      <div className="flex min-h-0 flex-col gap-3">
        <div
          className={clsx({
            "grid grid-cols-1 gap-3 lg:grid-cols-3": focusedTrend === null,
            "flex min-h-120 flex-col": focusedTrend !== null,
          })}
        >
          {visibleSpecs.map((spec) => (
            <TrendCard
              key={spec.id}
              spec={spec}
              colors={colors}
              focused={focusedTrend === spec.id}
              onFocusChange={setFocusedTrend}
            />
          ))}
        </div>
        {compactSpecs.length > 0 && (
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {compactSpecs.map((spec) => (
              <TrendCard
                key={spec.id}
                spec={spec}
                colors={colors}
                compact
                focused={false}
                onFocusChange={setFocusedTrend}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
