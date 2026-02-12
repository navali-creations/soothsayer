import { useEffect } from "react";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import { ReleaseTimelineItem } from "./Changelog.components";

const ChangelogPage = () => {
  const {
    changelog: { releases, isLoading, error, fetchChangelog },
  } = useBoundStore();

  useEffect(() => {
    fetchChangelog();
  }, [fetchChangelog]);

  if (isLoading) {
    return (
      <PageContainer>
        <PageContainer.Header title="Changelog" subtitle="Loading..." />
        <PageContainer.Content>
          <div className="flex items-center justify-center h-full">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        </PageContainer.Content>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageContainer.Header title="Changelog" subtitle="Error" />
        <PageContainer.Content>
          <div className="flex items-center justify-center h-full">
            <div className="alert alert-error max-w-md">
              <span>{error}</span>
            </div>
          </div>
        </PageContainer.Content>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageContainer.Header
        title="Changelog"
        subtitle="Release history and updates"
      />
      <PageContainer.Content>
        <div className="flex-1 overflow-y-auto px-2 pb-8">
          {releases.length > 0 ? (
            <ul className="list-none p-0 m-0">
              {releases.map((release, idx) => (
                <ReleaseTimelineItem
                  key={release.version}
                  release={release}
                  isLast={idx === releases.length - 1}
                  isCurrent={idx === 0}
                />
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-center h-32 text-base-content/50">
              <span>No changelog entries found.</span>
            </div>
          )}
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default ChangelogPage;
