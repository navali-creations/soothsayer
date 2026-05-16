import { useEffect } from "react";

import { PageContainer } from "~/renderer/components";
import { useAppPerformanceShallow } from "~/renderer/store";

import {
  AppPerformanceHistoryTable,
  AppPerformanceHistoryTrends,
  DeleteCapturesModal,
} from "../../AppPerformance.components";
import { AppPerformanceIndexActions } from "../AppPerformanceIndexActions/AppPerformanceIndexActions";

export function AppPerformancePage() {
  const { error, indexView, loadCaptureHistory } = useAppPerformanceShallow(
    (appPerformance) => ({
      error: appPerformance.error,
      indexView: appPerformance.indexView,
      loadCaptureHistory: appPerformance.loadCaptureHistory,
    }),
  );

  useEffect(() => {
    void loadCaptureHistory(1);
  }, [loadCaptureHistory]);

  return (
    <PageContainer>
      <PageContainer.Header
        title="App Performance"
        subtitle="Review diagnostics captures"
        actions={<AppPerformanceIndexActions />}
      />
      <PageContainer.Content className="space-y-4">
        {error && (
          <div role="alert" className="alert alert-error text-sm">
            {error}
          </div>
        )}

        {indexView === "trends" ? (
          <AppPerformanceHistoryTrends />
        ) : (
          <AppPerformanceHistoryTable title="Diagnostics captures" />
        )}
      </PageContainer.Content>

      <DeleteCapturesModal />
    </PageContainer>
  );
}
