import { useCallback, useEffect, useRef } from "react";

import { PageContainer } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

import { CardsActions, CardsGrid, CardsPagination } from "./Cards.components";

const CardsPage = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
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

  const scrollToTop = useCallback(() => {
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  // Fetch cards on mount
  useEffect(() => {
    loadCards();
  }, [loadCards]);

  return (
    <PageContainer>
      <PageContainer.Header
        title="Divination Cards"
        subtitle={`${filteredCards.length} of ${allCards.length} cards`}
        actions={<CardsActions onFilterChange={scrollToTop} />}
      />
      <PageContainer.Content className="!overflow-y-hidden flex flex-col">
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <CardsGrid cards={paginatedCards} />
        </div>
        <CardsPagination totalPages={totalPages} onPageChange={scrollToTop} />
      </PageContainer.Content>
    </PageContainer>
  );
};

export default CardsPage;
