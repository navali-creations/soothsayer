import { Search } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

export const CardsActions = () => {
  const {
    cards: { searchQuery, rarityFilter, setSearchQuery, setRarityFilter },
  } = useBoundStore();

  return (
    <div className="flex flex-wrap gap-2">
      {/* Search */}
      <Search
        size="sm"
        placeholder="Search cards..."
        className="flex-1 w-[150px]"
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* Rarity Filter */}
      <select
        className="select select-sm select-bordered w-[150px]"
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
    </div>
  );
};
