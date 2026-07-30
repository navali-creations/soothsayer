import { Link } from "@tanstack/react-router";
import { useState } from "react";
import { FiExternalLink, FiUploadCloud } from "react-icons/fi";

import { BANNER_IDS } from "~/main/modules/banners/Banners.types";
import { useBannersShallow, useCommunityUploadShallow } from "~/renderer/store";

const BACKFILL_BANNER_ID = BANNER_IDS.COMMUNITY_BACKFILL;

const BackfillBanner = () => {
  const {
    backfillLeagues,
    isBackfilling,
    backfillError,
    triggerBackfill,
    dismissBackfillBanner,
  } = useCommunityUploadShallow((communityUpload) => ({
    backfillLeagues: communityUpload.backfillLeagues,
    isBackfilling: communityUpload.isBackfilling,
    backfillError: communityUpload.backfillError,
    triggerBackfill: communityUpload.triggerBackfill,
    dismissBackfillBanner: communityUpload.dismissBackfillBanner,
  }));

  const { permanentlyDismissed, loadStatus } = useBannersShallow((banners) => ({
    permanentlyDismissed: banners.dismissedIds.has(BACKFILL_BANNER_ID),
    loadStatus: banners.loadStatus,
  }));

  const [optedIn, setOptedIn] = useState(false);

  if (
    loadStatus !== "ready" ||
    permanentlyDismissed ||
    backfillLeagues.length === 0
  ) {
    return null;
  }

  const handleOptInChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setOptedIn(event.target.checked);
  };

  const handleContribute = async () => {
    await triggerBackfill();
  };

  const handleDismiss = async () => {
    await dismissBackfillBanner();
  };

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 mt-px bg-success/10 border-b border-success/20 text-xs shadow-[inset_0_-4px_6px_-4px_rgba(0,0,0,0.15)]">
      <FiUploadCloud className="w-4 h-4 text-success shrink-0" />

      <span className="flex-1 text-base-content/70">
        <span>
          Contribute your existing and future drop data to community statistics
          on{" "}
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
        {backfillError && (
          <span className="block mt-0.5 text-error" role="alert">
            {backfillError}
          </span>
        )}
      </span>

      <label className="flex items-center gap-1.5 cursor-pointer select-none shrink-0">
        <input
          type="checkbox"
          className="checkbox checkbox-xs [--size:0.875rem] checkbox-success"
          checked={optedIn}
          onChange={handleOptInChange}
          disabled={isBackfilling}
        />
        <span className="text-base-content/50">I agree</span>
      </label>

      <button
        type="button"
        className="btn btn-xs btn-success"
        disabled={!optedIn || isBackfilling}
        onClick={handleContribute}
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
