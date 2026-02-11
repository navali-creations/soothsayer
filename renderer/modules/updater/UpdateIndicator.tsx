import { FiDownload, FiExternalLink, FiRefreshCw } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useBoundStore } from "~/renderer/store";

const UpdateIndicator = () => {
  const {
    updater: {
      updateAvailable,
      updateInfo,
      isDismissed,
      status,
      downloadProgress,
      error,
      downloadAndInstall,
    },
  } = useBoundStore();

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
      <div
        className="tooltip tooltip-open tooltip-bottom tooltip-error"
        data-tip={error ?? "Update failed"}
      >
        <Button
          onClick={downloadAndInstall}
          variant="ghost"
          size="sm"
          className="text-error"
          title="Retry update"
        >
          <FiRefreshCw size={16} />
        </Button>
      </div>
    );
  }

  // Ready: update downloaded (win/mac) or new version detected (linux)
  if (status === "ready") {
    const tooltip = isManual ? "View release" : "Restart to update";
    const title = isManual
      ? `View Soothsayer v${updateInfo.latestVersion} on GitHub`
      : `Restart to apply Soothsayer v${updateInfo.latestVersion}`;

    return (
      <div
        className="tooltip tooltip-open tooltip-bottom tooltip-success"
        data-tip={tooltip}
      >
        <Button
          onClick={downloadAndInstall}
          variant="ghost"
          size="sm"
          className="text-success animate-pulse"
          title={title}
        >
          <Icon size={16} />
        </Button>
      </div>
    );
  }

  // Default: update available — prompt to install or view
  const tooltip = isManual
    ? `v${updateInfo.latestVersion} available!`
    : `v${updateInfo.latestVersion} available!`;
  const title = isManual
    ? `View Soothsayer v${updateInfo.latestVersion} on GitHub`
    : `Update to Soothsayer v${updateInfo.latestVersion}`;

  return (
    <div
      className="tooltip tooltip-open tooltip-bottom tooltip-success"
      data-tip={tooltip}
    >
      <Button
        onClick={downloadAndInstall}
        variant="ghost"
        size="sm"
        className="text-success animate-pulse"
        title={title}
      >
        <Icon size={16} />
      </Button>
    </div>
  );
};

export default UpdateIndicator;
