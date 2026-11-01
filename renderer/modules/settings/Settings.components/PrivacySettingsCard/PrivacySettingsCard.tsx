import { type ChangeEvent, useEffect, useState } from "react";
import { FiExternalLink, FiInfo } from "react-icons/fi";

import { SettingsKey } from "~/main/modules/settings-store/SettingsStore.keys";
import { Button, Link } from "~/renderer/components";
import { useCommunityUpload, useSettings } from "~/renderer/store";

import CommunityUploadWarning from "../CommunityUploadWarning/CommunityUploadWarning";
import DropContextConsent from "../DropContextConsent/DropContextConsent";
import GggAccountLinkConfirmModal from "../GggAccountLinkConfirmModal/GggAccountLinkConfirmModal";

const PrivacySettingsCard = () => {
  const [isGggLinkConfirmOpen, setIsGggLinkConfirmOpen] = useState(false);
  const { telemetryCrashReporting, communityUploadsEnabled, updateSetting } =
    useSettings();

  const {
    gggAuthenticated,
    gggUsername,
    isAuthenticating,
    isUnlinking,
    authError,
    logout,
    fetchStatus,
  } = useCommunityUpload();

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCrashReportingToggle = async (enabled: boolean) => {
    await updateSetting(SettingsKey.TelemetryCrashReporting, enabled);
  };

  const handleCommunityUploadsToggle = async (enabled: boolean) => {
    await updateSetting(SettingsKey.CommunityUploadsEnabled, enabled);
  };

  const handleCrashReportingChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    await handleCrashReportingToggle(event.target.checked);
  };

  const handleCommunityUploadsChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    await handleCommunityUploadsToggle(event.target.checked);
  };

  const handleOpenGggLinkConfirm = () => {
    setIsGggLinkConfirmOpen(true);
  };

  const handleCloseGggLinkConfirm = () => {
    setIsGggLinkConfirmOpen(false);
  };

  return (
    <>
      <section className="space-y-3">
        <p className="sr-only">Privacy and telemetry settings</p>

        <CommunityUploadWarning />

        <div
          role="note"
          aria-label="Community data sharing"
          className="alert alert-soft alert-info text-sm py-2"
        >
          <FiInfo className="shrink-0 w-4 h-4" />
          <div className="space-y-1">
            <p>
              When you share community data, we store a random upload ID with
              your uploads.
            </p>
            <p>
              If you verify your data, we associate future uploads with your GGG
              account.
            </p>
            <p>
              Unlinking uses a new anonymous ID for future uploads and leaves
              your sharing settings unchanged. Previously verified uploads stay
              verified and linked to your GGG account.
            </p>
          </div>
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
                <p className="mt-1 text-sm text-base-content/60">
                  Changes take effect after restarting the app.
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

          {/* Community Drop Rates */}
          <div className="py-3">
            <label className="grid cursor-pointer grid-cols-[1fr_33px] gap-4">
              <div style={{ textWrap: "auto" }}>
                <span className="text-sm font-semibold">
                  Community Drop Rates
                </span>
                <p className="mt-1 text-sm text-base-content/60">
                  Share card names and counts to build community statistics.
                  Opening times and in-game areas require your separate
                  agreement below.
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

          {communityUploadsEnabled && (
            <div className="py-3">
              <DropContextConsent />
            </div>
          )}

          {/* GGG Account Link/Unlink */}
          {communityUploadsEnabled && (
            <div className="py-3">
              {gggAuthenticated ? (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-success font-medium">
                    ✓ Verified as <strong>{gggUsername}</strong>
                  </span>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={logout}
                    disabled={isUnlinking}
                    loading={isUnlinking}
                  >
                    Unlink
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div style={{ textWrap: "auto" }}>
                      <p className="text-sm font-semibold">
                        Uploading without a linked account
                      </p>
                      <p className="mt-1 text-sm text-base-content/60">
                        Link your Path of Exile account to show your community
                        drop data as verified.
                      </p>
                      <p className="mt-1 text-sm text-base-content/60">
                        Soothsayer can only see your account name and account
                        ID. No character, stash, item, trade, password, or email
                        access.
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="xs"
                      onClick={handleOpenGggLinkConfirm}
                      disabled={isAuthenticating}
                      loading={isAuthenticating}
                      className="self-start whitespace-nowrap sm:shrink-0"
                    >
                      <FiExternalLink />
                      Link GGG Account
                    </Button>
                  </div>
                </div>
              )}
              {authError && (
                <div
                  role="alert"
                  className="alert alert-soft alert-error text-xs py-1.5 mt-2"
                >
                  {authError}
                </div>
              )}
            </div>
          )}

          {/* Privacy Policy link */}
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-2">
              <span className="text-sm text-base-content/70">
                Privacy Policy
              </span>
            </div>
            <Link to="/privacy-policy" className="btn btn-primary btn-xs gap-1">
              View
            </Link>
          </div>
        </div>
      </section>

      <GggAccountLinkConfirmModal
        isOpen={isGggLinkConfirmOpen}
        onClose={handleCloseGggLinkConfirm}
      />
    </>
  );
};

export default PrivacySettingsCard;
