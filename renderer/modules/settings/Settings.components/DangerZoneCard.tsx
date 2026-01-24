import { useState } from "react";
import { FiTrash2 } from "react-icons/fi";

import { Button } from "~/renderer/components";

const DangerZoneCard = () => {
  const [isResetting, setIsResetting] = useState(false);

  const handleResetDatabase = async () => {
    // Double confirmation for safety
    const firstConfirm = confirm(
      "⚠️ WARNING: This will DELETE ALL your data!\n\n" +
        "This includes:\n" +
        "• All sessions and session history\n" +
        "• All card statistics\n" +
        "• All price snapshots\n\n" +
        "This action CANNOT be undone!\n\n" +
        "The application will restart after the reset.\n\n" +
        "Are you absolutely sure?",
    );

    if (!firstConfirm) return;

    const secondConfirm = confirm(
      "Last chance! Click OK to DELETE ALL DATA and restart the app.",
    );

    if (!secondConfirm) return;

    try {
      setIsResetting(true);
      const result = await window.electron.settings.resetDatabase();

      if (result.success) {
        alert(
          "✅ Database reset successfully!\n\n" +
            "Click OK to restart the application.",
        );

        // Request app restart/quit
        if (window.electron?.app?.close) {
          window.electron.app.close();
        } else {
          // Fallback: reload the renderer
          window.location.reload();
        }
      } else {
        alert(`❌ Failed to reset database:\n${result.error}`);
        setIsResetting(false);
      }
    } catch (error) {
      console.error("Error resetting database:", error);
      alert(`❌ Error resetting database:\n${(error as Error).message}`);
      setIsResetting(false);
    }
  };

  return (
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
              onClick={handleResetDatabase}
              disabled={isResetting}
              className="whitespace-nowrap"
            >
              {isResetting ? (
                <>
                  <span className="loading loading-spinner loading-sm"></span>
                  Resetting...
                </>
              ) : (
                <>
                  <FiTrash2 />
                  Reset Database
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DangerZoneCard;
