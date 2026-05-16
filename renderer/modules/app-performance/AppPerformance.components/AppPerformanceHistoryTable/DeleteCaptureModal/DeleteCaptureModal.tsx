import { type SyntheticEvent, useCallback, useEffect, useRef } from "react";
import { FiAlertTriangle, FiTrash2, FiX } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useAppPerformanceShallow } from "~/renderer/store";

export function DeleteCapturesModal() {
  const modalRef = useRef<HTMLDialogElement>(null);
  const {
    closeDeleteConfirm,
    confirmBulkDelete,
    deleteError,
    isBulkDeleting,
    isDeleteConfirmOpen,
    selectedCaptureIds,
  } = useAppPerformanceShallow((appPerformance) => ({
    closeDeleteConfirm: appPerformance.closeDeleteConfirm,
    confirmBulkDelete: appPerformance.confirmBulkDelete,
    deleteError: appPerformance.deleteError,
    isBulkDeleting: appPerformance.isBulkDeleting,
    isDeleteConfirmOpen: appPerformance.isDeleteConfirmOpen,
    selectedCaptureIds: appPerformance.selectedCaptureIds,
  }));
  const selectedCount = selectedCaptureIds.length;

  useEffect(() => {
    if (isDeleteConfirmOpen) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isDeleteConfirmOpen]);

  const handleCancel = useCallback(() => {
    if (isBulkDeleting) return;

    modalRef.current?.close();
    closeDeleteConfirm();
  }, [closeDeleteConfirm, isBulkDeleting]);

  const handleDialogClose = useCallback(() => {
    if (isBulkDeleting) {
      window.setTimeout(() => {
        const dialog = modalRef.current;
        if (isDeleteConfirmOpen && dialog && !dialog.open) {
          dialog.showModal();
        }
      }, 0);
      return;
    }

    closeDeleteConfirm();
  }, [closeDeleteConfirm, isBulkDeleting, isDeleteConfirmOpen]);

  const handleDialogCancel = useCallback(
    (event: SyntheticEvent<HTMLDialogElement>) => {
      if (!isBulkDeleting) return;

      event.preventDefault();
    },
    [isBulkDeleting],
  );

  const handleConfirm = useCallback(() => {
    void confirmBulkDelete();
  }, [confirmBulkDelete]);

  return (
    <dialog
      ref={modalRef}
      className="modal modal-bottom sm:modal-middle"
      onCancel={handleDialogCancel}
      onClose={handleDialogClose}
    >
      <div className="modal-box border border-error">
        <div className="mb-4 flex items-center gap-3 text-error">
          <FiAlertTriangle className="h-6 w-6 shrink-0" />
          <h3 className="font-bold text-lg">Delete captures</h3>
        </div>

        <div className="space-y-3 text-sm">
          <p>
            Delete {selectedCount} selected diagnostics capture
            {selectedCount === 1 ? "" : "s"}?
          </p>
          <p className="text-base-content/70">
            This removes the saved performance measurements for the selected
            captures.
          </p>
          <p className="font-semibold text-error">
            This action cannot be undone.
          </p>
        </div>

        {deleteError && (
          <div className="alert alert-error mt-4 py-2 text-sm">
            {deleteError}
          </div>
        )}

        <div className="modal-action">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isBulkDeleting}
            onClick={handleCancel}
          >
            <FiX />
            Cancel
          </Button>
          <Button
            type="button"
            variant="error"
            size="sm"
            disabled={isBulkDeleting || selectedCount === 0}
            loading={isBulkDeleting}
            onClick={handleConfirm}
          >
            <FiTrash2 />
            Delete captures
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleCancel}>
          close
        </button>
      </form>
    </dialog>
  );
}
