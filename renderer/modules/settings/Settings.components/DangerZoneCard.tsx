import { useRef, useState } from "react";
import { FiAlertTriangle, FiTrash2 } from "react-icons/fi";

import { Button } from "~/renderer/components";

const DangerZoneCard = () => {
  const [isResetting, setIsResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const modalRef = useRef<HTMLDialogElement>(null);

  const openModal = () => {
    setError(null);
    modalRef.current?.showModal();
  };

  const closeModal = () => {
    modalRef.current?.close();
  };

  const handleResetDatabase = async () => {
    try {
      setIsResetting(true);
      setError(null);
      const result = await window.electron.settings.resetDatabase();

      if (result.success) {
        window.electron.app.restart();
      } else {
        setError(result.error ?? "Unknown error");
        setIsResetting(false);
      }
    } catch (err) {
      setError((err as Error).message);
      setIsResetting(false);
    }
  };

  return (
    <>
      <div className="card bg-base-100 shadow-xl border-2 border-error h-full">
        <div className="card-body">
          <h2 className="card-title text-error">
            <FiTrash2 className="w-5 h-5" />
            Danger Zone
          </h2>
          <p className="text-sm text-base-content/60">
            Irreversible actions that affect your data
          </p>

          <div className="divider"></div>

          <div className="space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1">
                <h3 className="font-semibold">Reset Database</h3>
                <p className="text-sm text-base-content/60 mt-1">
                  Permanently delete all sessions, statistics, and price
                  snapshots. This action cannot be undone.
                </p>
              </div>
              <Button
                variant="error"
                onClick={openModal}
                className="whitespace-nowrap"
              >
                <FiTrash2 />
                Reset Database
              </Button>
            </div>
          </div>
        </div>
      </div>

      <dialog ref={modalRef} className="modal modal-bottom sm:modal-middle">
        <div className="modal-box border border-error">
          <div className="flex items-center gap-3 text-error mb-4">
            <FiAlertTriangle className="w-6 h-6 flex-shrink-0" />
            <h3 className="font-bold text-lg">Reset Database</h3>
          </div>

          <p className="text-sm">
            This will <strong>permanently delete ALL</strong> your data:
          </p>
          <ul className="list-disc list-inside text-sm mt-2 space-y-1 text-base-content/80">
            <li>All sessions and session history</li>
            <li>All card statistics</li>
            <li>All price snapshots</li>
          </ul>
          <p className="text-sm mt-3 font-semibold text-error">
            This action cannot be undone. The application will restart.
          </p>

          {error && (
            <div role="alert" className="alert alert-error mt-4 text-sm">
              <span>{error}</span>
            </div>
          )}

          <div className="modal-action">
            <Button variant="ghost" onClick={closeModal} disabled={isResetting}>
              Cancel
            </Button>
            <Button
              variant="error"
              onClick={handleResetDatabase}
              disabled={isResetting}
            >
              {isResetting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Resetting...
                </>
              ) : (
                <>
                  <FiTrash2 />
                  Delete Everything & Restart
                </>
              )}
            </Button>
          </div>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button disabled={isResetting}>close</button>
        </form>
      </dialog>
    </>
  );
};

export default DangerZoneCard;
