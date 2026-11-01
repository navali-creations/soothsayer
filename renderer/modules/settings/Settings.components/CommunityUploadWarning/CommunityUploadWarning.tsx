import { FiAlertTriangle } from "react-icons/fi";

import { Link } from "~/renderer/components";
import {
  useCommunityUploadShallow,
  useSettingsSelector,
} from "~/renderer/store";

const CommunityUploadWarning = ({ showSettingsLink = false }) => {
  const enabled = useSettingsSelector(
    (settings) => settings.communityUploadsEnabled,
  );
  const warning = useCommunityUploadShallow(
    (communityUpload) => communityUpload.dropContextUploadStatus.uploadWarning,
  );

  if (!enabled || !warning) return null;

  return (
    <div
      role="alert"
      aria-label="Community uploads paused"
      className="alert alert-soft alert-warning text-sm py-2"
    >
      <FiAlertTriangle className="shrink-0 w-4 h-4" />
      <div className="space-y-1">
        <p className="font-semibold">Some community uploads are paused.</p>
        <p>
          {warning === "account-mismatch"
            ? "These contributions belong to a different GGG account. Link that account to resume their uploads."
            : "Link the GGG account previously used to verify these contributions to resume their uploads."}{" "}
          Your card history is saved on this device.
        </p>
        {showSettingsLink && (
          <Link to="/settings" search={{ tab: "privacy" }} className="link">
            Settings → Privacy
          </Link>
        )}
      </div>
    </div>
  );
};

export default CommunityUploadWarning;
