import { useEffect } from "react";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import {
  SessionsActions,
  SessionsGrid,
  SessionsPagination,
} from "./Sessions.components";

const SessionsPage = () => {
  const {
    sessions: { loadAllSessions, getIsLoading },
  } = useBoundStore();
  const loading = getIsLoading();

  useEffect(() => {
    loadAllSessions();
  }, [loadAllSessions]);

  return (
    <PageContainer>
      <PageContainer.Header
        title="Sessions"
        subtitle="View all your opening sessions"
        actions={<SessionsActions />}
      />
      <PageContainer.Content>
        {loading ? (
          <span className="loading loading-spinner loading-lg" />
        ) : (
          <>
            <SessionsGrid />
            <SessionsPagination />
          </>
        )}
      </PageContainer.Content>
    </PageContainer>
  );
};

export default SessionsPage;
