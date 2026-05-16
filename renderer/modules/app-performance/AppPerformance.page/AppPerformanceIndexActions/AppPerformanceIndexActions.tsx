import { FiMoreHorizontal, FiPlay, FiTrash2, FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useAppPerformanceShallow } from "~/renderer/store";

import { useStartAppPerformanceCapture } from "../useStartAppPerformanceCapture/useStartAppPerformanceCapture";

export function AppPerformanceIndexActions() {
  const handleStartDiagnostics = useStartAppPerformanceCapture();
  const {
    captureHistory,
    captureHistoryTotal,
    deleteMode,
    indexView,
    isBulkDeleting,
    isSampling,
    isStartingCapture,
    selectedCaptureIds,
    cancelDeleteMode,
    openDeleteConfirm,
    setIndexView,
    startDeleteMode,
    toggleAllVisibleCaptureSelection,
  } = useAppPerformanceShallow((appPerformance) => ({
    captureHistory: appPerformance.captureHistory,
    captureHistoryTotal: appPerformance.captureHistoryTotal,
    deleteMode: appPerformance.deleteMode,
    indexView: appPerformance.indexView,
    isBulkDeleting: appPerformance.isBulkDeleting,
    isSampling: appPerformance.isSampling,
    isStartingCapture: appPerformance.isStartingCapture,
    selectedCaptureIds: appPerformance.selectedCaptureIds,
    cancelDeleteMode: appPerformance.cancelDeleteMode,
    openDeleteConfirm: appPerformance.openDeleteConfirm,
    setIndexView: appPerformance.setIndexView,
    startDeleteMode: appPerformance.startDeleteMode,
    toggleAllVisibleCaptureSelection:
      appPerformance.toggleAllVisibleCaptureSelection,
  }));
  const selectedCount = selectedCaptureIds.length;
  const hasCaptures = captureHistoryTotal > 0;
  const selectedCaptureIdSet = new Set(selectedCaptureIds);
  const selectableCaptureIds = captureHistory
    .filter((capture) => capture.stoppedAt !== null)
    .map((capture) => capture.id);
  const allVisibleSelected =
    selectableCaptureIds.length > 0 &&
    selectableCaptureIds.every((id) => selectedCaptureIdSet.has(id));

  const handleCapturesView = () => setIndexView("captures");
  const handleTrendsView = () => setIndexView("trends");

  return (
    <div className="flex items-center gap-2">
      {deleteMode ? (
        <>
          <Button
            type="button"
            variant="error"
            outline
            size="sm"
            disabled={isBulkDeleting}
            onClick={cancelDeleteMode}
          >
            <FiX />
            Cancel
          </Button>
          <Button
            type="button"
            variant="ghost"
            outline
            size="sm"
            disabled={isBulkDeleting}
            onClick={toggleAllVisibleCaptureSelection}
          >
            {allVisibleSelected ? "Deselect page" : "Select page"}
          </Button>
          <Button
            type="button"
            variant="error"
            size="sm"
            disabled={selectedCount === 0 || isBulkDeleting}
            onClick={openDeleteConfirm}
          >
            <FiTrash2 />
            Delete captures ({selectedCount})
          </Button>
        </>
      ) : (
        <div role="tablist" className="tabs tabs-border tabs-sm">
          <input
            type="radio"
            name="app-performance-index-tabs"
            className="tab"
            aria-label="Captures"
            checked={indexView === "captures"}
            onChange={handleCapturesView}
          />
          <input
            type="radio"
            name="app-performance-index-tabs"
            className="tab"
            aria-label="Trends"
            checked={indexView === "trends"}
            onChange={handleTrendsView}
          />
        </div>
      )}
      {isSampling ? (
        <span className="badge badge-success badge-sm">
          Diagnostics running
        </span>
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          loading={isStartingCapture}
          onClick={handleStartDiagnostics}
        >
          <FiPlay />
          Start diagnostics
        </Button>
      )}
      {!deleteMode && (
        <div className="dropdown dropdown-end z-50">
          <button
            type="button"
            tabIndex={0}
            className="btn btn-primary btn-square btn-sm"
            aria-label="More App Performance actions"
          >
            <FiMoreHorizontal size={16} />
          </button>
          <ul
            tabIndex={0}
            className="dropdown-content menu w-48 rounded-box bg-base-200 p-2 shadow-lg"
          >
            <li>
              <button
                type="button"
                className="text-error"
                disabled={!hasCaptures}
                onClick={startDeleteMode}
              >
                <FiTrash2 size={14} />
                Delete captures
              </button>
            </li>
          </ul>
        </div>
      )}
    </div>
  );
}
