import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FiExternalLink, FiUploadCloud } from "react-icons/fi";

import { BANNER_IDS } from "~/main/modules/banners/Banners.types";
import { useBanners, useCommunityUpload } from "~/renderer/store";

const BackfillBanner = () => {
  const { backfillLeagues, isBackfilling, triggerBackfill, dismissBackfill } =
    useCommunityUpload();

  const { isDismissed, dismiss, isLoaded } = useBanners();

  const [optedIn, setOptedIn] = useState(false);

  const bannerId = BANNER_IDS.COMMUNITY_BACKFILL;
  const permanentlyDismissed = isLoaded && isDismissed(bannerId);

  if (permanentlyDismissed || backfillLeagues.length === 0) return null;

  const handleDismiss = async () => {
    // Persist dismissal to the database so the banner never comes back
    await dismiss(bannerId);
    // Also update the community upload slice for immediate UI feedback
    dismissBackfill();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mt-px bg-success/10 border-b border-success/20 text-xs shadow-[inset_0_-4px_6px_-4px_rgba(0,0,0,0.15)]">
      <FiUploadCloud className="w-4 h-4 text-success shrink-0" />

      <span className="flex-1 text-base-content/70">
        Anonymously contribute your existing and future drop data to community
        statistics on{" "}
        <a
          href="https://wraeclast.cards"
          target="_blank"
          rel="noopener noreferrer"
          className="link link-success"
        >
          wraeclast.cards
          <FiExternalLink className="inline ml-0.5 w-3 h-3 opacity-50" />
        </a>
        .{" "}
        <Link to="/privacy-policy" className="link link-success/50">
          Privacy Policy
          <FiExternalLink className="inline ml-0.5 w-3 h-3 opacity-50" />
        </Link>
      </span>

      <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
        <input
          type="checkbox"
          className="checkbox checkbox-xs [--size:0.875rem] checkbox-success"
          checked={optedIn}
          onChange={(e) => setOptedIn(e.target.checked)}
          disabled={isBackfilling}
        />
        <span className="text-base-content/50">I agree</span>
      </label>

      <button
        type="button"
        className="btn btn-xs btn-success"
        disabled={!optedIn || isBackfilling}
        onClick={triggerBackfill}
      >
        {isBackfilling ? (
          <>
            <span className="loading loading-spinner loading-xs" />
            Uploading…
          </>
        ) : (
          "Contribute"
        )}
      </button>

      <button
        type="button"
        className="btn btn-xs btn-outline btn-ghost"
        onClick={handleDismiss}
        disabled={isBackfilling}
        aria-label="Dismiss"
      >
        Dismiss
      </button>
    </div>
  );
};

export default BackfillBanner;
