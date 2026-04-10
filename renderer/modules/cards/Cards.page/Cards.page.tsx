import { useCallback, useEffect, useMemo, useRef } from "react";

import { PageContainer } from "~/renderer/components";
import { useCards } from "~/renderer/store";

import { CardsActions, CardsGrid, CardsPagination } from "../Cards.components";

const CardsPage = () => {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const {
    allCards,
    loadCards,
    getFilteredAndSortedCards,
    currentPage,
    pageSize,
  } = useCards();

  // Compute the filtered + sorted list once per render.
  // getPaginatedCards() and getTotalPages() used to call this again internally;
  // deriving pagination inline avoids two redundant filter+sort passes.
  const filteredCards = getFilteredAndSortedCards();
  const totalPages = Math.ceil(filteredCards.length / pageSize);
  const paginatedCards = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCards.slice(start, start + pageSize);
  }, [filteredCards, currentPage, pageSize]);

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
