import { useEffect } from "react";
import { FiExternalLink, FiShield, FiUploadCloud } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

const PRIVACY_POLICY_URL =
  "https://github.com/navali-creations/soothsayer/blob/master/PRIVACY.md";

const SetupTelemetryStep = () => {
  const { hydrate } = useBoundStore((s) => s.settings);

  // The backend enables crash reporting when entering step 4. Re-hydrate so
  // the renderer state picks up that value after the initial hydration.
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div>
      <h2 className="text-xl font-semibold text-base-content mb-1">
        Privacy & Telemetry
      </h2>

      <p className="text-sm text-base-content/60 mb-4">
        Soothsayer can share limited data to help improve the app. Here&apos;s
        what we use and why:
      </p>

      <div className="space-y-3">
        {/* Crash Reporting */}
        <div className="bg-base-100 border border-base-content/10 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary">
              <FiShield className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base-content">
                Crash Reporting
                <span className="ml-2 badge badge-sm badge-ghost font-normal">
                  Sentry
                </span>
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                When something goes wrong, an anonymous error report is sent so
                we can find and fix bugs quickly. This includes the error type,
                your OS, and app version.
              </p>
              <p className="text-xs text-base-content/50 mt-1.5 italic">
                No usernames, file paths, or IP addresses are stored.
              </p>
            </div>
          </div>
        </div>

        {/* Community Drop Rates */}
        <div className="bg-base-100 border border-base-content/10 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="mt-0.5 text-primary">
              <FiUploadCloud className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-base-content">
                Community Drop Rates
              </h3>
              <p className="text-xs text-base-content/60 mt-1">
                Card names, drop counts, in-game area names, and the local
                minute and UTC offset when a card was opened are shared with a
                random installation ID to help build community drop statistics
                on{" "}
                <a
                  href="https://wraeclast.cards"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="link link-primary inline-flex items-center gap-0.5"
                >
                  wraeclast.cards <FiExternalLink className="w-3 h-3" />
                </a>
                . Exact dates and timestamps stay on your device. A linked Path
                of Exile account can associate uploads with that account. You
                can disable this in Settings at any time. Preserved Client.txt
                entries may enrich earlier drops with the same context.
              </p>
            </div>
          </div>
        </div>
      </div>

      <p className="text-xs text-base-content/50 mt-4">
        Both are enabled by default. You can opt out of either at any time in{" "}
        <span className="font-semibold text-base-content/70">
          Settings → Privacy & Telemetry
        </span>
        .
      </p>

      <p className="text-xs text-base-content/50 mt-2">
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
