import { type ChangeEvent, useCallback, useEffect } from "react";
import { FiDownload, FiMoreHorizontal, FiTrash2, FiX } from "react-icons/fi";

import { Flex, Search } from "~/renderer/components";
import { useDebounce } from "~/renderer/hooks";
import { useSessions, useSettings } from "~/renderer/store";

import {
  generateRichCsv,
  generateSimpleCsv,
} from "../../Sessions.utils/Sessions.export";
import { SessionsDeleteConfirmModal } from "../SessionsDeleteConfirmModal/SessionsDeleteConfirmModal";

export const SessionsActions = () => {
  const {
    getUniqueLeagues,
    getSelectedLeague,
    setSelectedLeague,
    getSearchQuery,
    setSearchQuery: setStoredSearchQuery,
    loadAllSessions,
    searchSessions,
    getIsBulkMode,
    getBulkMode,
    setBulkMode,
    getSelectedSessionIds,
    getSelectedCount,
    selectAll,
    clearSelection,
    getTotalSessions,
    openDeleteConfirm,
    closeDeleteConfirm,
    setDeleteError,
    setIsDeleting,
    getIsDeleteConfirmOpen,
    getDeleteError,
    getIsDeleting,
  } = useSessions();
  const { getSelectedGame } = useSettings();

  const uniqueLeagues = getUniqueLeagues();
  const selectedLeague = getSelectedLeague();
  const searchQuery = getSearchQuery();
  const isBulkMode = getIsBulkMode();
  const bulkMode = getBulkMode();
  const isDeleteMode = bulkMode === "delete";
  const selectedCount = getSelectedCount();
  const totalSessions = getTotalSessions();
  const allSelected = selectedCount > 0 && selectedCount >= totalSessions;
  const isDeleteConfirmOpen = getIsDeleteConfirmOpen();
  const deleteError = getDeleteError();
  const isDeleting = getIsDeleting();
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

    if (bulkMode === "export-rich") {
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
  }, [allSelected, bulkMode, getSelectedSessionIds, getSelectedGame]);

  const handleCancel = useCallback(() => {
    setBulkMode(null);
  }, [setBulkMode]);

  const handleOpenDeleteConfirm = useCallback(() => {
    openDeleteConfirm();
  }, [openDeleteConfirm]);

  const handleCloseDeleteConfirm = useCallback(() => {
    closeDeleteConfirm();
  }, [closeDeleteConfirm]);

  const handleConfirmDelete = useCallback(async () => {
    const selectedIds = getSelectedSessionIds();
    if (selectedIds.length === 0) return;

    setIsDeleting(true);
    setDeleteError(null);

    try {
      const result = await window.electron.sessions.deleteSessions(
        getSelectedGame(),
        selectedIds,
      );
      if (!result.success) {
        setDeleteError(result.error);
        return;
      }

      closeDeleteConfirm();
      clearSelection();
      setBulkMode(null);
      const trimmedQuery = searchQuery.trim();
      if (trimmedQuery) {
        await searchSessions(trimmedQuery, 1);
      } else {
        await loadAllSessions(1);
      }
    } catch (error) {
      setDeleteError((error as Error).message);
    } finally {
      setIsDeleting(false);
    }
  }, [
    clearSelection,
    closeDeleteConfirm,
    getSelectedGame,
    getSelectedSessionIds,
    loadAllSessions,
    searchQuery,
    searchSessions,
    setBulkMode,
    setDeleteError,
    setIsDeleting,
  ]);

  const exportLabel =
    bulkMode === "export-rich"
      ? `Export Rich CSV (${selectedCount})`
      : `Export Simple CSV (${selectedCount})`;

  return (
    <Flex className="gap-2 items-center">
      <Search
        size="sm"
        className="w-[170px]"
        placeholder="Search by card name..."
        value={searchQuery}
        onChange={setStoredSearchQuery}
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
        {isBulkMode ? (
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

            {isDeleteMode ? (
              <button
                className="btn btn-sm btn-error gap-1"
                disabled={selectedCount === 0}
                onClick={handleOpenDeleteConfirm}
              >
                <FiTrash2 size={14} />
                Delete sessions ({selectedCount})
              </button>
            ) : (
              <button
                className="btn btn-sm btn-primary gap-1"
                disabled={selectedCount === 0}
                onClick={handleExport}
              >
                <FiDownload size={14} />
                {exportLabel}
              </button>
            )}
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
                <button onClick={() => setBulkMode("export-simple")}>
                  <FiDownload size={14} />
                  Export Simple CSV
                </button>
              </li>
              <li
                className="tooltip tooltip-left"
                data-tip="Full session details per row"
              >
                <button onClick={() => setBulkMode("export-rich")}>
                  <FiDownload size={14} />
                  Export Rich CSV
                </button>
              </li>
              <li>
                <button
                  className="text-error"
                  onClick={() => setBulkMode("delete")}
                >
                  <FiTrash2 size={14} />
                  Delete sessions
                </button>
              </li>
            </ul>
          </div>
        )}
      </div>
      <SessionsDeleteConfirmModal
        error={deleteError}
        isDeleting={isDeleting}
        isOpen={isDeleteConfirmOpen}
        selectedCount={selectedCount}
        onCancel={handleCloseDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </Flex>
  );
};
