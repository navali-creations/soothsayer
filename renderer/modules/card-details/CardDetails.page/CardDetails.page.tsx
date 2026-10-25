import { useParams } from "@tanstack/react-router";
import { useEffect, useRef } from "react";

import { PageContainer } from "~/renderer/components";
import { useCardDetails, useSettings } from "~/renderer/store";
import { toCardMetadata } from "~/renderer/utils";
import type { CardEntry } from "~/types/data-stores";

import CardDetailsError from "../CardDetails.components/CardDetailsError";
import { CardDetailsExternalLinks } from "../CardDetails.components/CardDetailsExternalLinks/CardDetailsExternalLinks";
import CardDetailsHeader from "../CardDetails.components/CardDetailsHeader";
import CardDetailsRelatedCards from "../CardDetails.components/CardDetailsRelatedCards";
import CardDetailsVisual from "../CardDetails.components/CardDetailsVisual";
import YourDataTabContent from "../CardDetails.components/YourDataTabContent/YourDataTabContent";
import { useCardDetailsPreview } from "../CardDetails.hooks/useCardDetailsPreview/useCardDetailsPreview";

const CardDetailsPage = () => {
  const { cardSlug } = useParams({ from: "/cards/$cardSlug" });

  const { getSelectedGame, getActiveGameViewSelectedLeague } = useSettings();
  const {
    card,
    isLoadingCard,
    cardError,
    initializeCardDetails,
    clearCardDetails,
    isLoadingPersonalAnalytics,
    selectedLeague,
    getDisplayRarity,
    fetchCommunityDropRate,
    relatedCards,
    activeCardKey,
  } = useCardDetails();

  const game = getSelectedGame();
  const globalLeague = getActiveGameViewSelectedLeague();
  const cardKey = `${game}:${cardSlug}`;
  const cardPreview = useCardDetailsPreview({ game, cardSlug, relatedCards });
  const isNewCard = activeCardKey !== cardKey;
  const shouldFallbackToAll =
    !isNewCard &&
    !isLoadingCard &&
    selectedLeague !== "all" &&
    card !== null &&
    !card.inPool;
  const effectiveSelectedLeague = shouldFallbackToAll ? "all" : selectedLeague;
  const communityLeague =
    effectiveSelectedLeague === "all" ? globalLeague : effectiveSelectedLeague;
  const animationKey = `${cardKey}:${effectiveSelectedLeague}`;

  // ─── Unified initialization ────────────────────────────────────────────
  //
  // A single effect that resolves the card by slug and fetches personal
  // analytics + related cards in one IPC round-trip. Replaces the previous
  // chain of separate card, analytics, and related-card effects.
  //
  // Re-runs when game, slug, or selectedLeague changes.

  const hasInitializedRef = useRef<string | null>(null);

  useEffect(() => {
    const initKey = `${cardKey}:${effectiveSelectedLeague}:${communityLeague}`;
    if (hasInitializedRef.current === initKey) return;
    hasInitializedRef.current = initKey;

    initializeCardDetails(
      game,
      cardSlug,
      effectiveSelectedLeague,
      communityLeague,
    );
  }, [
    game,
    cardSlug,
    cardKey,
    effectiveSelectedLeague,
    communityLeague,
    initializeCardDetails,
  ]);

  // ─── Cleanup on unmount / card change ──────────────────────────────────
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentional — clear on card/game change
  useEffect(() => {
    return () => {
      clearCardDetails();
      hasInitializedRef.current = null;
    };
  }, [game, cardSlug, clearCardDetails]);

  useEffect(() => {
    if (isNewCard || shouldFallbackToAll || !card || !communityLeague) return;
    fetchCommunityDropRate(game, communityLeague, card.name);
  }, [
    card,
    communityLeague,
    fetchCommunityDropRate,
    game,
    isNewCard,
    shouldFallbackToAll,
  ]);

  // ─── Early returns: loading / error ────────────────────────────────────

  if (cardError && !isNewCard) {
    return <CardDetailsError error={cardError} />;
  }

  // ─── Derived display values ────────────────────────────────────────────

  const resolvedCard = isNewCard ? null : card;
  const previewMetadata = cardPreview?.card.divinationCard;
  const previewRarity =
    previewMetadata?.prohibitedLibraryRarity &&
    previewMetadata.prohibitedLibraryRarity > 0
      ? previewMetadata.prohibitedLibraryRarity
      : previewMetadata?.rarity;
  const displayRarity = resolvedCard ? getDisplayRarity() : previewRarity;

  // Build a CardEntry with the resolved PL rarity for the DivinationCard
  // visual (glow colour and rarity effects).
  const displayCard: CardEntry | null =
    resolvedCard && displayRarity !== undefined
      ? {
          name: resolvedCard.name,
          count: 0,
          divinationCard: toCardMetadata(resolvedCard, {
            rarity: displayRarity,
            filterRarity: resolvedCard.filterRarity,
          }),
        }
      : (cardPreview?.card ?? null);
  const displayInPool = resolvedCard?.inPool ?? cardPreview?.inPool;

  const isYourDataLoading =
    isNewCard || isLoadingCard || isLoadingPersonalAnalytics;

  return (
    <PageContainer>
      <CardDetailsHeader
        animationKey={animationKey}
        cardName={displayCard?.name}
        rarity={displayRarity}
        fromBoss={displayCard?.divinationCard?.fromBoss}
        isDisabled={displayCard?.divinationCard?.isDisabled}
        inPool={displayInPool}
      />
      <PageContainer.Content animationKey={animationKey}>
        <div className="grid grid-cols-4 gap-6">
          {/* Left column: Card visual + external links + related cards */}
          <div className="space-y-3">
            {displayCard && (
              <>
                <CardDetailsVisual card={displayCard} />
                <CardDetailsExternalLinks
                  cardName={displayCard.name}
                  game={game}
                  league={communityLeague}
                />
                <CardDetailsRelatedCards />
              </>
            )}
          </div>

          {/* Right columns: Personal analytics */}
          <div className="col-span-3 space-y-6">
            <YourDataTabContent
              cardName={displayCard?.name ?? ""}
              game={game}
              isLoading={isYourDataLoading}
            />
          </div>
        </div>
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardDetailsPage;
