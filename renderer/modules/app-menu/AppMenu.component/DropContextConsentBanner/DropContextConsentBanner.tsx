import {
  useCommunityUploadShallow,
  useSettingsSelector,
} from "~/renderer/store";

import DropContextConsent from "../../../settings/Settings.components/DropContextConsent/DropContextConsent";

const DropContextConsentBanner = () => {
  const uploadsEnabled = useSettingsSelector((s) => s.communityUploadsEnabled);
  const { loaded, consent } = useCommunityUploadShallow((s) => ({
    loaded: s.dropContextConsentLoaded,
    consent: s.dropContextConsent,
  }));

  if (!uploadsEnabled || !loaded || consent !== null) return null;

  return (
    <section
      aria-label="Choose whether to share opening times and areas"
      className="mt-px border-b border-success/20 bg-success/10 px-4 py-3 shadow-[inset_0_-4px_6px_-4px_rgba(0,0,0,0.15)]"
    >
      <DropContextConsent variant="banner" />
    </section>
  );
};

export default DropContextConsentBanner;
