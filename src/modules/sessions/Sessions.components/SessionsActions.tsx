import { useState, useEffect, ChangeEvent } from "react";
import { FiSearch } from "react-icons/fi";
import { Flex } from "../../../components";
import { useBoundStore } from "../../../store/store";
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
  }, [
    debouncedSearchQuery,
    loadAllSessions,
    searchSessions,
    storedSearchQuery,
  ]);

  const handleSearchChange = (e: ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleLeagueChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedLeague(e.target.value);
  };

  return (
    <Flex className="gap-2 items-center">
      {/* Search Input */}
      <label className="input input-border input-sm flex items-center gap-2 w-[300px]">
        <FiSearch className="opacity-70" />
        <input
          type="text"
          className="grow"
          placeholder="Search by card name..."
          onChange={handleSearchChange}
        />
      </label>

      {/* League Filter Dropdown */}
      <select
        className="select select-sm select-border"
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
