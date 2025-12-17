import { useEffect } from "react";
import { useBoundStore } from "../../store/store";
import DivinationCard from "../../components/DivinationCard/DivinationCard";
import type { CardEntry } from "../../../types/data-stores";
import { GiCardRandom } from "react-icons/gi";
import clsx from "clsx";

const CardsPage = () => {
  const { settings, cards } = useBoundStore();
  const activeGame = settings.getActiveGame();

  const {
    loadCards,
    setSearchQuery,
    setRarityFilter,
    setSortField,
    toggleSortDirection,
    setCurrentPage,
    getPaginatedCards,
    getFilteredAndSortedCards,
    getTotalPages,
    getIsLoading,
  } = cards;

  const {
    allCards,
    searchQuery,
    rarityFilter,
    sortField,
    sortDirection,
    currentPage,
  } = useBoundStore((state) => state.cards);

  const paginatedCards = getPaginatedCards();
  const filteredCards = getFilteredAndSortedCards();
  const totalPages = getTotalPages();
  const isLoading = getIsLoading();

  // Fetch cards on mount or when active game changes
  useEffect(() => {
    if (activeGame) {
      loadCards(activeGame);
    }
  }, [activeGame, loadCards]);

  // Convert to CardEntry format for DivinationCard component
  const convertToCardEntry = (card: any): CardEntry => ({
    name: card.name,
    count: 0, // No count for gallery view
    processedIds: [],
    divinationCard: {
      id: card.id,
      stackSize: card.stackSize,
      description: card.description,
      rewardHtml: card.rewardHtml,
      artSrc: card.artSrc,
      flavourHtml: card.flavourHtml,
      rarity: card.rarity,
    },
  });

  const getRarityLabel = (rarity: number) => {
    switch (rarity) {
      case 1:
        return "Extremely Rare";
      case 2:
        return "Rare";
      case 3:
        return "Less Common";
      case 4:
        return "Common";
      default:
        return "Unknown";
    }
  };

  const getRarityColor = (rarity: number) => {
    switch (rarity) {
      case 1:
        return "text-blue-500";
      case 2:
        return "text-purple-500";
      case 3:
        return "text-cyan-500";
      case 4:
        return "text-gray-400";
      default:
        return "text-gray-400";
    }
  };

  if (!activeGame) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <GiCardRandom className="text-6xl mx-auto mb-4 text-base-content/50" />
          <h2 className="text-xl font-bold mb-2">No Game Selected</h2>
          <p className="text-sm text-base-content/70">
            Please select a game from settings
          </p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg mb-4"></div>
          <p className="text-sm text-base-content/70">Loading cards...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-6 gap-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Divination Cards</h1>
          <p className="text-sm text-base-content/70">
            {filteredCards.length} of {allCards.length} cards
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="flex flex-wrap gap-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search cards..."
          className="input input-bordered flex-1 min-w-[200px]"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />

        {/* Rarity Filter */}
        <select
          className="select select-bordered"
          value={rarityFilter}
          onChange={(e) =>
            setRarityFilter(
              e.target.value === "all" ? "all" : parseInt(e.target.value),
            )
          }
        >
          <option value="all">All Rarities</option>
          <option value="1">Extremely Rare</option>
          <option value="2">Rare</option>
          <option value="3">Less Common</option>
          <option value="4">Common</option>
        </select>

        {/* Sort */}
        <div className="flex gap-2">
          <select
            className="select select-bordered"
            value={sortField}
            onChange={(e) => setSortField(e.target.value as any)}
          >
            <option value="name">Name</option>
            <option value="rarity">Rarity</option>
            <option value="stackSize">Stack Size</option>
          </select>

          <button
            className="btn btn-square"
            onClick={toggleSortDirection}
            title={sortDirection === "asc" ? "Ascending" : "Descending"}
          >
            {sortDirection === "asc" ? "↑" : "↓"}
          </button>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="flex-1 overflow-y-auto">
        {paginatedCards.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <GiCardRandom className="text-6xl mx-auto mb-4 text-base-content/50" />
              <h2 className="text-xl font-bold mb-2">No Cards Found</h2>
              <p className="text-sm text-base-content/70">
                Try adjusting your filters
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6 pb-4">
            {paginatedCards.map((card) => (
              <div key={card.id} className="flex flex-col items-center gap-2">
                <div className="w-full flex justify-center">
                  <div className="scale-70 origin-top -mb-24">
                    <DivinationCard card={convertToCardEntry(card)} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            className="btn btn-sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Previous
          </button>

          <div className="flex gap-1">
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              let pageNum: number;
              if (totalPages <= 7) {
                pageNum = i + 1;
              } else if (currentPage <= 4) {
                pageNum = i + 1;
              } else if (currentPage >= totalPages - 3) {
                pageNum = totalPages - 6 + i;
              } else {
                pageNum = currentPage - 3 + i;
              }

              return (
                <button
                  key={pageNum}
                  className={clsx(
                    "btn btn-sm",
                    currentPage === pageNum && "btn-primary",
                  )}
                  onClick={() => setCurrentPage(pageNum)}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>

          <button
            className="btn btn-sm"
            onClick={() =>
              setCurrentPage(Math.min(totalPages, currentPage + 1))
            }
            disabled={currentPage === totalPages}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default CardsPage;
