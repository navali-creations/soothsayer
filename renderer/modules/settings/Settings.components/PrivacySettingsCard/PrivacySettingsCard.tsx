import { FiAlertTriangle, FiShield } from "react-icons/fi";

import { SettingsKey } from "~/main/modules/settings-store/SettingsStore.keys";
import { Link } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useSettings } from "~/renderer/store";

const PrivacySettingsCard = () => {
  const { telemetryCrashReporting, telemetryUsageAnalytics, updateSetting } =
    useSettings();

  const handleCrashReportingToggle = async (enabled: boolean) => {
    await updateSetting(SettingsKey.TelemetryCrashReporting, enabled);
    trackEvent("settings-change", {
      setting: "telemetryCrashReporting",
      value: enabled,
    });
  };

  const handleUsageAnalyticsToggle = async (enabled: boolean) => {
    // Track before applying, in case the user is opting out of analytics
    trackEvent("settings-change", {
      setting: "telemetryUsageAnalytics",
      value: enabled,
    });
    await updateSetting(SettingsKey.TelemetryUsageAnalytics, enabled);
  };

  return (
    <div className="card bg-base-100 shadow-xl">
      <div className="card-body">
        <div className="flex items-center gap-2">
          <FiShield className="w-5 h-5" />
          <h2 className="card-title">Privacy & Telemetry</h2>
        </div>
        <p className="text-sm text-base-content/60">
          Control what anonymous data Soothsayer sends
        </p>

        <div className="space-y-4 mt-4">
          {/* Crash Reporting */}
          <div className="form-control">
            <label className="label cursor-pointer grid grid-cols-[1fr_33px] gap-4">
              <div style={{ textWrap: "auto" }}>
                <span className="label-text font-medium">Crash Reporting</span>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Send anonymous error reports when something goes wrong. Only
                  your OS type, app version, and error details are included — no
                  usernames or file paths.
                </p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={telemetryCrashReporting}
                onChange={(e) => handleCrashReportingToggle(e.target.checked)}
              />
            </label>
          </div>

          {/* Usage Analytics */}
          <div className="form-control">
            <label className="label cursor-pointer grid grid-cols-[1fr_33px] gap-4">
              <div style={{ textWrap: "auto" }}>
                <span className="label-text font-medium">Usage Analytics</span>
                <p className="text-xs text-base-content/50 mt-0.5">
                  Help us understand which features are used most. No personal
                  data is collected.
                </p>
              </div>
              <input
                type="checkbox"
                className="toggle toggle-sm toggle-primary"
                checked={telemetryUsageAnalytics}
                onChange={(e) => handleUsageAnalyticsToggle(e.target.checked)}
              />
            </label>
          </div>

          {/* Restart notice */}
          <div className="alert alert-soft alert-warning text-sm py-2">
            <FiAlertTriangle className="shrink-0 w-4 h-4" />
            <span>Changes take effect after restarting the app.</span>
          </div>

          <div className="divider my-0" />

          {/* Privacy Policy link */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/70">
                📄 Privacy Policy
              </span>
            </div>
            <Link
              to="/privacy-policy"
              className="btn btn-primary btn-xs gap-1"
              onClick={() => trackEvent("settings-privacy-policy-viewed")}
            >
              View
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrivacySettingsCard;
