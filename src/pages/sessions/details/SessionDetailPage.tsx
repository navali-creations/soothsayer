import { useState, useEffect } from "react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { FiArrowLeft, FiClock, FiCalendar } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { Button, Flex, Table } from "../../../components";
import {
  usePoeNinjaExchangePrices,
  usePoeNinjaStashPrices,
} from "../../../hooks";
import { createColumnHelper } from "@tanstack/react-table";
import { formatCurrency } from "../../../api/poe-ninja";

type SessionData = {
  id: string;
  isActive: boolean;
  league: string;
  startedAt: string;
  endedAt: string | null;
  totalCount: number;
  cards: Record<string, { count: number; processedIds: string[] }>;
};

type CardEntry = {
  name: string;
  count: number;
  ratio: number;
  chaosValue: number;
  totalValue: number;
};

const columnHelper = createColumnHelper<CardEntry>();

type PriceSource = "exchange" | "stash";

const SessionDetailPage = () => {
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const navigate = useNavigate();
  const [session, setSession] = useState<SessionData | null>(null);
  const [loading, setLoading] = useState(true);
  const [priceSource, setPriceSource] = useState<PriceSource>("exchange");

  // Fetch price data
  const exchangeData = usePoeNinjaExchangePrices(
    session?.league || "Keepers",
    priceSource === "exchange",
  );
  const stashData = usePoeNinjaStashPrices(
    session?.league || "Keepers",
    priceSource === "stash",
  );

  const {
    chaosToDivineRatio,
    cardPrices,
    isLoading: pricesLoading,
  } = priceSource === "exchange" ? exchangeData : stashData;

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  const loadSession = async () => {
    setLoading(true);
    const sessionData = await window.electron?.session?.getById(
      "poe1",
      sessionId,
    );
    setSession(sessionData);
    setLoading(false);
  };

  const calculateDuration = () => {
    if (!session) return "—";
    const start = new Date(session.startedAt);
    const end = session.endedAt ? new Date(session.endedAt) : new Date();
    const diff = end.getTime() - start.getTime();

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Prepare card data for table
  const cardData: CardEntry[] = session
    ? Object.entries(session.cards)
        .map(([name, entry]) => {
          const price = cardPrices[name];
          const chaosValue = price?.chaosValue || 0;
          const totalValue = chaosValue * entry.count;

          return {
            name,
            count: entry.count,
            ratio: (entry.count / session.totalCount) * 100,
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
          data-tip="How often this card appeared compared to all other cards"
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

  if (!session) {
    return (
      <div className="min-h-screen bg-base-200 flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-base-content/70">Session not found</p>
          <Button
            className="mt-4"
            onClick={() => navigate({ to: "/sessions" })}
          >
            <FiArrowLeft /> Back to Sessions
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-base-200 p-6">
      <div className="mx-auto space-y-6">
        {/* Header */}
        <Flex className="justify-between items-center">
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="mb-2"
              onClick={() => navigate({ to: "/sessions" })}
            >
              <FiArrowLeft /> Back
            </Button>
            <h1 className="text-3xl font-bold">
              {session.league} Session
              {session.isActive && (
                <span className="badge badge-success badge-lg ml-3">
                  Active
                </span>
              )}
            </h1>
            <p className="text-base-content/70">
              {new Date(session.startedAt).toLocaleString()}
              {session.endedAt &&
                ` - ${new Date(session.endedAt).toLocaleString()}`}
            </p>
          </div>
          <Flex className="gap-2 items-center">
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
        </Flex>

        {/* Stats Summary */}
        <div className="flex w-full shadow rounded-box overflow-hidden">
          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Stacked Decks Opened</div>
            <div className="stat-value tabular-nums">
              {session.totalCount || 0}
            </div>
            <div className="stat-desc">Total count</div>
          </div>

          <div className="stat flex-1 basis-1/4">
            <div className="stat-title">Duration</div>
            <div className="stat-value tabular-nums text-2xl">
              {calculateDuration()}
            </div>
            <div className="stat-desc">Session length</div>
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

            {cardData.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <p className="text-lg">No cards in this session</p>
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

export default SessionDetailPage;
