import { FiPlay, FiSquare } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Button, Flex, PageContainer } from "../../components";
import { useBoundStore } from "../../store/store";
import {
  CurrentSessionStats,
  CurrentSessionTable,
} from "./CurrentSession.components";
import PriceSnapshotAlert from "./CurrentSession.components/PriceSnapshotAlert/PriceSnapshotAlert";

const CurrentSessionPage = () => {
  const {
    currentSession: {
      getIsCurrentSessionActive,
      isLoading,
      startSession,
      stopSession,
    },
    settings: { getActiveGameViewPriceSource, setActiveGameViewPriceSource },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  const priceSource = getActiveGameViewPriceSource();

  const handlePriceSourceChange = async (source: "exchange" | "stash") => {
    await setActiveGameViewPriceSource(source);
  };

  return (
    <PageContainer>
      <PageContainer.Header
        title="Current Session"
        subtitle="Track your active opening session in real-time"
        actions={
          <Flex className="gap-2 items-center">
            {isActive ? (
              <Button
                variant="ghost"
                onClick={stopSession}
                disabled={isLoading}
              >
                <FiSquare /> Stop Session
              </Button>
            ) : (
              <Button
                variant="ghost"
                onClick={startSession}
                disabled={isLoading}
              >
                <FiPlay /> Start Session
              </Button>
            )}
            {/* Price Source Toggle */}
            <div role="tablist" className="tabs tabs-border">
              <button
                role="tab"
                className={`tab flex flex-row items-center gap-1 ${priceSource === "exchange" ? "tab-active" : ""}`}
                onClick={() => handlePriceSourceChange("exchange")}
              >
                <GiCardExchange />
                Exchange
              </button>
              <button
                role="tab"
                className={`tab flex flex-row items-center gap-1 ${priceSource === "stash" ? "tab-active" : ""}`}
                onClick={() => handlePriceSourceChange("stash")}
              >
                <GiLockedChest />
                Stash
              </button>
            </div>
          </Flex>
        }
      />
      <PageContainer.Content>
        {/* Session Status Alerts */}
        {!isActive && (
          <div className="alert alert-soft alert-info bg-base-200">
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
              No active session. Select a league and click "Start Session" to
              begin tracking.
            </span>
          </div>
        )}

        <PriceSnapshotAlert />
        <CurrentSessionStats />
        <CurrentSessionTable />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CurrentSessionPage;
