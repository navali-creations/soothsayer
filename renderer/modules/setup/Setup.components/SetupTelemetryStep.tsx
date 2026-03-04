import { FiExternalLink } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

const PRIVACY_POLICY_URL =
  "https://github.com/navali-creations/soothsayer/blob/main/PRIVACY.md";

const SetupTelemetryStep = () => {
  const {
    setup: { setSetupState },
    settings: {
      telemetryCrashReporting,
      telemetryUsageAnalytics,
      updateSetting,
    },
  } = useBoundStore();

  const crashReporting = telemetryCrashReporting ?? true;
  const usageAnalytics = telemetryUsageAnalytics ?? true;

  const handleCrashReportingToggle = async (enabled: boolean) => {
    await updateSetting("telemetryCrashReporting", enabled);
    // Refresh setup state from backend so advanceStep/tracking sees the change
    const setupState = await window.electron.appSetup.getSetupState();
    setSetupState(setupState);
  };

  const handleUsageAnalyticsToggle = async (enabled: boolean) => {
    await updateSetting("telemetryUsageAnalytics", enabled);
    // Refresh setup state from backend so advanceStep/tracking sees the change
    const setupState = await window.electron.appSetup.getSetupState();
    setSetupState(setupState);
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-base-content mb-1">
        Help Us Improve Soothsayer
      </h2>

      <p className="text-sm text-base-content/60 mb-4">
        We collect two types of anonymous data to make the app better. Both are
        optional — you can change these anytime in Settings.
      </p>

      <div className="space-y-3">
        {/* Crash Reporting */}
        <div className="bg-base-100 border border-base-content/10 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-base-content">
                Crash Reporting
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                When something goes wrong, an anonymous error report is sent so
                we can fix it. This includes:
              </p>
              <ul className="text-xs text-base-content/50 mt-1 list-disc list-inside space-y-0.5">
                <li>Error type and message</li>
                <li>Your operating system (Windows/Linux)</li>
                <li>App version</li>
              </ul>
              <p className="text-xs text-base-content/50 mt-1.5 italic">
                No usernames, file paths, or IP addresses are stored.
              </p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary mt-1"
              checked={crashReporting}
              onChange={(e) => handleCrashReportingToggle(e.target.checked)}
            />
          </div>
        </div>

        {/* Usage Analytics */}
        <div className="bg-base-100 border border-base-content/10 rounded-lg p-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h3 className="font-semibold text-base-content">
                Usage Analytics
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                Anonymous page views and feature usage help us understand which
                parts of the app are most used so we can focus our development
                efforts where they matter most.
              </p>
              <p className="text-xs text-base-content/50 mt-1.5 italic">
                No personal data is collected. We see aggregated counts like
                &quot;50 users opened the Overlay today&quot;, not who did.
              </p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary mt-1"
              checked={usageAnalytics}
              onChange={(e) => handleUsageAnalyticsToggle(e.target.checked)}
            />
          </div>
        </div>
      </div>

      <p className="text-xs text-base-content/50 mt-4">
        By continuing, you agree to our{" "}
        <a
          href={PRIVACY_POLICY_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="link link-primary inline-flex items-center gap-0.5"
        >
          Privacy Policy <FiExternalLink className="w-3 h-3" />
        </a>
      </p>
    </div>
  );
};

export default SetupTelemetryStep;
