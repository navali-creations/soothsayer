import { useParams } from "@tanstack/react-router";
import { AnimatePresence, motion } from "motion/react";
import { useCallback, useEffect, useState } from "react";

import { BackButton, PageContainer } from "~/renderer/components";
import SessionProfitTimeline from "~/renderer/modules/current-session/CurrentSession.components/SessionProfitTimeline";
import { trackEvent } from "~/renderer/modules/umami";
import { useSessionDetails } from "~/renderer/store";

import {
  SessionDetailsActions,
  SessionDetailsStats,
  SessionDetailsTable,
} from "../SessionDetails.components";

const SessionDetailsPage = () => {
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const {
    loadSession,
    clearSession,
    getSession,
    getIsLoading,
    getTimeline,
    getHasTimeline,
    getPriceData,
  } = useSessionDetails();

  const session = getSession();
  const loading = getIsLoading();
  const timeline = getTimeline();
  const hasTimeline = getHasTimeline();
  const { chaosToDivineRatio } = getPriceData();

  const [expanded, setExpanded] = useState(false);
  const toggleExpanded = useCallback(() => setExpanded((prev) => !prev), []);

  useEffect(() => {
    loadSession(sessionId);

    return () => {
      clearSession();
    };
  }, [sessionId, loadSession, clearSession]);

  const handleExportCsv = useCallback(async () => {
    try {
      const result = await window.electron.csv.exportSession(sessionId);
      if (result.success) {
        trackEvent("csv-export", {
          type: "session",
          league: session?.league ?? "unknown",
          source: "session-details",
        });
      } else if (!result.canceled) {
        alert("Failed to export CSV. Please try again.");
      }
    } catch (error) {
      console.error("Error exporting session CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  }, [sessionId, session]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-base-content/60">Session not found</p>
          <BackButton
            fallback="/sessions"
            label="Back to Sessions"
            variant="primary"
            size="md"
            className="mt-4"
          />
        </div>
      </div>
    );
  }

  return (
    <PageContainer>
      <PageContainer.Header
        title="Session Details"
        subtitle={
          <>
            {session.league} • {new Date(session.startedAt!).toLocaleString()}
          </>
        }
        actions={<SessionDetailsActions onExportCsv={handleExportCsv} />}
      />
      <PageContainer.Content>
        <SessionDetailsStats
          expanded={expanded}
          onToggleExpanded={toggleExpanded}
        />
        {/* Expanded Profit Timeline */}
        <AnimatePresence initial={false}>
          {expanded && hasTimeline && (
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
                  <SessionProfitTimeline
                    timeline={timeline}
                    chaosToDivineRatio={chaosToDivineRatio}
                    stackedDeckChaosCost={
                      session?.priceSnapshot?.stackedDeckChaosCost ?? 0
                    }
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <SessionDetailsTable />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default SessionDetailsPage;
