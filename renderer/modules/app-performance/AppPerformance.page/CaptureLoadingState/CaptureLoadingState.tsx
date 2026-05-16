import { PageContainer } from "~/renderer/components";

export function CaptureLoadingState() {
  return (
    <PageContainer>
      <PageContainer.Header
        title="App Performance"
        subtitle="Loading diagnostics capture"
      />
      <PageContainer.Content>
        <div className="flex h-full items-center justify-center">
          <span className="loading loading-spinner loading-lg" />
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
}
