import { type ChangeEvent, useCallback, useState } from "react";
import { FiFileText } from "react-icons/fi";

import { Button } from "~/renderer/components";
import { useAppPerformanceShallow, useSettings } from "~/renderer/store";

import type { AppPerformanceRetention } from "../../../app-performance";

const TroubleshootingSettingsCard = () => {
  const {
    appPerformanceAutoStartOnSession,
    appPerformanceMonitorEnabled,
    appPerformanceRetention,
    updateSetting,
  } = useSettings();
  const { setMonitorEnabled, setRetentionPolicy } = useAppPerformanceShallow(
    (appPerformance) => ({
      setMonitorEnabled: appPerformance.setMonitorEnabled,
      setRetentionPolicy: appPerformance.setRetentionPolicy,
    }),
  );
  const [isUpdatingFeatureVisibility, setIsUpdatingFeatureVisibility] =
    useState(false);
  const [isUpdatingRetention, setIsUpdatingRetention] = useState(false);
  const [isUpdatingSessionAutoStart, setIsUpdatingSessionAutoStart] =
    useState(false);

  const handleOpenDiagLog = useCallback(async () => {
    await window.electron.diagLog.revealLogFile();
  }, []);

  const handleFeatureVisibilityChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      const enabled = event.target.checked;
      setIsUpdatingFeatureVisibility(true);
      try {
        await setMonitorEnabled(enabled);
        if (!enabled && appPerformanceAutoStartOnSession) {
          await updateSetting("appPerformanceAutoStartOnSession", false);
        }
      } finally {
        setIsUpdatingFeatureVisibility(false);
      }
    },
    [appPerformanceAutoStartOnSession, setMonitorEnabled, updateSetting],
  );

  const handleRetentionChange = useCallback(
    async (event: ChangeEvent<HTMLSelectElement>) => {
      setIsUpdatingRetention(true);
      try {
        await setRetentionPolicy(event.target.value as AppPerformanceRetention);
      } finally {
        setIsUpdatingRetention(false);
      }
    },
    [setRetentionPolicy],
  );

  const handleSessionAutoStartChange = useCallback(
    async (event: ChangeEvent<HTMLInputElement>) => {
      setIsUpdatingSessionAutoStart(true);
      try {
        await updateSetting(
          "appPerformanceAutoStartOnSession",
          event.target.checked,
        );
      } finally {
        setIsUpdatingSessionAutoStart(false);
      }
    },
    [updateSetting],
  );

  return (
    <section className="space-y-3">
      <div className="divide-y divide-base-content/10">
        <div className="flex items-start justify-between gap-4 py-4">
          <div className="flex-1">
            <h3 className="font-semibold">Diagnostic Log</h3>
            <p className="mt-1 text-sm text-base-content/60">
              View startup and authentication logs. The log is cleared on each
              app launch.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            outline
            size="sm"
            onClick={handleOpenDiagLog}
          >
            <FiFileText />
            Open log file
          </Button>
        </div>

        <div className="flex items-start justify-between gap-4 py-4">
          <div className="flex-1">
            <h3 className="font-semibold">Show App Performance feature</h3>
            <p className="mt-1 text-sm text-base-content/60">
              Adds App Performance to the sidebar. Start diagnostics from that
              page when you need a capture.
            </p>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm mt-1"
            checked={appPerformanceMonitorEnabled}
            disabled={isUpdatingFeatureVisibility}
            aria-label="Show App Performance feature"
            onChange={handleFeatureVisibilityChange}
          />
        </div>

        <div className="flex items-start justify-between gap-4 py-4 pl-4">
          <div className="flex-1">
            <h3 className="font-semibold">Keep captures</h3>
            <p className="mt-1 text-sm text-base-content/60">
              Automatically remove old performance diagnostics captures.
            </p>
          </div>
          <select
            className="select select-bordered select-sm mt-1 w-36"
            value={appPerformanceRetention}
            disabled={!appPerformanceMonitorEnabled || isUpdatingRetention}
            aria-label="Keep diagnostics captures"
            onChange={handleRetentionChange}
          >
            <option value="24h">24 hours</option>
            <option value="7d">7 days</option>
            <option value="indefinite">Forever</option>
          </select>
        </div>

        <div className="flex items-start justify-between gap-4 py-4 pl-4">
          <div className="flex-1">
            <h3 className="font-semibold">Start diagnostics with sessions</h3>
            <p className="mt-1 text-sm text-base-content/60">
              Starts a fresh performance capture whenever a new current session
              starts, and stops it when the session ends.
            </p>
          </div>
          <input
            type="checkbox"
            className="toggle toggle-primary toggle-sm mt-1"
            checked={
              appPerformanceMonitorEnabled && appPerformanceAutoStartOnSession
            }
            disabled={
              !appPerformanceMonitorEnabled || isUpdatingSessionAutoStart
            }
            aria-label="Start diagnostics with sessions"
            onChange={handleSessionAutoStartChange}
          />
        </div>
      </div>
    </section>
  );
};

export default TroubleshootingSettingsCard;
