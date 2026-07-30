import clsx from "clsx";
import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import rarity1Sound from "~/renderer/assets/audio/rarity1.mp3";
import rarity2Sound from "~/renderer/assets/audio/rarity2.mp3";
import rarity3Sound from "~/renderer/assets/audio/rarity3.mp3";
import { initSentry } from "~/renderer/sentry";
import { useBoundStore, useOverlay } from "~/renderer/store";

import { initUmami } from "../../umami";
import {
  OverlayContent,
  OverlaySidebar,
  OverlayTabs,
} from "../Overlay.components";
import type { RecentDrop } from "../Overlay.types";
import { useOverlaySessionSync } from "./useOverlaySessionSync/useOverlaySessionSync";

import "../../../index.css";

// Read telemetry settings before initializing Sentry and Umami.
async function initTelemetry() {
  try {
    const settings = await window.electron.settings.getAll();
    initSentry(settings.telemetryCrashReporting);
    initUmami(settings.telemetryUsageAnalytics);
  } catch (error) {
    console.warn(
      "[Overlay] Could not load telemetry settings, skipping telemetry init:",
      error,
    );
  }
}

initTelemetry();

const defaultRaritySounds: Record<number, string> = {
  1: rarity1Sound,
  2: rarity2Sound,
  3: rarity3Sound,
};

interface AudioSettings {
  enabled: boolean;
  volume: number;
  customSounds: Record<number, string>; // rarity -> data URL
}

const OverlayApp = () => {
  const { sessionData, isLocked, isLeftHalf } = useOverlay();
  const previousDropsRef = useRef<RecentDrop[]>([]);
  const [isElectronReady, setIsElectronReady] = useState(
    () => !!window.electron?.overlay && !!window.electron?.session,
  );
  const audioSettingsRef = useRef<AudioSettings>({
    enabled: true,
    volume: 0.5,
    customSounds: {},
  });
  const [fontSize, setFontSize] = useState(1.0);
  const [toolbarFontSize, setToolbarFontSize] = useState(1.0);

  // Load overlay presentation and audio settings from main process
  const loadOverlaySettings = useCallback(async () => {
    try {
      const settings = await window.electron.settings.getAll();
      const customSounds: Record<number, string> = {};

      // Read overlay font sizes
      setFontSize(settings.overlayFontSize ?? 1.0);
      setToolbarFontSize(settings.overlayToolbarFontSize ?? 1.0);

      const { rarityInsights, settings: settingsSlice } =
        useBoundStore.getState();
      settingsSlice.setSetting("raritySource", settings.raritySource);
      settingsSlice.setSetting("selectedFilterId", settings.selectedFilterId);
      rarityInsights.setSelectedFilterId(settings.selectedFilterId);

      if (settings.raritySource === "filter") {
        await rarityInsights.loadFilterTheme(settings.selectedFilterId);
      } else {
        rarityInsights.clearFilterTheme();
      }

      // Load custom sound data for each rarity if paths are set
      const paths = [
        settings.audioRarity1Path,
        settings.audioRarity2Path,
        settings.audioRarity3Path,
      ];

      for (let i = 0; i < paths.length; i++) {
        const soundPath = paths[i];
        if (soundPath) {
          const dataUrl =
            await window.electron.settings.getCustomSoundData(soundPath);
          if (dataUrl) {
            customSounds[i + 1] = dataUrl;
          }
        }
      }

      audioSettingsRef.current = {
        enabled: settings.audioEnabled,
        volume: settings.audioVolume,
        customSounds,
      };
    } catch (error) {
      console.error("[Overlay] Failed to load audio settings:", error);
    }
  }, []);

  // Wait for window.electron to be ready
  useEffect(() => {
    if (isElectronReady) return;

    const checkElectron = () => {
      if (window.electron?.overlay && window.electron?.session) {
        console.log("[Overlay] window.electron is now ready");
        setIsElectronReady(true);
      } else {
        console.warn(
          "[Overlay] window.electron not ready, retrying in 100ms...",
        );
        setTimeout(checkElectron, 100);
      }
    };

    checkElectron();
  }, [isElectronReady]);

  useOverlaySessionSync({
    enabled: isElectronReady,
    refreshOverlaySettings: loadOverlaySettings,
  });

  // Play sound for rare drops
  useEffect(() => {
    if (!sessionData.recentDrops || sessionData.recentDrops.length === 0) {
      previousDropsRef.current = [];
      return;
    }

    const currentFirst = sessionData.recentDrops[0];
    const previousFirst = previousDropsRef.current[0];

    // Check if we have a new drop (different card at index 0)
    if (
      currentFirst &&
      (!previousFirst || currentFirst.cardName !== previousFirst.cardName)
    ) {
      const rarity = currentFirst.rarity ?? 4;
      const { enabled, volume, customSounds } = audioSettingsRef.current;

      // Only play sound for rarity 1, 2, 3 and if audio is enabled
      if (enabled && rarity >= 1 && rarity <= 3) {
        const soundUrl = customSounds[rarity] || defaultRaritySounds[rarity];
        if (soundUrl) {
          const audio = new Audio(soundUrl);
          audio.volume = volume;
          audio.play().catch((err) => console.error("Audio play failed:", err));
        }
      }
    }

    previousDropsRef.current = sessionData.recentDrops;
  }, [sessionData.recentDrops]);

  return (
    <div
      className={clsx(
        "relative grid h-screen w-full backdrop-blur-sm overflow-hidden transition-shadow duration-200",
        !isLocked && "animate-pulse-glow",
      )}
      style={
        {
          "--overlay-font-size": fontSize,
          "--overlay-toolbar-font-size": toolbarFontSize,
          gridTemplateRows: `calc(30px * ${toolbarFontSize}) 1fr`,
        } as React.CSSProperties
      }
    >
      {/* Full-overlay drag handle — covers everything when unlocked */}
      {!isLocked && (
        <div
          className="absolute inset-0 z-100 cursor-grab bg-base-300/20"
          style={{ WebkitAppRegion: "drag" } as React.CSSProperties}
        />
      )}

      <OverlayTabs />
      <div
        className={clsx(
          "relative grid overflow-hidden isolate",
          isLeftHalf ? "grid-cols-[30px_1fr]" : "grid-cols-[1fr_30px]",
        )}
      >
        {isLeftHalf ? (
          <>
            <OverlaySidebar />
            <OverlayContent />
          </>
        ) : (
          <>
            <OverlayContent />
            <OverlaySidebar />
          </>
        )}
      </div>
    </div>
  );
};

export default OverlayApp;

const rootElement = document.getElementById("overlay-root")!;
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <OverlayApp />
    </StrictMode>,
  );
}
