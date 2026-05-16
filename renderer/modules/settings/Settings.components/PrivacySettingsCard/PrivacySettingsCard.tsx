import { type ChangeEvent, useEffect } from "react";
import { FiAlertTriangle, FiInfo } from "react-icons/fi";

import { SettingsKey } from "~/main/modules/settings-store/SettingsStore.keys";
import { Button, Link } from "~/renderer/components";
import { trackEvent } from "~/renderer/modules/umami";
import { useCommunityUpload, useSettings } from "~/renderer/store";

const GGG_ACCOUNT_LINK_ENABLED = false;

const PrivacySettingsCard = () => {
  const {
    telemetryCrashReporting,
    telemetryUsageAnalytics,
    communityUploadsEnabled,
    updateSetting,
  } = useSettings();

  const {
    gggAuthenticated,
    gggUsername,
    isAuthenticating,
    authError,
    authenticate,
    logout,
    fetchStatus,
  } = useCommunityUpload();

  useEffect(() => {
    if (!GGG_ACCOUNT_LINK_ENABLED) return;

    fetchStatus();
  }, [fetchStatus]);

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

  const handleCommunityUploadsToggle = async (enabled: boolean) => {
    await updateSetting(SettingsKey.CommunityUploadsEnabled, enabled);
    trackEvent("settings-change", {
      setting: "communityUploadsEnabled",
      value: enabled,
    });
  };

  const handleCrashReportingChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    await handleCrashReportingToggle(event.target.checked);
  };

  const handleUsageAnalyticsChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    await handleUsageAnalyticsToggle(event.target.checked);
  };

  const handleCommunityUploadsChange = async (
    event: ChangeEvent<HTMLInputElement>
  ) => {
    await handleCommunityUploadsToggle(event.target.checked);
  };

  const handlePrivacyPolicyClick = () => {
    trackEvent("settings-privacy-policy-viewed");
  };

  return (
    <section className="space-y-3">
      <p className="sr-only">Privacy and telemetry settings</p>

      {/* Restart notice */}
      <div className="alert alert-soft alert-warning text-sm py-2">
        <FiAlertTriangle className="shrink-0 w-4 h-4" />
        <span>Changes take effect after restarting the app.</span>
      </div>

      <div className="divide-y divide-base-content/10">
        {/* Crash Reporting */}
        <div className="py-3">
          <label className="grid cursor-pointer grid-cols-[1fr_33px] gap-4">
            <div style={{ textWrap: "auto" }}>
              <span className="text-sm font-semibold">Crash Reporting</span>
              <p className="mt-1 text-sm text-base-content/60">
                Send anonymous error reports when something goes wrong. Only
                your OS type, app version, and error details are included - no
                usernames or file paths.
              </p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={telemetryCrashReporting}
              onChange={handleCrashReportingChange}
            />
          </label>
        </div>

        {/* Usage Analytics */}
        <div className="py-3">
          <label className="grid cursor-pointer grid-cols-[1fr_33px] gap-4">
            <div style={{ textWrap: "auto" }}>
              <span className="text-sm font-semibold">Usage Analytics</span>
              <p className="mt-1 text-sm text-base-content/60">
                Help us understand which features are used most. No personal
                data is collected.
              </p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={telemetryUsageAnalytics}
              onChange={handleUsageAnalyticsChange}
            />
          </label>
        </div>

        {/* Community Drop Rates */}
        <div className="py-3">
          <label className="grid cursor-pointer grid-cols-[1fr_33px] gap-4">
            <div style={{ textWrap: "auto" }}>
              <span className="text-sm font-semibold">
                Community Drop Rates
              </span>
              <p className="mt-1 text-sm text-base-content/60">
                Share your stacked deck data anonymously to help build community
                drop rate statistics.
              </p>
            </div>
            <input
              type="checkbox"
              className="toggle toggle-sm toggle-primary"
              checked={communityUploadsEnabled}
              onChange={handleCommunityUploadsChange}
            />
          </label>
        </div>

        {/* GGG Account Link/Unlink — disabled until the relay website is ready. */}
        {GGG_ACCOUNT_LINK_ENABLED && communityUploadsEnabled && (
          <div className="py-3">
            {gggAuthenticated ? (
              <div className="flex items-center justify-between">
                <span className="text-sm text-success font-medium">
                  ✓ Verified as <strong>{gggUsername}</strong>
                </span>
                <Button variant="ghost" size="xs" onClick={logout}>
                  Unlink
                </Button>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-base-content/60">
                    <FiInfo className="shrink-0 w-4 h-4" />
                    <span>Uploading anonymously</span>
                  </div>
                  <Button
                    variant="primary"
                    size="xs"
                    onClick={authenticate}
                    disabled={isAuthenticating}
                    loading={isAuthenticating}
                  >
                    Link GGG Account
                  </Button>
                </div>
                {authError && (
                  <div className="alert alert-soft alert-error text-xs py-1.5">
                    {authError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Privacy Policy link */}
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-2">
            <span className="text-sm text-base-content/70">Privacy Policy</span>
          </div>
          <Link
            to="/privacy-policy"
            className="btn btn-primary btn-xs gap-1"
            onClick={handlePrivacyPolicyClick}
          >
            View
          </Link>
        </div>
      </div>
    </section>
  );
};

export default PrivacySettingsCard;
