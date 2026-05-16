import { useCallback, useState } from "react";
import { FiEye, FiEyeOff, FiFolder, FiRotateCcw } from "react-icons/fi";

import { maskPath } from "~/main/utils/mask-path";
import { Button } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useSettings } from "~/renderer/store";

/** Anchors for masking the export directory path. */
const EXPORT_PATH_ANCHORS = [
  "soothsayer-exports",
  "Desktop",
  "Documents",
  "Downloads",
];

const ExportSettingsCard = () => {
  const { csvExportPath, updateSetting } = useSettings();

  const [isRevealed, setIsRevealed] = useState(false);

  const hasCustomPath = !!csvExportPath;

  const displayValue = hasCustomPath
    ? isRevealed
      ? csvExportPath
      : maskPath(csvExportPath, EXPORT_PATH_ANCHORS)
    : "";

  const handleSelectDirectory = useCallback(async () => {
    try {
      const dirPath = await window.electron.selectFile({
        title: "Select CSV Export Folder",
        properties: ["openDirectory"],
      });

      if (dirPath) {
        await updateSetting("csvExportPath", dirPath);
        trackEvent("settings-change", {
          setting: "csvExportPath",
          hasPath: true,
        });
      }
    } catch (error) {
      console.error("Error selecting export directory:", error);
    }
  }, [updateSetting]);

  const handleReset = useCallback(async () => {
    await updateSetting("csvExportPath", null);
    setIsRevealed(false);
    trackEvent("settings-change", { setting: "csvExportPath", hasPath: false });
  }, [updateSetting]);

  const toggleReveal = useCallback(() => {
    setIsRevealed((prev) => !prev);
  }, []);

  return (
    <section className="space-y-3">
      <div className="space-y-3">
        <div className="grid gap-3 md:grid-cols-[1fr_minmax(22rem,1.35fr)] md:items-start">
          <div>
            <div className="text-sm font-medium text-base-content/70">
              Export folder
            </div>
            <p className="text-xs text-base-content/50">
              Default folder for CSV save dialogs
            </p>
          </div>
          <div>
            <div className="join w-full">
              <label className="input input-bordered input-sm join-item flex min-w-0 flex-1 items-center">
                <input
                  type="text"
                  className="min-w-0 flex-1 bg-transparent outline-none"
                  value={displayValue}
                  readOnly
                  placeholder="Desktop/soothsayer-exports (default)"
                />
              </label>
              {hasCustomPath && (
                <button
                  type="button"
                  onClick={toggleReveal}
                  className="btn btn-ghost btn-sm btn-square join-item text-base-content/50 hover:text-base-content/80"
                  title={isRevealed ? "Hide full path" : "Reveal full path"}
                >
                  {isRevealed ? (
                    <FiEyeOff className="w-4 h-4" />
                  ) : (
                    <FiEye className="w-4 h-4" />
                  )}
                </button>
              )}
              <Button
                variant="primary"
                size="sm"
                square
                className="join-item"
                onClick={handleSelectDirectory}
                title="Select export folder"
              >
                <FiFolder />
              </Button>
            </div>
            {hasCustomPath && (
              <div className="flex items-center mt-2">
                <button
                  type="button"
                  onClick={handleReset}
                  className="btn btn-ghost btn-xs gap-1 text-base-content/50 hover:text-base-content/80"
                >
                  <FiRotateCcw className="w-3 h-3" />
                  Reset to default
                </button>
              </div>
            )}
          </div>
        </div>

        <p className="alert alert-soft py-2 text-xs text-base-content/60">
          The save dialog will open to this folder by default. You can always
          choose a different location when exporting.
        </p>
      </div>
    </section>
  );
};

export default ExportSettingsCard;
