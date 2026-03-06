import { useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useRef } from "react";

import { PageContainer } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useBoundStore } from "~/renderer/store";
import type { CardEntry } from "~/types/data-stores";

import CardDetailsError from "./CardDetails.components/CardDetailsError";
import { CardDetailsExternalLinks } from "./CardDetails.components/CardDetailsExternalLinks";
import CardDetailsHeader from "./CardDetails.components/CardDetailsHeader";
import CardDetailsLoading from "./CardDetails.components/CardDetailsLoading";
import CardDetailsRelatedCards from "./CardDetails.components/CardDetailsRelatedCards";
import CardDetailsVisual from "./CardDetails.components/CardDetailsVisual";
import MarketTabContent from "./CardDetails.components/MarketTabContent";
import YourDataTabContent from "./CardDetails.components/YourDataTabContent";

const CardDetailsPage = () => {
  const { cardSlug } = useParams({ from: "/cards/$cardSlug" });

  const {
    settings: { getSelectedGame, getActiveGameViewSelectedLeague },
    cardDetails: {
      card,
      isLoadingCard,
      cardError,
      initializeCardDetails,
      refreshPersonalAnalytics,
      fetchPriceHistory,
      clearCardDetails,
      isLoadingPersonalAnalytics,
      isLeagueSwitching,
      selectedLeague,
      setSelectedLeague,
      activeTab,
      getDisplayRarity,
    },
    prohibitedLibrary: { poe1Status, poe2Status, fetchStatus: fetchPlStatus },
  } = useBoundStore();

  const game = getSelectedGame();
  const globalLeague = getActiveGameViewSelectedLeague();

  // ─── PL League Resolution ──────────────────────────────────────────────
  //
  // Resolve the PL league to use for rarity lookups.
  // PL data is always keyed by a challenge league (never "Standard").
  // The canonical source is plStatus.league from the PL metadata.
  //
  // Resolution order:
  //   1. User picked a specific challenge league → use it directly.
  //   2. "all" / "Standard" / anything else → use plStatus.league.
  const plStatusForGame = game === "poe1" ? poe1Status : poe2Status;

  const plLeague = useMemo(() => {
    const plMetadataLeague = plStatusForGame?.league ?? null;

    if (
      selectedLeague !== "all" &&
      selectedLeague.toLowerCase() !== "standard"
    ) {
      return selectedLeague;
    }

    return plMetadataLeague;
  }, [selectedLeague, plStatusForGame]);

  // ─── Lazy-load PL status ───────────────────────────────────────────────
  // PL data is lazy-loaded — only fetched on pages that need it.

  useEffect(() => {
    if (!plStatusForGame) {
      fetchPlStatus();
    }
  }, [plStatusForGame, fetchPlStatus]);

  // ─── Reset league on card navigation ───────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset on card navigation
  useEffect(() => {
    setSelectedLeague("all");
  }, [cardSlug, setSelectedLeague]);

  // ─── Unified initialization ────────────────────────────────────────────
  //
  // A single effect that resolves the card by slug and fetches personal
  // analytics + related cards in one IPC round-trip. Replaces the previous
  // chain of separate resolveCard / fetchPersonalAnalytics / fetchRelatedCards
  // effects.
  //
  // Re-runs when game, slug, or plLeague changes. The `selectedLeague` is
  // intentionally excluded — league switches use `refreshPersonalAnalytics`
  // instead of a full re-init.

  const hasInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    const initKey = `${game}:${cardSlug}:${plLeague}`;
    if (hasInitializedRef.current === initKey) return;
    hasInitializedRef.current = initKey;

    initializeCardDetails(game, cardSlug, plLeague, selectedLeague);

    // Track card detail view
    trackEvent("card-details:view", { cardSlug });
  }, [game, cardSlug, plLeague, selectedLeague, initializeCardDetails]);

  // ─── League switch → refresh personal analytics only ───────────────────
  //
  // When the user changes the league filter, we only need to re-fetch
  // personal analytics (stats, timeline, sessions are league-scoped).
  // The card itself and related cards don't change.
  //
  // We track the last-fetched key so the initial load (handled above)
  // doesn't trigger a redundant fetch here.

  const lastLeagueFetchRef = useRef<string | null>(null);

  useEffect(() => {
    if (!card) return;

    const fetchKey = `${game}:${plLeague}:${card.name}:${selectedLeague}`;

    // Skip if this is the first render (init already fetched analytics)
    // or if nothing actually changed.
    if (lastLeagueFetchRef.current === null) {
      lastLeagueFetchRef.current = fetchKey;
      return;
    }
    if (lastLeagueFetchRef.current === fetchKey) return;
    lastLeagueFetchRef.current = fetchKey;

    refreshPersonalAnalytics(game, plLeague, card.name, selectedLeague);
  }, [game, plLeague, selectedLeague, card, refreshPersonalAnalytics]);

  // ─── Cleanup on unmount / card change ──────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — clear on card/game change
  useEffect(() => {
    return () => {
      clearCardDetails();
      hasInitializedRef.current = null;
      lastLeagueFetchRef.current = null;
    };
  }, [game, cardSlug, clearCardDetails]);

  // ─── Lazy price fetch on Market tab ────────────────────────────────────
  //
  // Price history is only fetched when the Market Data tab is activated.

  const priceFetchedRef = useRef<string | null>(null);

  useEffect(() => {
    if (activeTab !== "market" || !card || !globalLeague) return;

    const fetchKey = `${game}:${globalLeague}:${card.name}`;
    if (priceFetchedRef.current === fetchKey) return;
    priceFetchedRef.current = fetchKey;

    fetchPriceHistory(game, globalLeague, card.name);
  }, [activeTab, game, globalLeague, card, fetchPriceHistory]);

  // Reset price-fetched tracker when card/game/league changes
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — reset tracker
  useEffect(() => {
    priceFetchedRef.current = null;
  }, [game, cardSlug, globalLeague]);

  // ─── Early returns: loading / error ────────────────────────────────────

  if (isLoadingCard) {
    return <CardDetailsLoading />;
  }

  if (cardError || !card) {
    return <CardDetailsError error={cardError} />;
  }

  // ─── Derived display values ────────────────────────────────────────────

  const displayRarity = getDisplayRarity();

  // Build a CardEntry with the resolved PL rarity for the DivinationCard
  // visual (glow colour and rarity effects).
  const displayCard: CardEntry = {
    name: card.name,
    count: 0,
    divinationCard: {
      id: card.id,
      stackSize: card.stackSize,
      description: card.description,
      rewardHtml: card.rewardHtml,
      artSrc: card.artSrc,
      flavourHtml: card.flavourHtml,
      rarity: displayRarity,
      filterRarity: card.filterRarity,
      fromBoss: card.fromBoss,
    },
  };

  const isYourDataLoading = isLoadingPersonalAnalytics || isLeagueSwitching;

  return (
    <PageContainer>
      <CardDetailsHeader
        cardName={card.name}
        rarity={displayRarity}
        fromBoss={card.fromBoss}
      />
      <PageContainer.Content>
        <div className="grid grid-cols-4 gap-6">
          {/* Left column: Card visual + external links + related cards */}
          <div className="space-y-3">
            <CardDetailsVisual card={displayCard} />
            <CardDetailsExternalLinks cardName={card.name} game={game} />
            <CardDetailsRelatedCards />
          </div>

          {/* Right columns: Tabbed content */}
          <div className="col-span-3 space-y-6">
            {activeTab === "market" && <MarketTabContent />}

            {activeTab === "your-data" && (
              <YourDataTabContent
                cardName={card.name}
                game={game}
                isLoading={isYourDataLoading}
              />
            )}
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardDetailsPage;
