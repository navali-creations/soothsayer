import { useCallback, useEffect, useRef } from "react";
import { FiAlertTriangle, FiTrash2, FiX } from "react-icons/fi";

interface SessionsDeleteConfirmModalProps {
  isOpen: boolean;
  selectedCount: number;
  error: string | null;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export const SessionsDeleteConfirmModal = ({
  isOpen,
  selectedCount,
  error,
  isDeleting,
  onCancel,
  onConfirm,
}: SessionsDeleteConfirmModalProps) => {
  const modalRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (isOpen) {
      modalRef.current?.showModal();
    } else {
      modalRef.current?.close();
    }
  }, [isOpen]);

  const handleCancel = useCallback(() => {
    modalRef.current?.close();
    onCancel();
  }, [onCancel]);

  const handleDialogClose = useCallback(() => {
    onCancel();
  }, [onCancel]);

  return (
    <dialog
      ref={modalRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={handleDialogClose}
    >
      <div className="modal-box border border-error">
        <div className="flex items-center gap-3 text-error mb-4">
          <FiAlertTriangle className="w-6 h-6 shrink-0" />
          <h3 className="font-bold text-lg">Delete sessions</h3>
        </div>

        <div className="space-y-3 text-sm">
          <p>
            Delete {selectedCount} selected session
            {selectedCount === 1 ? "" : "s"}?
          </p>
          <p className="font-semibold text-error">
            This action cannot be undone.
          </p>
          <p className="text-base-content/70">
            Aggregate card statistics and total stacked decks opened will be
            recalculated after deletion.
          </p>
        </div>

        {error && (
          <div className="alert alert-error mt-4 py-2 text-sm">{error}</div>
        )}

        <div className="modal-action">
          <button
            className="btn btn-sm btn-outline gap-1"
            disabled={isDeleting}
            onClick={handleCancel}
          >
            <FiX size={14} />
            Cancel
          </button>
          <button
            className="btn btn-sm btn-error gap-1"
            disabled={isDeleting || selectedCount === 0}
            onClick={onConfirm}
          >
            <FiTrash2 size={14} />
            Delete sessions
          </button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleCancel}>
          close
        </button>
      </form>
    </dialog>
  );
};
