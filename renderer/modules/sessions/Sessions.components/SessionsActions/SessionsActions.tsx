import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { FiDownload, FiMoreHorizontal, FiX } from "react-icons/fi";

import { Flex, Search } from "~/renderer/components";
import { useDebounce } from "~/renderer/hooks";
import { useSessions, useSettings } from "~/renderer/store";

import {
  generateRichCsv,
  generateSimpleCsv,
} from "../../Sessions.utils/Sessions.export";

export const SessionsActions = () => {
  const {
    getUniqueLeagues,
    getSelectedLeague,
    setSelectedLeague,
    getSearchQuery,
    loadAllSessions,
    searchSessions,
    getIsExportMode,
    getExportType,
    setExportType,
    getSelectedSessionIds,
    getSelectedCount,
    selectAll,
    clearSelection,
    getTotalSessions,
  } = useSessions();
  const { getSelectedGame } = useSettings();

  const uniqueLeagues = getUniqueLeagues();
  const selectedLeague = getSelectedLeague();
  const storedSearchQuery = getSearchQuery();
  const isExportMode = getIsExportMode();
  const exportType = getExportType();
  const selectedCount = getSelectedCount();
  const totalSessions = getTotalSessions();
  const allSelected = selectedCount > 0 && selectedCount >= totalSessions;

  const [searchQuery, setSearchQuery] = useState(storedSearchQuery);
  const debouncedSearchQuery = useDebounce(searchQuery, 300);

  useEffect(() => {
    const trimmedQuery = debouncedSearchQuery.trim();
    if (trimmedQuery) {
      searchSessions(trimmedQuery, 1);
    } else {
      loadAllSessions(1);
    }
  }, [debouncedSearchQuery, loadAllSessions, searchSessions]);

  const handleLeagueChange = (e: ChangeEvent<HTMLSelectElement>) => {
    setSelectedLeague(e.target.value);
  };

  const handleExport = useCallback(async () => {
    const selectedIds = getSelectedSessionIds();
    if (selectedIds.length === 0) return;

    let csv: string;
    let filename: string;
    const dateSuffix = new Date().toISOString().split("T")[0];
    const activeGame = getSelectedGame();
    const exportSessionIds = allSelected ? null : selectedIds;

    if (exportType === "rich") {
      const selected = await window.electron.sessions.getRichExportRows(
        activeGame,
        exportSessionIds,
      );
      csv = generateRichCsv(selected);
      filename = `sessions-rich-${dateSuffix}.csv`;
    } else {
      const cardDrops = await window.electron.sessions.getSimpleExportRows(
        activeGame,
        exportSessionIds,
      );
      csv = generateSimpleCsv(cardDrops);
      filename = `sessions-simple-${dateSuffix}.csv`;
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }, [allSelected, exportType, getSelectedSessionIds, getSelectedGame]);

  const handleCancel = useCallback(() => {
    setExportType(null);
  }, [setExportType]);

  const exportLabel =
    exportType === "rich"
      ? `Export Rich CSV (${selectedCount})`
      : `Export Simple CSV (${selectedCount})`;

  return (
    <Flex className="gap-2 items-center">
      <Search
        size="sm"
        className="w-[170px]"
        placeholder="Search by card name..."
        value={searchQuery}
        onChange={setSearchQuery}
      />
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

      <div className="ml-auto flex gap-2 items-center">
        {isExportMode ? (
          <>
            <button
              className="btn btn-sm btn-outline btn-error gap-1"
              onClick={handleCancel}
            >
              <FiX size={14} />
              Cancel
            </button>

            <button
              className="btn btn-sm btn-outline"
              onClick={allSelected ? clearSelection : selectAll}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </button>

            <button
              className="btn btn-sm btn-primary gap-1"
              disabled={selectedCount === 0}
              onClick={handleExport}
            >
              <FiDownload size={14} />
              {exportLabel}
            </button>
          </>
        ) : (
          <div className="dropdown dropdown-end z-50">
            <label tabIndex={0} className="btn btn-sm btn-primary btn-square">
              <FiMoreHorizontal size={16} />
            </label>
            <ul
              tabIndex={0}
              className="dropdown-content menu p-2 shadow-lg bg-base-200 rounded-box w-48"
            >
              <li
                className="tooltip tooltip-left"
                data-tip="Card name + total amount"
              >
                <button onClick={() => setExportType("simple")}>
                  <FiDownload size={14} />
                  Export Simple CSV
                </button>
              </li>
              <li
                className="tooltip tooltip-left"
                data-tip="Full session details per row"
              >
                <button onClick={() => setExportType("rich")}>
                  <FiDownload size={14} />
                  Export Rich CSV
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
    </Flex>
  );
};
