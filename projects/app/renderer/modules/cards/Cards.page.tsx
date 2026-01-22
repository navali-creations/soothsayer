import { useEffect } from "react";
import { useBoundStore } from "../../store/store";
import { PageContainer } from "../../components";
import { CardsActions, CardsGrid, CardsPagination } from "./Cards.components";

const CardsPage = () => {
  const {
    cards: {
      allCards,
      loadCards,
      getPaginatedCards,
      getFilteredAndSortedCards,
      getTotalPages,
    },
  } = useBoundStore();

  const paginatedCards = getPaginatedCards();
  const filteredCards = getFilteredAndSortedCards();
  const totalPages = getTotalPages();

  // Fetch cards on mount
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  return (
    <PageContainer>
      <PageContainer.Header
        title="Divination Cards"
        subtitle={`${filteredCards.length} of ${allCards.length} cards`}
        actions={<CardsActions />}
      />
      <PageContainer.Content>
        <div className="flex-1 overflow-y-auto">
          <CardsGrid cards={paginatedCards} />
        </div>
        <CardsPagination totalPages={totalPages} />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardsPage;
