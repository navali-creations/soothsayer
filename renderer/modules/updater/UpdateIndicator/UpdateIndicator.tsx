import { FiDownload, FiExternalLink, FiRefreshCw } from "react-icons/fi";

import { Button } from "~/renderer/components";
import Tooltip from "~/renderer/components/Tooltip/Tooltip";
import { useUpdater } from "~/renderer/store";

const UpdateIndicator = () => {
  const {
    updateAvailable,
    updateInfo,
    isDismissed,
    status,
    downloadProgress,
    error,
    downloadAndInstall,
  } = useUpdater();

  if (!updateAvailable || isDismissed || !updateInfo) {
    return null;
  }

  const isManual = updateInfo.manualDownload;
  const Icon = isManual ? FiExternalLink : FiDownload;

  // Downloading: show progress indicator
  if (status === "downloading") {
    const isIndeterminate = downloadProgress.percent < 0;
    const label = isIndeterminate
      ? "Updating..."
      : `${downloadProgress.percent}%`;

    return (
      <div className="flex items-center gap-1.5 px-2">
        <div className="flex items-center gap-1.5 min-w-25">
          <div className="w-full bg-base-300 rounded-full h-1.5 overflow-hidden">
            {isIndeterminate ? (
              <div className="bg-success h-1.5 rounded-full w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite]" />
            ) : (
              <div
                className="bg-success h-1.5 rounded-full transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            )}
          </div>
          <span className="text-xs text-success whitespace-nowrap">
            {label}
          </span>
        </div>
      </div>
    );
  }

  // Error: show retry option
  if (status === "error") {
    return (
      <Tooltip as="div" content={error ?? "Update failed"} describeChild open>
        <Button
          aria-label="Retry update"
          onClick={downloadAndInstall}
          variant="ghost"
          size="sm"
          className="text-error"
        >
          <FiRefreshCw size={16} />
        </Button>
      </Tooltip>
    );
  }

  // Ready: update downloaded (win/mac) or new version detected (linux)
  if (status === "ready") {
    const tooltip = isManual
      ? `View Soothsayer v${updateInfo.latestVersion} on GitHub`
      : `Restart to apply Soothsayer v${updateInfo.latestVersion}`;

    return (
      <Tooltip as="div" content={tooltip} describeChild open>
        <Button
          aria-label={tooltip}
          onClick={downloadAndInstall}
          variant="ghost"
          size="sm"
          className="text-success animate-pulse"
        >
          <Icon size={16} />
        </Button>
      </Tooltip>
    );
  }

  // Default: update available — prompt to install or view
  const tooltip = isManual
    ? `View Soothsayer v${updateInfo.latestVersion} on GitHub`
    : `Update to Soothsayer v${updateInfo.latestVersion}`;

  return (
    <Tooltip as="div" content={tooltip} describeChild open>
      <Button
        aria-label={tooltip}
        onClick={downloadAndInstall}
        variant="ghost"
        size="sm"
        className="text-success animate-pulse"
      >
        <Icon size={16} />
      </Button>
    </Tooltip>
  );
};

export default UpdateIndicator;
