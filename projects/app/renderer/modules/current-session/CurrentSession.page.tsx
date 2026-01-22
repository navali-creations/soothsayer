import { AnimatePresence, motion } from "motion/react";
import { PageContainer } from "../../components";
import { useBoundStore } from "../../store/store";
import {
  CurrentSessionActions,
  CurrentSessionStats,
  CurrentSessionTable,
} from "./CurrentSession.components";
import PriceSnapshotAlert from "./CurrentSession.components/PriceSnapshotAlert/PriceSnapshotAlert";

const CurrentSessionPage = () => {
  const {
    currentSession: { getIsCurrentSessionActive },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();

  return (
    <PageContainer>
      <PageContainer.Header
        title="Current Session"
        subtitle="Track your active opening session in real-time"
        actions={<CurrentSessionActions />}
      />
      <PageContainer.Content>
        {/* Session Status Alert */}
        <AnimatePresence mode="wait" initial={false}>
          {!isActive ? (
            <motion.div
              key="inactive-alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="alert alert-soft alert-info bg-base-200 mb-4">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="stroke-current shrink-0 w-6 h-6"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>
                  No active session. Select a league and click "Start Session"
                  to begin tracking.
                </span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="active-alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="mb-4">
                <PriceSnapshotAlert />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <CurrentSessionStats />
        <CurrentSessionTable />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CurrentSessionPage;
