import { AnimatePresence, motion } from "motion/react";
import { useCallback, useState } from "react";

import { PageContainer } from "~/renderer/components";
import { useCurrentSession } from "~/renderer/store";

import {
  CurrentSessionActions,
  CurrentSessionStats,
  CurrentSessionTable,
  InactiveSessionAlert,
  LoadingAlert,
  SessionProfitTimeline,
  TrackingInfoAlert,
} from "../CurrentSession.components";
import PriceSnapshotAlert from "../CurrentSession.components/PriceSnapshotAlert/PriceSnapshotAlert";

const CurrentSessionPage = () => {
  const { getIsCurrentSessionActive, isLoading } = useCurrentSession();

  const isActive = getIsCurrentSessionActive();
  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

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

        <CurrentSessionStats
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
          hasTimeline={isActive}
        />

        {/* Expanded Profit Timeline */}
        <AnimatePresence initial={false}>
          {expanded && isActive && (
            <motion.div
              key="profit-timeline"
              initial={{
                opacity: 0,
                height: 0,
                marginBlockStart: "0px",
                marginBlockEnd: "0px",
              }}
              animate={{
                opacity: 1,
                height: "auto",
                marginBlockStart: "1.5rem",
                marginBlockEnd: "0px",
              }}
              exit={{
                opacity: 0,
                height: 0,
                marginBlockStart: "0px",
                marginBlockEnd: "0px",
              }}
              transition={{ duration: 0.25, ease: "easeInOut" }}
              style={{ overflow: "hidden" }}
            >
              <div className="card bg-base-200 shadow-xl">
                <div className="card-body">
                  <SessionProfitTimeline />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <CurrentSessionTable />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CurrentSessionPage;
