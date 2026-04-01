import { useCallback } from "react";
import { FiFileText } from "react-icons/fi";

import { OnboardingButton } from "../../../onboarding";

const AppHelpCard = () => {
  const handleOpenDiagLog = useCallback(async () => {
    await window.electron.diagLog.revealLogFile();
  }, []);

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <h2 className="card-title">App Help</h2>
        <p className="text-sm text-base-content/60">
          Need help getting started or want a refresher?
        </p>

        <div className="divider"></div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">App Tour</h3>
            <p className="text-sm text-base-content/60 mt-1">
              Interactive beacons guide you through Soothsayer's features.
              Dismissed a beacon? Reset the tour to see them all again.
            </p>
          </div>
          <OnboardingButton variant="button" size="sm" />
        </div>

        <div className="divider"></div>

        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="font-semibold">Diagnostic Log</h3>
            <p className="text-sm text-base-content/60 mt-1">
              View startup and authentication logs for troubleshooting. The log
              is cleared on each app launch.
            </p>
          </div>
          <button
            className="btn btn-outline btn-sm"
            onClick={handleOpenDiagLog}
          >
            <FiFileText />
            Open log file
          </button>
        </div>
      </div>
    </div>
  );
};

export default AppHelpCard;
