import { useNavigate, useParams } from "@tanstack/react-router";
import { createColumnHelper } from "@tanstack/react-table";
import { useEffect, useMemo } from "react";
import { FiArrowLeft, FiEye, FiEyeOff } from "react-icons/fi";
import { GiCardExchange, GiLockedChest } from "react-icons/gi";
import { formatCurrency } from "../../api/poe-ninja";
import { Button, Flex, Table } from "../../components";
import { useBoundStore } from "../../store/store";
import type { PriceSource } from "./SessionDetails.slice";

type CardEntry = {
  name: string;
  count: number;
  ratio: number;
  chaosValue: number;
  totalValue: number;
  hidePrice?: boolean;
};

const columnHelper = createColumnHelper<CardEntry>();

const SessionDetailsPage = () => {
  const { sessionId } = useParams({ from: "/sessions/$sessionId" });
  const navigate = useNavigate();

  const {
    sessionDetails: {
      loadSession,
      clearSession,
      getSession,
      getIsLoading,
      getPriceSource,
      setPriceSource,
      toggleCardPriceVisibility,
    },
  } = useBoundStore();

  const session = getSession();
  const loading = getIsLoading();
  const priceSource = getPriceSource();

  useEffect(() => {
    loadSession(sessionId);

    return () => {
      clearSession();
    };
  }, [sessionId, loadSession, clearSession]);

  const calculateDuration = () => {
    if (!session) return "—";

    const start = new Date(session.startedAt);

    // If session is not active and has no endedAt, it's corrupted
    if (!session.isActive && !session.endedAt) {
      return "Unknown (Corrupted)";
    }

    const end = session.endedAt ? new Date(session.endedAt) : new Date();
    const diff = end.getTime() - start.getTime();

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  // Get price data based on selected source
  const priceData = useMemo(() => {
    if (!session?.priceSnapshot) {
      return {
        chaosToDivineRatio: 0,
        cardPrices: {},
      };
    }

    const source =
      priceSource === "stash"
        ? session.priceSnapshot.stash
        : session.priceSnapshot.exchange;

    return {
      chaosToDivineRatio: source.chaosToDivineRatio,
      cardPrices: source.cardPrices,
    };
  }, [session, priceSource]);

  // Prepare card data for table
  const cardData: CardEntry[] = useMemo(() => {
    if (!session?.cards) return [];

    return Object.entries(session.cards)
      .map(([name, entry]) => {
        const price = priceData.cardPrices[name];
        const priceInfo =
          priceSource === "exchange" ? entry.exchangePrice : entry.stashPrice;

        const chaosValue = priceInfo?.chaosValue || 0;
        const totalValue = priceInfo?.totalValue || 0;
        const hidePrice = priceInfo?.hidePrice || false;

        return {
          name,
          count: entry.count,
          ratio: (entry.count / session.totalCount) * 100,
          chaosValue,
          totalValue,
          hidePrice,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [session, priceData, priceSource]);

  const mostCommonCard = useMemo(() => {
    return cardData.length > 0
      ? cardData.reduce((max, card) => (card.count > max.count ? card : max))
      : null;
  }, [cardData]);

  // Calculate total profit excluding hidden prices
  const totalProfit = useMemo(() => {
    return cardData.reduce((sum, card) => {
      if (card.hidePrice) return sum;
      return sum + card.totalValue;
    }, 0);
  }, [cardData]);

  const columns = useMemo(
    () => [
      // Visibility toggle column
      columnHelper.display({
        id: "visibility",
        header: () => (
          <div
            className="tooltip tooltip-right"
            data-tip="Toggle price visibility (affects totals)"
          >
            <FiEye className="opacity-50" />
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;

          return (
            <button
              className="btn btn-ghost btn-xs"
              onClick={() => toggleCardPriceVisibility(row.name, priceSource)}
              title={
                isHidden
                  ? "Click to include in totals"
                  : "Click to exclude from totals"
              }
            >
              {isHidden ? (
                <FiEyeOff className="text-error" />
              ) : (
                <FiEye className="text-success" />
              )}
            </button>
          );
        },
      }),
      columnHelper.accessor("name", {
        header: "Card Name",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          return (
            <span
              className={`font-semibold ${isHidden ? "opacity-40 line-through" : ""}`}
            >
              {info.getValue()}
              {isHidden && (
                <span className="badge badge-error badge-xs ml-2">Hidden</span>
              )}
            </span>
          );
        },
      }),
      columnHelper.accessor("count", {
        header: "Count",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          return (
            <div className={`badge badge-soft ${isHidden ? "opacity-40" : ""}`}>
              {info.getValue()}
            </div>
          );
        },
      }),
      columnHelper.accessor("ratio", {
        header: () => (
          <div
            className="tooltip tooltip-right tooltip-primary"
            data-tip="How often this card appeared compared to all other cards"
          >
            Ratio
          </div>
        ),
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          return (
            <span className={`tabular-nums ${isHidden ? "opacity-40" : ""}`}>
              {info.getValue().toFixed(2)}%
            </span>
          );
        },
      }),
      columnHelper.accessor("chaosValue", {
        header: "Chaos Value",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          const value = info.getValue();
          return (
            <span
              className={`tabular-nums ${isHidden ? "opacity-40" : ""} ${value === 0 ? "text-base-content/30" : ""}`}
            >
              {value === 0
                ? "—"
                : formatCurrency(value, priceData.chaosToDivineRatio)}
            </span>
          );
        },
      }),
      columnHelper.accessor("totalValue", {
        header: "Total Value",
        cell: (info) => {
          const row = info.row.original;
          const isHidden = row.hidePrice || false;
          const value = info.getValue();
          return (
            <span
              className={`font-semibold tabular-nums ${isHidden ? "opacity-40" : "text-success"} ${value === 0 ? "text-base-content/30" : ""}`}
            >
              {value === 0
                ? "—"
                : formatCurrency(value, priceData.chaosToDivineRatio)}
            </span>
          );
        },
      }),
    ],
    [priceData, priceSource, toggleCardPriceVisibility],
  );

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
          <p className="text-xl text-base-content/60">Session not found</p>
          <Button
            variant="primary"
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
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              onClick={() => navigate({ to: "/sessions" })}
            >
              <FiArrowLeft />
            </Button>
            <div>
              <h1 className="text-3xl font-bold">Session Details</h1>
              <p className="text-base-content/60">
                {session.league} •{" "}
                {new Date(session.startedAt!).toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Duration */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm opacity-60">Duration</h2>
              <p className="text-2xl font-bold">{calculateDuration()}</p>
            </div>
          </div>

          {/* Total Decks */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm opacity-60">Decks Opened</h2>
              <p className="text-2xl font-bold">{session.totalCount}</p>
            </div>
          </div>

          {/* Most Common Card */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm opacity-60">Most Common</h2>
              <p className="text-lg font-bold truncate">
                {mostCommonCard?.name || "—"}
              </p>
              {mostCommonCard && (
                <p className="text-sm opacity-60">
                  {mostCommonCard.count}x ({mostCommonCard.ratio.toFixed(1)}%)
                </p>
              )}
            </div>
          </div>

          {/* Total Profit */}
          <div className="card bg-base-100 shadow-xl">
            <div className="card-body">
              <h2 className="card-title text-sm opacity-60">Total Value</h2>
              <p className="text-2xl font-bold text-success">
                {formatCurrency(totalProfit, priceData.chaosToDivineRatio)}
              </p>
            </div>
          </div>
        </div>

        {/* Price Source Toggle */}
        <div className="card bg-base-100 shadow-xl">
          <div className="card-body">
            <Flex className="items-center justify-between">
              <div>
                <h2 className="card-title">Cards Obtained</h2>
                <p className="text-sm text-base-content/60 mt-1">
                  Viewing {priceSource === "exchange" ? "Exchange" : "Stash"}{" "}
                  prices
                  {session.priceSnapshot && " (Snapshot)"}
                </p>
              </div>

              <div className="flex gap-2">
                <Button
                  variant={priceSource === "exchange" ? "primary" : "ghost"}
                  onClick={() => setPriceSource("exchange")}
                >
                  <GiCardExchange />
                  Exchange
                </Button>
                <Button
                  variant={priceSource === "stash" ? "primary" : "ghost"}
                  onClick={() => setPriceSource("stash")}
                >
                  <GiLockedChest />
                  Stash
                </Button>
              </div>
            </Flex>

            <div className="divider"></div>

            {cardData.length === 0 ? (
              <div className="text-center py-12 text-base-content/50">
                <p>No cards in this session</p>
              </div>
            ) : (
              <Table
                data={cardData}
                columns={columns}
                enableSorting={true}
                enablePagination={true}
                pageSize={20}
                hoverable={true}
                initialSorting={[{ id: "totalValue", desc: true }]}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default SessionDetailsPage;
