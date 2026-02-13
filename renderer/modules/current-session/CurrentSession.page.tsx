import { AnimatePresence, motion } from "motion/react";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import {
  CurrentSessionActions,
  CurrentSessionStats,
  CurrentSessionTable,
  InactiveSessionAlert,
  LoadingAlert,
  TrackingInfoAlert,
} from "./CurrentSession.components";
import PriceSnapshotAlert from "./CurrentSession.components/PriceSnapshotAlert/PriceSnapshotAlert";

const CurrentSessionPage = () => {
  const {
    currentSession: { getIsCurrentSessionActive, isLoading },
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
          {isLoading && !isActive ? (
            <motion.div
              key="loading-alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <LoadingAlert />
            </motion.div>
          ) : !isActive ? (
            <motion.div
              key="inactive-alert"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <TrackingInfoAlert />
              <InactiveSessionAlert />
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
