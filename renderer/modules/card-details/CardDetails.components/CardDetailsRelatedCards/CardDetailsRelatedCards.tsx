import { FiGitBranch, FiLink } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

import RelatedCardsSection from "./RelatedCardsSection";

const CardDetailsRelatedCards = () => {
  const {
    cardDetails: { relatedCards, isLoadingRelatedCards },
  } = useBoundStore();

  if (isLoadingRelatedCards || !relatedCards) return null;

  const { similarCards, chainCards } = relatedCards;

  if (similarCards.length === 0 && chainCards.length === 0) return null;

  return (
    <div className="bg-base-200 rounded-lg p-4 space-y-4">
      {/* Card Chain section */}
      <RelatedCardsSection
        title="Card Chain"
        icon={<FiGitBranch className="w-3 h-3" />}
        cards={chainCards}
      />

      {/* Similar Cards section */}
      <RelatedCardsSection
        title="Similar Cards"
        icon={<FiLink className="w-3 h-3" />}
        cards={similarCards}
      />
    </div>
  );
};

export default CardDetailsRelatedCards;
