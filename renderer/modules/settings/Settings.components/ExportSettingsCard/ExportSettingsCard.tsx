import { useCallback, useState } from "react";
import {
  FiDownload,
  FiEye,
  FiEyeOff,
  FiFolder,
  FiRotateCcw,
} from "react-icons/fi";

import { maskPath } from "~/main/utils/mask-path";
import { Button, Flex } from "~/renderer/components";
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
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center gap-2">
          <FiDownload className="w-5 h-5" />
          <h2 className="card-title">Export</h2>
        </div>
        <p className="text-sm text-base-content/60">
          Configure where CSV exports are saved
        </p>

        <div className="space-y-4 mt-4">
          <div className="form-control w-full">
            <label className="label">
              <span className="label-text">Export folder</span>
            </label>
            <Flex className="gap-2">
              <input
                type="text"
                className="input input-bordered input-sm flex-1"
                value={displayValue}
                readOnly
                placeholder="Desktop/soothsayer-exports (default)"
              />
              {hasCustomPath && (
                <button
                  type="button"
                  onClick={toggleReveal}
                  className="btn btn-ghost btn-sm btn-square text-base-content/50 hover:text-base-content/80"
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
                onClick={handleSelectDirectory}
              >
                <FiFolder />
              </Button>
            </Flex>
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

          <p className="text-xs text-base-content/40">
            The save dialog will open to this folder by default. You can always
            choose a different location when exporting.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ExportSettingsCard;
