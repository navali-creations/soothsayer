import clsx from "clsx";
import { type ChangeEvent, useEffect, useId } from "react";

import {
  useCommunityUploadShallow,
  useSettingsSelector,
} from "~/renderer/store";

const DropContextConsent = ({
  variant = "settings",
}: {
  variant?: "settings" | "setup" | "banner";
}) => {
  const titleId = useId();
  const descriptionId = useId();
  const uploadsEnabled = useSettingsSelector((s) => s.communityUploadsEnabled);
  const { consent, loaded, saving, error, fetchConsent, setConsent } =
    useCommunityUploadShallow((s) => ({
      consent: s.dropContextConsent,
      loaded: s.dropContextConsentLoaded,
      saving: s.isSavingDropContextConsent,
      error: s.dropContextConsentError,
      fetchConsent: s.fetchDropContextConsent,
      setConsent: s.setDropContextConsent,
    }));

  useEffect(() => {
    void fetchConsent();
  }, [fetchConsent]);

  const handleConsentChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await setConsent(event.target.checked);
  };

  const handleAgree = async () => {
    await setConsent(true);
  };

  const handleDisagree = async () => {
    await setConsent(false);
  };

  if (!uploadsEnabled) return null;

  return (
    <div className="space-y-2 text-sm">
      <div
        className={clsx({
          "grid grid-cols-[1fr_33px] gap-4": variant === "settings",
        })}
      >
        <div className="space-y-2">
          <p
            id={titleId}
            className={clsx("font-semibold", {
              "text-success": variant === "banner",
            })}
          >
            Opening Times & Areas
          </p>
          <p id={descriptionId} className="text-base-content/60">
            Share the local minute of day, UTC offset, and in-game area where
            you opened each card for community statistics on{" "}
            <a
              href="https://wraeclast.cards/"
              target="_blank"
              rel="noopener noreferrer"
              className={clsx("link", {
                "link-success": variant === "banner",
                "link-primary": variant !== "banner",
              })}
            >
              https://wraeclast.cards/
            </a>
            .{" "}
            <strong className="font-bold text-base-content">
              These times show time-of-day patterns.
            </strong>{" "}
            Areas are locations in Path of Exile, not your real-world location.
            Exact dates and timestamps stay on your device. This also includes
            earlier openings that can be matched to preserved Client.txt
            entries.
          </p>
        </div>
        {variant === "settings" && (
          <input
            type="checkbox"
            className="toggle toggle-sm toggle-primary"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            checked={consent === true}
            disabled={!loaded || saving}
            onChange={handleConsentChange}
          />
        )}
      </div>
      {variant === "banner" && (
        <div className="flex gap-2">
          <button
            type="button"
            className="btn btn-sm btn-success"
            aria-describedby={descriptionId}
            disabled={!loaded || saving}
            onClick={handleAgree}
          >
            Agree
          </button>
          <button
            type="button"
            className="btn btn-sm btn-error"
            aria-describedby={descriptionId}
            disabled={!loaded || saving}
            onClick={handleDisagree}
          >
            Disagree
          </button>
        </div>
      )}
      {variant === "setup" && (
        <label className="flex cursor-pointer items-start gap-2 text-success">
          <input
            type="checkbox"
            className="checkbox checkbox-sm checkbox-success mt-0.5 shrink-0"
            aria-describedby={descriptionId}
            checked={consent === true}
            disabled={!loaded || saving}
            onChange={handleConsentChange}
          />
          <span>I agree to share my card opening times and in-game areas.</span>
        </label>
      )}
      {variant === "banner" && (
        <p className="text-xs text-base-content/50">
          You can change this choice in Settings → Privacy & Telemetry at any
          time. Changes apply to future uploads without restarting the app.
        </p>
      )}
      {error && (
        <div role="alert" className="text-error">
          {error}{" "}
          {!loaded && (
            <button type="button" className="link" onClick={fetchConsent}>
              Try again
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default DropContextConsent;
