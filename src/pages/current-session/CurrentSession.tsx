import { createColumnHelper } from "@tanstack/react-table";
import { useMemo, useState } from "react";
import { FiDownload, FiEye, FiPlay, FiSquare } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { formatCurrency } from "../../api/poe-ninja";
import { Button, Flex, PageContainer, Table } from "../../components";
import { usePoeNinjaExchangePrices, usePoeNinjaStashPrices } from "../../hooks";
import { useBoundStore } from "../../store/store";

type CardEntry = {
  name: string;
  count: number;
  ratio: number;
  chaosValue: number;
  totalValue: number;
  hidePrice?: boolean;
};

const columnHelper = createColumnHelper<CardEntry>();

type PriceSource = "exchange" | "stash";

const CurrentSessionPage = () => {
  // Use Zustand for all session state
  const {
    currentSession: {
      getIsCurrentSessionActive,
      isLoading,
      startSession,
      stopSession,
      getSession,
    },
    settings: { getActiveGameViewSelectedLeague },
  } = useBoundStore();
  const selectedLeague = getActiveGameViewSelectedLeague();
  const isActive = getIsCurrentSessionActive();
  const sessionData = getSession();

  const [priceSource, setPriceSource] = useState<PriceSource>("exchange");
  const [error, setError] = useState<string | null>(null);

  // Only fetch live data when there's no snapshot (fallback)
  const shouldFetchLive = !sessionData?.priceSnapshot;
  const exchangeData = usePoeNinjaExchangePrices(
    selectedLeague,
    shouldFetchLive && priceSource === "exchange",
  );
  const stashData = usePoeNinjaStashPrices(
    selectedLeague,
    shouldFetchLive && priceSource === "stash",
  );

  // Determine which price data to use
  const getPriceData = () => {
    // Use snapshot data if available
    if (sessionData?.priceSnapshot) {
      const snapshotData =
        priceSource === "stash"
          ? sessionData.priceSnapshot.stash
          : sessionData.priceSnapshot.exchange;

      return {
        chaosToDivineRatio: snapshotData.chaosToDivineRatio,
        cardPrices: snapshotData.cardPrices,
        isLoading: false,
        source: priceSource,
        isSnapshot: true,
      };
    }

    // Fall back to live pricing if no snapshot
    const liveData = priceSource === "stash" ? stashData : exchangeData;
    return {
      chaosToDivineRatio: liveData.chaosToDivineRatio,
      cardPrices: liveData.cardPrices,
      isLoading: liveData.isLoading,
      source: priceSource,
      isSnapshot: false,
    };
  };

  const {
    chaosToDivineRatio,
    cardPrices,
    isLoading: pricesLoading,
    source,
    isSnapshot,
  } = getPriceData();

  const handleTogglePriceVisibility = async (
    cardName: string,
    currentHidePrice: boolean,
  ) => {
    try {
      const result = await window.electron.session.updateCardPriceVisibility(
        "poe1",
        "current",
        priceSource,
        cardName,
        !currentHidePrice,
      );

      if (!result.success) {
        alert(`Failed to update price visibility: ${result.error}`);
      }
    } catch (error) {
      console.error("Error toggling price visibility:", error);
      alert("Failed to update price visibility. Please try again.");
    }
  };

  // Prepare card data for table
  const cardData: CardEntry[] = useMemo(() => {
    if (!sessionData?.cards) return [];

    return Object.entries(sessionData.cards)
      .map(([name, entry]) => {
        const price = cardPrices[name];
        const chaosValue = price?.chaosValue || 0;
        const hidePrice = price?.hidePrice || false;
        const totalValue = chaosValue * entry.count;

        return {
          name,
          count: entry.count,
          ratio: (entry.count / sessionData.totalCount) * 100,
          chaosValue,
          totalValue,
          hidePrice,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [sessionData, cardPrices]);

  const mostCommonCard = useMemo(
    () =>
      cardData.length > 0
        ? cardData.reduce((max, card) => (card.count > max.count ? card : max))
        : null,
    [cardData],
  );

  // Calculate total profit excluding hidden prices
  const totalProfit = useMemo(
    () =>
      cardData.reduce(
        (sum, card) => (card.hidePrice ? sum : sum + card.totalValue),
        0,
      ),
    [cardData],
  );

  const columns = [
    columnHelper.accessor("hidePrice", {
      header: () => (
        <div
          className="tooltip tooltip-right"
          data-tip="Hide anomalous prices from total calculations"
        >
          <Flex className="gap-1 items-center border-b border-dotted">
            <FiEye size={14} /> <sup>?</sup>
          </Flex>
        </div>
      ),
      cell: (info) => {
        const hidePrice = info.getValue() || false;
        const cardName = info.row.original.name;

        return (
          <div className="flex justify-center">
            <input
              type="checkbox"
              className="checkbox checkbox-sm"
              checked={!hidePrice}
              onChange={() => handleTogglePriceVisibility(cardName, hidePrice)}
              disabled={!isSnapshot}
              title={
                !isSnapshot
                  ? "Price visibility can only be changed when using snapshot prices"
                  : hidePrice
                    ? "Price hidden from calculations"
                    : "Price included in calculations"
              }
            />
          </div>
        );
      },
      size: 50,
    }),
    columnHelper.accessor("name", {
      header: () => <div className="border-b-transparent">Card Name</div>,
      cell: (info) => {
        const hidePrice = info.row.original.hidePrice;
        return (
          <span
            className={`font-semibold ${hidePrice ? "opacity-50 line-through" : ""}`}
          >
            {info.getValue()}
          </span>
        );
      },
    }),
    columnHelper.accessor("count", {
      header: () => <div className="border-b border-b-transparent">Count</div>,
      cell: (info) => <div className="badge badge-soft">{info.getValue()}</div>,
    }),
    columnHelper.accessor("ratio", {
      header: () => (
        <div
          className="tooltip tooltip-right tooltip-primary"
          data-tip="How often you've found this card compared to all other cards"
        >
          <Flex className="gap-1 items-center border-b border-dotted">
            Ratio <sup>?</sup>
          </Flex>
        </div>
      ),
      cell: (info) => (
        <div className="badge badge-soft">{info.getValue().toFixed(2)}%</div>
      ),
    }),
    columnHelper.accessor("chaosValue", {
      header: () => (
        <div className="border-b border-b-transparent">Value (Each)</div>
      ),
      cell: (info) => {
        const value = info.getValue();
        const hidePrice = info.row.original.hidePrice;
        if (value === 0)
          return <span className="text-base-content/50">N/A</span>;
        return (
          <div className={`badge badge-soft ${hidePrice ? "opacity-50" : ""}`}>
            {formatCurrency(value, chaosToDivineRatio)}
          </div>
        );
      },
    }),
    columnHelper.accessor("totalValue", {
      header: () => <div className="border-b-transparent">Total Value</div>,
      cell: (info) => {
        const value = info.getValue();
        const hidePrice = info.row.original.hidePrice;
        if (value === 0)
          return <span className="text-base-content/50">N/A</span>;
        return (
          <div
            className={`badge badge-soft ${hidePrice ? "badge-warning opacity-50" : "badge-success"}`}
          >
            {formatCurrency(value, chaosToDivineRatio)}
            {hidePrice && " (hidden)"}
          </div>
        );
      },
    }),
  ];

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
                onClick={() => setPriceSource("exchange")}
              >
                <GiCardExchange />
                Exchange
              </button>
              <button
                role="tab"
                className={`tab flex flex-row items-center gap-1 ${priceSource === "stash" ? "tab-active" : ""}`}
                onClick={() => setPriceSource("stash")}
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

        {error && (
          <div className="alert alert-soft alert-error">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="stroke-current shrink-0 h-6 w-6"
              fill="none"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Pricing Source Info */}
        {isSnapshot ? (
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
              Using {source} pricing snapshot from session start (
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
              No pricing snapshot available. Using live {source} pricing.
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
            <div className="stat-value tabular-nums">
              {sessionData ? Object.keys(sessionData.cards).length : 0}
            </div>
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
              {source === "exchange" ? (
                <GiCardExchange size={50} opacity={0.1} />
              ) : (
                <GiLockedChest size={50} opacity={0.1} />
              )}
            </div>
            <div className="stat-title">Total Value</div>
            <div className="stat-value">
              {pricesLoading ? (
                <span className="skeleton skeleton-text">0.00 c</span>
              ) : (
                <span className="tabular-nums">
                  {formatCurrency(totalProfit, chaosToDivineRatio)}
                </span>
              )}
            </div>
            <div className="stat-desc">
              {pricesLoading ? (
                <span className="skeleton skeleton-text">≈ 0.00 chaos</span>
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
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">Cards Opened</h2>

            {!sessionData || cardData.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <p className="text-lg">No cards in this session yet</p>
                <p className="text-sm">
                  {isActive
                    ? "Start opening stacked decks in Path of Exile!"
                    : "Start a session to begin tracking"}
                </p>
              </div>
            ) : (
              <Table
                data={cardData}
                columns={columns}
                enableSorting={true}
                enablePagination={true}
                pageSize={20}
                hoverable={true}
              />
            )}
          </div>
        </div>
      </div>
    </PageContainer>
  );
};

export default CurrentSessionPage;
