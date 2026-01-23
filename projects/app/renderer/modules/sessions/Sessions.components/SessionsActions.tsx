import { type ChangeEvent, useEffect, useState } from "react";
import { useBoundStore } from "~/renderer/store";
import { Flex, Search } from "../../../components";
import { useDebounce } from "../../../hooks";

export const SessionsActions = () => {
  const {
    sessions: {
      getUniqueLeagues,
      getSelectedLeague,
      setSelectedLeague,
      getSearchQuery,
      loadAllSessions,
      searchSessions,
    },
  } = useBoundStore();

  const uniqueLeagues = getUniqueLeagues();
  const selectedLeague = getSelectedLeague();
  const storedSearchQuery = getSearchQuery();

  const [searchQuery, setSearchQuery] = useState(storedSearchQuery);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    const trimmedQuery = debouncedSearchQuery.trim();

    if (trimmedQuery) {
      searchSessions(trimmedQuery, 1);
    } else {
      // Only reload all if we had a previous search
      loadAllSessions(1);
    }
  }, [debouncedSearchQuery, loadAllSessions, searchSessions]);

  const handleLeagueChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedLeague(e.target.value);
  };

  return (
    <Flex className="gap-2 items-center">
      {/* Search Input */}
      <Search
        size="sm"
        className="w-[170px]"
        placeholder="Search by card name..."
        value={searchQuery}
        onChange={setSearchQuery}
      />

      {/* League Filter Dropdown */}
      <select
        className="select select-sm select-bordered w-[120px]"
        value={selectedLeague}
        onChange={handleLeagueChange}
      >
        {uniqueLeagues.map((league) => (
          <option key={league} value={league}>
            {league === "all" ? "All Leagues" : league}
          </option>
        ))}
      </select>
    </Flex>
  );
};
