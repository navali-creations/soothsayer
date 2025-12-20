import { FiRefreshCw, FiTrash2, FiDownload } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Button, Flex, Table } from "../../components";
import {
  useDivinationCards,
  usePoeNinjaExchangePrices,
  usePoeNinjaStashPrices,
} from "../../hooks";
import { createColumnHelper } from "@tanstack/react-table";
import { formatCurrency } from "../../api/poe-ninja";
import { useEffect, useState } from "react";

type CardEntry = {
  name: string;
  count: number;
  ratio: number;
  chaosValue: number;
  totalValue: number;
};

const columnHelper = createColumnHelper<CardEntry>();

type PriceSource = "exchange" | "stash";
type StatScope = "all-time" | "league";

const StatsPage = () => {
  const [priceSource, setPriceSource] = useState<PriceSource>("exchange");
  const [statScope, setStatScope] = useState<StatScope>("all-time");
  const [selectedLeague, setSelectedLeague] = useState<string>("Keepers");

  // Use the hook with scope parameter
  const { stats, loading, reset, reload, availableLeagues } =
    useDivinationCards({
      game: "poe1",
      scope: statScope,
      league: statScope === "league" ? selectedLeague : undefined,
    });

  // Set first available league as default when leagues load
  useEffect(() => {
    if (
      availableLeagues.length > 0 &&
      !availableLeagues.includes(selectedLeague)
    ) {
      setSelectedLeague(availableLeagues[0]);
    }
  }, [availableLeagues, selectedLeague]);

  // Only fetch the data for the active price source tab
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

  const handleExportCsv = async () => {
    try {
      const result = await window.electron.divinationCards.exportCsv();
      if (result.success) {
      } else if (!result.canceled) {
        alert("Failed to export CSV. Please try again.");
      }
    } catch (error) {
      console.error("Error exporting CSV:", error);
      alert("Failed to export CSV. Please try again.");
    }
  };

  if (loading || !stats) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  const cardData: CardEntry[] = Object.entries(stats.cards)
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
    .sort((a, b) => b.count - a.count);

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

  return (
    <div className="min-h-screen p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <Flex className="justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Statistics</h1>
            <p className="text-base-content/70">
              {statScope === "all-time"
                ? "All-time divination card statistics"
                : "League-specific statistics"}
            </p>
            {stats.lastUpdated && (
              <p className="text-sm text-base-content/50">
                Last updated: {new Date(stats.lastUpdated).toLocaleString()}
              </p>
            )}
          </div>
          <Flex className="gap-2 items-center">
            {/* Stat Scope Toggle */}
            <div role="tablist" className="tabs tabs-border">
              <button
                role="tab"
                className={`tab ${statScope === "all-time" ? "tab-active" : ""}`}
                onClick={() => setStatScope("all-time")}
              >
                All-Time
              </button>
              <button
                role="tab"
                className={`tab ${statScope === "league" ? "tab-active" : ""}`}
                onClick={() => setStatScope("league")}
              >
                League
              </button>
            </div>
            {/* League Selector - only show when League scope is selected */}
            {statScope === "league" && availableLeagues.length > 0 && (
              <select
                className="select select-bordered"
                value={selectedLeague}
                onChange={(e) => setSelectedLeague(e.target.value)}
              >
                {availableLeagues.map((league) => (
                  <option key={league} value={league}>
                    {league}
                  </option>
                ))}
              </select>
            )}
            {/* Price Source Toggle */}
            <div role="tablist" className="tabs tabs-border">
              <button
                role="tab"
                className={`tab flex gap-1 ${priceSource === "exchange" ? "tab-active" : ""}`}
                onClick={() => setPriceSource("exchange")}
              >
                <GiCardExchange className="mt-1" />
                Exchange
              </button>
              <button
                role="tab"
                className={`tab flex gap-1 ${priceSource === "stash" ? "tab-active" : ""}`}
                onClick={() => setPriceSource("stash")}
              >
                <GiLockedChest className="mt-1" />
                Stash
              </button>
            </div>
            <Button variant="ghost" onClick={reload}>
              <FiRefreshCw /> Refresh Prices
            </Button>
            <Button variant="primary" outline onClick={handleExportCsv}>
              <FiDownload /> Export CSV
            </Button>
            <Button variant="error" outline onClick={reset}>
              <FiTrash2 /> Reset Stats
            </Button>
          </Flex>
        </Flex>

        {/* Stats Summary */}
        <div className="flex w-full shadow rounded-box overflow-hidden">
          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Stacked Decks Opened</div>
            <div className="stat-value tabular-nums">{stats.totalCount}</div>
            <div className="stat-desc">
              {statScope === "all-time" ? "All time" : "Current league"}
            </div>
          </div>

          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Unique Cards</div>
            <div className="stat-value tabular-nums">
              {Object.keys(stats.cards).length}
            </div>
            <div className="stat-desc">Different cards found</div>
          </div>

          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Most Common</div>
            <div className="stat-value text-lg line-clamp-1">
              {mostCommonCard?.name || "N/A"}
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
        <div className="card bg-base-200 shadow-xl">
          <div className="card-body">
            <h2 className="card-title">
              Card Collection
              <span className="badge badge-ghost">
                {statScope === "all-time" ? "All-Time" : "League"}
              </span>
            </h2>

            {cardData.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <p className="text-lg">No cards collected yet</p>
                <p className="text-sm">
                  Start a session and open divination cards in Path of Exile!
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

export default StatsPage;
