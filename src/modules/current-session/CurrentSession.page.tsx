import { useMemo } from "react";
import { FiPlay, FiSquare } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { formatCurrency } from "../../api/poe-ninja";
import { Button, Flex, PageContainer } from "../../components";
import { useBoundStore } from "../../store/store";
import { CurrentSessionTable } from "./CurrentSession.components";

const CurrentSessionPage = () => {
  const {
    currentSession: {
      getIsCurrentSessionActive,
      isLoading,
      startSession,
      stopSession,
      getSession,
    },
    settings: { getActiveGameViewPriceSource, setActiveGameViewPriceSource },
  } = useBoundStore();

  const isActive = getIsCurrentSessionActive();
  const sessionData = getSession();
  const priceSource = getActiveGameViewPriceSource();

  const handlePriceSourceChange = async (source: "exchange" | "stash") => {
    await setActiveGameViewPriceSource(source);
  };

  // Get the ratio and total for selected price source
  const { chaosToDivineRatio, totalProfit } = useMemo(() => {
    if (!sessionData?.totals) {
      return { chaosToDivineRatio: 0, totalProfit: 0 };
    }
    return {
      chaosToDivineRatio: sessionData.totals[priceSource].chaosToDivineRatio,
      totalProfit: sessionData.totals[priceSource].totalValue,
    };
  }, [sessionData?.totals, priceSource]);

  // Cards are already in array format, ready to use!
  const cardData = sessionData?.cards || [];

  const mostCommonCard = useMemo(
    () =>
      cardData.length > 0
        ? cardData.reduce((max, card) => (card.count > max.count ? card : max))
        : null,
    [cardData],
  );

  const hasSnapshot = !!sessionData?.priceSnapshot;

  return (
    <PageContainer>
      <PageContainer.Header
        title="Current Session"
        subtitle="Track your active opening session in real-time"
        actions={
          <Flex className="gap-2 items-center">
            {isActive ? (
              <Button
                variant="error"
                onClick={stopSession}
                disabled={isLoading}
              >
                <FiSquare /> Stop Session
              </Button>
            ) : (
              <Button
                variant="success"
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
      <div className="mx-auto space-y-6">
        {/* Session Status Alerts */}
        {!isActive && (
          <div className="alert alert-soft alert-info">
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

        {/* Pricing Source Info */}
        {hasSnapshot ? (
          <div className="alert alert-soft alert-success">
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
              Using {priceSource} pricing snapshot from session start (
              {new Date(sessionData!.priceSnapshot!.timestamp).toLocaleString()}
              ) • Divine = {chaosToDivineRatio.toFixed(2)}c • Use checkboxes to
              hide anomalous prices
            </span>
          </div>
        ) : (
          <div className="alert alert-soft alert-warning">
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
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
            <span>
              No pricing snapshot available. Session running without price data.
            </span>
          </div>
        )}

        {/* Stats Summary */}
        <div className="flex w-full shadow rounded-box overflow-hidden">
          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Stacked Decks Opened</div>
            <div className="stat-value tabular-nums">
              {sessionData?.totalCount || 0}
            </div>
            <div className="stat-desc">This session</div>
          </div>

          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Unique Cards</div>
            <div className="stat-value tabular-nums">{cardData.length}</div>
            <div className="stat-desc">Different cards found</div>
          </div>

          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Most Common</div>
            <div className="stat-value text-lg line-clamp-1">
              {mostCommonCard?.name || "—"}
            </div>
            <div className="stat-desc tabular-nums">
              {mostCommonCard?.count || 0} times
            </div>
          </div>

          <div className="stat flex-1 basis-1/4 bg-gradient-to-tl from-primary/10 to-secondary/10 relative">
            <div className="absolute right-1 bottom-1">
              {priceSource === "exchange" ? (
                <GiCardExchange size={50} opacity={0.1} />
              ) : (
                <GiLockedChest size={50} opacity={0.1} />
              )}
            </div>
            <div className="stat-title">Total Value</div>
            <div className="stat-value">
              {!hasSnapshot ? (
                <span className="text-base-content/50">N/A</span>
              ) : (
                <span className="tabular-nums">
                  {formatCurrency(totalProfit, chaosToDivineRatio)}
                </span>
              )}
            </div>
            <div className="stat-desc">
              {!hasSnapshot ? (
                <span className="text-base-content/50">No pricing data</span>
              ) : totalProfit >= chaosToDivineRatio ? (
                <span className="tabular-nums">
                  ≈ {Math.floor(totalProfit)} chaos
                </span>
              ) : (
                <span className="tabular-nums">
                  ≈ {(totalProfit / chaosToDivineRatio).toFixed(4)} divine
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Cards Table */}
        <CurrentSessionTable />
      </div>
    </PageContainer>
  );
};

export default CurrentSessionPage;
