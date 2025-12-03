import {
  FiPlay,
  FiSquare,
  FiDownload,
  FiClock,
  FiCalendar,
} from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Button, Flex, Table } from "../../components";
import {
  useSession,
  useDivinationCards,
  usePoeNinjaExchangePrices,
  usePoeNinjaStashPrices,
} from "../../hooks";
import { createColumnHelper } from "@tanstack/react-table";
import { formatCurrency } from "../../api/poe-ninja";
import { useState } from "react";

type CardEntry = {
  name: string;
  count: number;
  ratio: number;
  chaosValue: number;
  totalValue: number;
};

const columnHelper = createColumnHelper<CardEntry>();

type PriceSource = "exchange" | "stash";

const CurrentSessionPage = () => {
  const session = useSession({ game: "poe1" });
  const { stats, loading } = useDivinationCards();
  const [selectedLeague, setSelectedLeague] = useState("Keepers");
  const [priceSource, setPriceSource] = useState<PriceSource>("exchange");

  // Only fetch the data for the active tab
  const exchangeData = usePoeNinjaExchangePrices(
    selectedLeague,
    priceSource === "exchange",
  );
  const stashData = usePoeNinjaStashPrices(
    selectedLeague,
    priceSource === "stash",
  );

  // Use the active data source
  const {
    chaosToDivineRatio,
    cardPrices,
    isLoading: pricesLoading,
  } = priceSource === "exchange" ? exchangeData : stashData;

  const handleStartSession = async () => {
    const result = await session.start(selectedLeague);

    if (!result.success) {
      alert(`Failed to start session: ${result.error}`);
    }
  };

  const handleStopSession = async () => {
    const result = await session.stop();

    if (!result.success) {
      alert(`Failed to stop session: ${result.error}`);
    }
  };

  const handleExportCurrentSession = async () => {
    try {
      const result = await window.electron.divinationCards.exportCsv();
      if (result.success) {
        console.log("CSV exported successfully to:", result.filePath);
      } else if (!result.canceled) {
        console.error("Failed to export CSV:", result.error);
        alert("Failed to export CSV. Please try again.");
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  // Calculate session duration
  const getSessionDuration = () => {
    if (!session.sessionInfo) return "—";

    const start = new Date(session.sessionInfo.startedAt);
    const now = new Date();
    const diff = now.getTime() - start.getTime();

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Prepare card data for table
  const cardData: CardEntry[] = stats
    ? Object.entries(stats.cards)
        .map(([name, entry]) => {
          const price = cardPrices[name];
          const chaosValue = price?.chaosValue || 0;
          const totalValue = chaosValue * entry.count;

          return {
            name,
            count: entry.count,
            ratio: (entry.count / stats.totalCount) * 100,
            chaosValue,
            totalValue,
          };
        })
        .sort((a, b) => b.count - a.count)
    : [];

  const mostCommonCard =
    cardData.length > 0
      ? cardData.reduce((max, card) => (card.count > max.count ? card : max))
      : null;

  const totalProfit = cardData.reduce((sum, card) => sum + card.totalValue, 0);

  const columns = [
    columnHelper.accessor("name", {
      header: () => <div className="border-b-transparent">Card Name</div>,
      cell: (info) => <span className="font-semibold">{info.getValue()}</span>,
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
        if (value === 0)
          return <span className="text-base-content/50">N/A</span>;
        return (
          <div className="badge badge-soft">
            {formatCurrency(value, chaosToDivineRatio)}
          </div>
        );
      },
    }),
    columnHelper.accessor("totalValue", {
      header: () => <div className="border-b-transparent">Total Value</div>,
      cell: (info) => {
        const value = info.getValue();
        if (value === 0)
          return <span className="text-base-content/50">N/A</span>;
        return (
          <div className="badge badge-soft badge-success">
            {formatCurrency(value, chaosToDivineRatio)}
          </div>
        );
      },
    }),
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <Flex className="justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Current Session</h1>
            <p className="text-base-content/70">
              Track your active farming session in real-time
            </p>
          </div>
          <Flex className="gap-2 items-center">
            {/* Session Controls */}
            {session.isActive ? (
              <>
                <Button variant="error" onClick={handleStopSession}>
                  <FiSquare /> Stop Session
                </Button>
              </>
            ) : (
              <>
                <select
                  className="select select-bordered"
                  value={selectedLeague}
                  onChange={(e) => setSelectedLeague(e.target.value)}
                >
                  <option value="Keepers">Keepers</option>
                  <option value="Standard">Standard</option>
                </select>
                <Button variant="success" onClick={handleStartSession}>
                  <FiPlay /> Start Session
                </Button>
              </>
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
            <Button variant="ghost" onClick={handleExportCurrentSession}>
              <FiDownload /> Export CSV
            </Button>
          </Flex>
        </Flex>

        {/* Session Status Alerts */}
        {!session.isActive && (
          <div className="alert alert-info">
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

        {session.error && (
          <div className="alert alert-error">
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
            <span>{session.error}</span>
          </div>
        )}

        {/* Stats Summary */}
        <div className="flex w-full shadow rounded-box overflow-hidden">
          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Stacked Decks Opened</div>
            <div className="stat-value tabular-nums">
              {stats?.totalCount || 0}
            </div>
            <div className="stat-desc">This session</div>
          </div>

          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Unique Cards</div>
            <div className="stat-value tabular-nums">
              {stats ? Object.keys(stats.cards).length : 0}
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
              {priceSource === "exchange" ? (
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

            {!stats || cardData.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <p className="text-lg">No cards in this session yet</p>
                <p className="text-sm">
                  {session.isActive
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
    </div>
  );
};

export default CurrentSessionPage;
