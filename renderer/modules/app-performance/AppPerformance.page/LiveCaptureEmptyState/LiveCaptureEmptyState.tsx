import { FiActivity, FiPlay } from "react-icons/fi";

import { Button, Link, PageContainer } from "~/renderer/components";

import { AppPerformanceActions } from "../../AppPerformance.components";

interface LiveCaptureEmptyStateProps {
  error: string | null;
  isStartingCapture: boolean;
  onStartDiagnostics: () => void;
}

export function LiveCaptureEmptyState({
  error,
  isStartingCapture,
  onStartDiagnostics,
}: LiveCaptureEmptyStateProps) {
  return (
    <PageContainer>
      <PageContainer.Header
        title="App Performance"
        subtitle="No live diagnostics capture"
        actions={<AppPerformanceActions />}
      />
      <PageContainer.Content className="space-y-4">
        {error && (
          <div role="alert" className="alert alert-error text-sm">
            {error}
          </div>
        )}
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md rounded-lg border border-base-content/10 bg-base-100 p-6 text-center shadow-xl">
            <FiActivity className="mx-auto mb-3 h-8 w-8 text-base-content/40" />
            <h2 className="text-lg font-semibold">
              Diagnostics are not running
            </h2>
            <p className="mt-2 text-sm text-base-content/60">
              Start a capture to watch live FPS, CPU, and memory measurements.
            </p>
            <div className="mt-4 flex justify-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                loading={isStartingCapture}
                onClick={onStartDiagnostics}
              >
                <FiPlay />
                Start diagnostics
              </Button>
              <Link to="/app-performance" asButton variant="ghost" size="sm">
                View history
              </Link>
            </div>
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
}
