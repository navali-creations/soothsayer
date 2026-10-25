import { useLayoutEffect, useMemo, useRef } from "react";

import { useBoundStore } from "~/renderer/store";
import { cardNameToSlug, toCardMetadata } from "~/renderer/utils";
import type { CardEntry, GameType } from "~/types/data-stores";

import { toCardEntry } from "../../CardDetails.components/CardDetailsRelatedCards/helpers";
import type { CardDetailsSlice } from "../../CardDetails.slice/CardDetails.slice";

interface CardPreview {
  card: CardEntry;
  inPool: boolean;
}

interface UseCardDetailsPreviewOptions {
  game: GameType;
  cardSlug: string;
  relatedCards: CardDetailsSlice["cardDetails"]["relatedCards"];
}

/** Finds immediately available card metadata while the route is resolving. */
export const useCardDetailsPreview = ({
  game,
  cardSlug,
  relatedCards,
}: UseCardDetailsPreviewOptions): CardPreview | null => {
  const allCards = useBoundStore((state) => state.cards.allCards);
  const sessionDetails = useBoundStore((state) => state.sessionDetails.session);
  const currentSession = useBoundStore((state) =>
    game === "poe1"
      ? state.currentSession.poe1Session
      : state.currentSession.poe2Session,
  );
  const cardKey = `${game}:${cardSlug}`;

  const previewCandidate = useMemo(() => {
    const cardsPageCard = allCards.find(
      (candidate) =>
        candidate.game === game && cardNameToSlug(candidate.name) === cardSlug,
    );
    if (cardsPageCard) {
      return {
        card: {
          name: cardsPageCard.name,
          count: 0,
          divinationCard: toCardMetadata(cardsPageCard),
        },
        inPool: cardsPageCard.inPool,
      } satisfies CardPreview;
    }

    const sessionDetailsCard =
      sessionDetails?.game === game
        ? sessionDetails.cards.find(
            (candidate) => cardNameToSlug(candidate.name) === cardSlug,
          )
        : undefined;
    const currentSessionCard = currentSession?.cards.find(
      (candidate) => cardNameToSlug(candidate.name) === cardSlug,
    );
    const sessionCard = sessionDetailsCard ?? currentSessionCard;
    if (sessionCard?.divinationCard) {
      return { card: sessionCard, inPool: true } satisfies CardPreview;
    }

    const relatedCard =
      relatedCards?.chainCards.find(
        (candidate) => cardNameToSlug(candidate.name) === cardSlug,
      ) ??
      relatedCards?.similarCards.find(
        (candidate) => cardNameToSlug(candidate.name) === cardSlug,
      );
    return relatedCard
      ? ({ card: toCardEntry(relatedCard), inPool: true } satisfies CardPreview)
      : null;
  }, [allCards, cardSlug, currentSession, game, relatedCards, sessionDetails]);

  const retainedPreviewRef = useRef<{
    cardKey: string;
    preview: CardPreview | null;
  }>({ cardKey, preview: previewCandidate });
  const retainedPreview =
    retainedPreviewRef.current.cardKey === cardKey
      ? retainedPreviewRef.current.preview
      : null;

  useLayoutEffect(() => {
    if (retainedPreviewRef.current.cardKey !== cardKey) {
      retainedPreviewRef.current = { cardKey, preview: previewCandidate };
      return;
    }
    if (!retainedPreviewRef.current.preview && previewCandidate) {
      retainedPreviewRef.current.preview = previewCandidate;
    }
  }, [cardKey, previewCandidate]);

  return previewCandidate ?? retainedPreview;
};
