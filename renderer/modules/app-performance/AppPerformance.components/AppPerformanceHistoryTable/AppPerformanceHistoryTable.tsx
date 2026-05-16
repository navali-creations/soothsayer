import { useNavigate } from "@tanstack/react-router";
import type { Row } from "@tanstack/react-table";
import { useMemo } from "react";
import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { Button, Table } from "~/renderer/components";
import { useChartColors } from "~/renderer/hooks";
import { useAppPerformanceShallow } from "~/renderer/store";

import type { AppPerformanceCaptureSummaryDTO } from "../../AppPerformance.types";
import { createAppPerformanceHistoryColumns } from "./AppPerformanceHistoryTable.utils";

interface AppPerformanceHistoryTableProps {
  title?: string;
}

export function AppPerformanceHistoryTable({
  title = "History",
}: AppPerformanceHistoryTableProps) {
  const navigate = useNavigate();
  const colors = useChartColors();
  const {
    captures,
    deleteMode,
    deletingCaptureId,
    isLoading,
    page,
    pageSize,
    selectedCaptureIds,
    total,
    totalPages,
    loadCaptureHistory,
    toggleAllVisibleCaptureSelection,
    toggleCaptureSelection,
  } = useAppPerformanceShallow((appPerformance) => ({
    captures: appPerformance.captureHistory,
    deleteMode: appPerformance.deleteMode,
    deletingCaptureId: appPerformance.deletingCaptureId,
    isLoading: appPerformance.isLoadingHistory,
    page: appPerformance.captureHistoryPage,
    pageSize: appPerformance.captureHistoryPageSize,
    selectedCaptureIds: appPerformance.selectedCaptureIds,
    total: appPerformance.captureHistoryTotal,
    totalPages: appPerformance.captureHistoryTotalPages,
    loadCaptureHistory: appPerformance.loadCaptureHistory,
    toggleAllVisibleCaptureSelection:
      appPerformance.toggleAllVisibleCaptureSelection,
    toggleCaptureSelection: appPerformance.toggleCaptureSelection,
  }));
  const showingFrom = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const showingTo = Math.min(page * pageSize, total);
  const selectedCaptureIdSet = useMemo(
    () => new Set(selectedCaptureIds),
    [selectedCaptureIds],
  );
  const selectableCaptures = useMemo(
    () => captures.filter((capture) => capture.stoppedAt !== null),
    [captures],
  );
  const allVisibleSelected =
    selectableCaptures.length > 0 &&
    selectableCaptures.every((capture) => selectedCaptureIdSet.has(capture.id));
  const columns = useMemo(
    () =>
      createAppPerformanceHistoryColumns({
        deleteMode,
        selectedCaptureIdSet,
        allVisibleSelected,
        selectableCount: selectableCaptures.length,
        deletingCaptureId,
        onToggleCaptureSelection: toggleCaptureSelection,
        onToggleAllVisibleCaptureSelection: toggleAllVisibleCaptureSelection,
        colors,
      }),
    [
      allVisibleSelected,
      colors,
      deleteMode,
      deletingCaptureId,
      selectableCaptures.length,
      selectedCaptureIdSet,
      toggleAllVisibleCaptureSelection,
      toggleCaptureSelection,
    ],
  );
  const handlePreviousPage = () => {
    void loadCaptureHistory(page - 1);
  };
  const handleNextPage = () => {
    void loadCaptureHistory(page + 1);
  };
  const handleCaptureRowClick = (row: Row<AppPerformanceCaptureSummaryDTO>) => {
    void navigate({
      to: "/app-performance/$captureId",
      params: { captureId: row.original.id },
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-semibold">{title}</span>
        {isLoading && (
          <span className="loading loading-spinner loading-xs text-base-content/40" />
        )}
      </div>

      {captures.length === 0 ? (
        <p className="rounded-md border border-base-content/10 px-3 py-2 text-sm text-base-content/50">
          No diagnostics captures yet.
        </p>
      ) : (
        <Table
          data={captures}
          columns={columns}
          className="text-xs [&_tbody_tr]:transition-colors [&_tbody_tr:hover]:bg-white/[0.05] [&_td]:px-2 [&_thead_th]:px-2.5 [&_thead_th]:py-2 [&_thead_th]:text-[0.68rem]"
          compact
          enableSorting={false}
          hoverable={!deleteMode}
          onRowClick={deleteMode ? undefined : handleCaptureRowClick}
        />
      )}

      {total > pageSize && (
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-xs text-base-content/60">
            Showing {showingFrom} to {showingTo} of {total}
          </span>
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={page <= 1 || isLoading}
              onClick={handlePreviousPage}
            >
              <FiChevronLeft />
            </Button>
            <span className="px-2 text-xs tabular-nums text-base-content/60">
              Page {page} of {totalPages}
            </span>
            <Button
              type="button"
              variant="ghost"
              size="xs"
              disabled={page >= totalPages || isLoading}
              onClick={handleNextPage}
            >
              <FiChevronRight />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
