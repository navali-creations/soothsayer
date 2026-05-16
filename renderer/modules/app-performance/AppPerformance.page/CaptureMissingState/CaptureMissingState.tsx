import { FiActivity } from "react-icons/fi";

import { Link, PageContainer } from "~/renderer/components";

export function CaptureMissingState() {
  return (
    <PageContainer>
      <PageContainer.Header
        title="App Performance"
        subtitle="Diagnostics capture was not found"
      />
      <PageContainer.Content>
        <div className="flex h-full items-center justify-center">
          <div className="max-w-md rounded-lg border border-base-content/10 bg-base-100 p-6 text-center shadow-xl">
            <FiActivity className="mx-auto mb-3 h-8 w-8 text-base-content/40" />
            <h2 className="text-lg font-semibold">
              Diagnostics capture is unavailable
            </h2>
            <p className="mt-2 text-sm text-base-content/60">
              Open another capture from App Performance history.
            </p>
            <Link
              to="/app-performance"
              asButton
              variant="primary"
              size="sm"
              className="mt-4"
            >
              Back to history
            </Link>
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
}
