import { useCallback, useEffect, useRef, useState } from "react";
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi";

import type { LeagueStorageUsage } from "~/main/modules/storage/Storage.types";
import { Button } from "~/renderer/components";

import { formatBytes, gameLabel } from "./storage.utils";

interface DeleteLeagueModalProps {
  league: LeagueStorageUsage | null;
  onConfirm: (leagueId: string) => void;
  onClose: () => void;
}

const DeleteLeagueModal = ({
  league,
  onConfirm,
  onClose,
}: DeleteLeagueModalProps) => {
  const modalRef = useRef<HTMLDialogElement>(null);
  // Snapshot drives rendered content. We only clear it after the close animation
  // finishes so the summary stays visible while the modal animates out.
  const [snapshot, setSnapshot] = useState<LeagueStorageUsage | null>(null);

  // When a new league is provided, snapshot it and open the dialog.
  useEffect(() => {
    if (league) {
      setSnapshot(league);
      modalRef.current?.showModal();
    }
  }, [league]);

  const handleClose = useCallback(() => {
    modalRef.current?.close();
  }, []);

  const handleConfirm = useCallback(() => {
    if (!snapshot) return;
    const leagueId = snapshot.leagueId;
    modalRef.current?.close();
    onConfirm(leagueId);
  }, [onConfirm, snapshot]);

  // The dialog `close` event fires as soon as dialog.close() is called, before
  // any CSS transition/animation completes. We delay clearing the snapshot so
  // the content remains visible during the daisyUI close animation (~200ms).
  const handleDialogClose = useCallback(() => {
    const duration = 200; // matches daisyUI modal animation duration
    setTimeout(() => {
      setSnapshot(null);
    }, duration);
    onClose();
  }, [onClose]);

  const data = snapshot;

  return (
    <dialog
      ref={modalRef}
      className="modal modal-bottom sm:modal-middle"
      onClose={handleDialogClose}
    >
      <div className="modal-box border border-error">
        <div className="flex items-center gap-3 text-error mb-4">
          <FiAlertTriangle className="w-6 h-6 shrink-0" />
          <h3 className="font-bold text-lg">Delete League Data</h3>
        </div>

        {data && (
          <>
            <p className="text-sm">
              Delete all data for{" "}
              <strong>
                {data.leagueName} ({gameLabel(data.game)})
              </strong>
              ?
            </p>
            <p className="text-sm mt-2 text-base-content/70">
              This will remove:
            </p>
            <ul className="list-disc list-inside text-sm mt-1 space-y-1 text-base-content/80">
              <li>
                {data.sessionCount} session
                {data.sessionCount !== 1 ? "s" : ""} and their card data
              </li>
              <li>
                {data.snapshotCount} price snapshot
                {data.snapshotCount !== 1 ? "s" : ""}
              </li>
              <li>Card drop rates and saved league details</li>
            </ul>
            <p className="text-xs mt-2 text-base-content/50">
              Estimated space freed: ~{formatBytes(data.estimatedSizeBytes)}
            </p>
            <p className="text-sm mt-3 font-semibold text-error">
              This action cannot be undone.
            </p>
          </>
        )}

        <div className="modal-action">
          <Button variant="ghost" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="error" size="sm" onClick={handleConfirm}>
            <FiTrash2 />
            Delete League Data
          </Button>
        </div>
      </div>
      <form method="dialog" className="modal-backdrop">
        <button type="button" onClick={handleClose}>
          close
        </button>
      </form>
    </dialog>
  );
};

export default DeleteLeagueModal;
