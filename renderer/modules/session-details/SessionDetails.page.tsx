import { useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { FiArrowLeft } from "react-icons/fi";

import { Button, PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import {
  SessionDetailsActions,
  SessionDetailsStats,
  SessionDetailsTable,
} from "./SessionDetails.components";
import type { CardEntry } from "./SessionDetails.types";

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
    if (!session || !session.startedAt) return "—";

    const start = new Date(session.startedAt);

    // If session has no endedAt, it might be corrupted or still active
    if (!session.endedAt) {
      return "Unknown (Corrupted)";
    }

    const end = new Date(session.endedAt);
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

    return session.cards
      .map((entry) => {
        const priceInfo =
          priceSource === "exchange" ? entry.exchangePrice : entry.stashPrice;

        const chaosValue = priceInfo?.chaosValue || 0;
        const totalValue = priceInfo?.totalValue || 0;
        const hidePrice = priceInfo?.hidePrice || false;

        return {
          name: entry.name,
          count: entry.count,
          ratio: (entry.count / session.totalCount) * 100,
          chaosValue,
          totalValue,
          hidePrice,
          divinationCard: entry.divinationCard,
        };
      })
      .sort((a, b) => b.count - a.count);
  }, [session, priceSource]);

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

  // Calculate net profit (total value minus stacked deck cost)
  const { netProfit, totalDeckCost } = useMemo(() => {
    const deckCost = session?.priceSnapshot?.stackedDeckChaosCost ?? 0;
    const deckCount = session?.totalCount ?? 0;
    const cost = deckCost * deckCount;
    return {
      netProfit: totalProfit - cost,
      totalDeckCost: cost,
    };
  }, [totalProfit, session]);

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
    <PageContainer>
      <PageContainer.Header
        title="Session Details"
        subtitle={
          <>
            {session.league} • {new Date(session.startedAt!).toLocaleString()}
          </>
        }
        actions={<SessionDetailsActions />}
      />
      <PageContainer.Content>
        <SessionDetailsStats
          duration={calculateDuration()}
          totalCount={session.totalCount}
          mostCommonCard={mostCommonCard}
          totalProfit={totalProfit}
          netProfit={netProfit}
          totalDeckCost={totalDeckCost}
          chaosToDivineRatio={priceData.chaosToDivineRatio}
        />
        <SessionDetailsTable
          cardData={cardData}
          chaosToDivineRatio={priceData.chaosToDivineRatio}
          priceSource={priceSource}
        />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default SessionDetailsPage;
