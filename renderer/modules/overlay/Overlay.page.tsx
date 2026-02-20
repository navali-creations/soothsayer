import { StrictMode, useCallback, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";

import rarity1Sound from "~/renderer/assets/audio/rarity1.mp3";
import rarity2Sound from "~/renderer/assets/audio/rarity2.mp3";
import rarity3Sound from "~/renderer/assets/audio/rarity3.mp3";
import { initSentry } from "~/renderer/sentry";
import { useBoundStore } from "~/renderer/store";

import { initUmami } from "../umami";
import {
  OverlayDropsList,
  OverlayEmpty,
  OverlayTabs,
} from "./Overlay.components";
import type { SessionData } from "./Overlay.types";

import "../../index.css";

initSentry();
initUmami();

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
  const {
    overlay: { sessionData, setSessionData },
  } = useBoundStore();
  const previousDropsRef = useRef<any[]>([]);
  const [isElectronReady, setIsElectronReady] = useState(
    () => !!window.electron?.overlay && !!window.electron?.session,
  );
  const priceSourceRef = useRef<"exchange" | "stash">("exchange");
  const audioSettingsRef = useRef<AudioSettings>({
    enabled: true,
    volume: 0.5,
    customSounds: {},
  });

  // Load audio settings and price source from main process
  const loadAudioSettings = useCallback(async () => {
    try {
      const settings = await window.electron.settings.getAll();
      const customSounds: Record<number, string> = {};

      // Resolve the user's price source for the active game
      const activeGame = settings.selectedGame || "poe1";
      priceSourceRef.current =
        activeGame === "poe1"
          ? settings.poe1PriceSource || "exchange"
          : settings.poe2PriceSource || "exchange";

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

  useEffect(() => {
    // Guard against window.electron not being ready yet
    if (!isElectronReady) return;

    // Load audio settings
    loadAudioSettings();

    // Fetch initial session data
    window.electron.overlay.getSessionData().then((data) => {
      if (data) {
        setSessionData(data);
      }
    });

    // Listen for session STATE changes (start/stop)
    const unsubscribeStateChange = window.electron.session.onStateChanged(
      (update) => {
        if (update.isActive) {
          // Session started - fetch the full data and refresh audio settings
          loadAudioSettings();
          window.electron?.overlay.getSessionData().then((data) => {
            if (data) {
              setSessionData(data);
            }
          });
        } else {
          // Session stopped
          setSessionData({
            isActive: false,
            totalCount: 0,
            totalProfit: 0,
            chaosToDivineRatio: 0,
            priceSource: "exchange",
            cards: [],
            recentDrops: [],
          });
        }
      },
    );

    // Listen for session DATA updates (new cards, etc)
    const unsubscribeDataUpdate = window.electron.session.onDataUpdated(
      (update) => {
        if (update.data) {
          const priceSource = priceSourceRef.current;
          const totals = update.data.totals?.[priceSource];

          const formattedData: SessionData = {
            isActive: true,
            totalCount: update.data.totalCount || 0,
            totalProfit: totals?.totalValue || 0,
            chaosToDivineRatio: totals?.chaosToDivineRatio || 0,
            priceSource,
            cards: update.data.cards
              ? update.data.cards.map((card) => ({
                  cardName: card.name,
                  count: card.count,
                }))
              : [],
            recentDrops: (update.data.recentDrops || []).map((drop) => ({
              ...drop,
              rarity: drop.rarity ?? 4, // Default to common if rarity not present
            })),
          };

          setSessionData(formattedData);
        }
      },
    );

    // Listen for settings changes (e.g. price source changed mid-session)
    const unsubscribeSettingsChanged =
      window.electron.overlay.onSettingsChanged?.(() => {
        // Re-read price source and audio settings
        loadAudioSettings().then(() => {
          // Re-fetch session data with the updated price source
          window.electron?.overlay.getSessionData().then((data) => {
            if (data) {
              setSessionData(data);
            }
          });
        });
      });

    return () => {
      unsubscribeStateChange?.();
      unsubscribeDataUpdate?.();
      unsubscribeSettingsChanged?.();
    };
  }, [isElectronReady, setSessionData, loadAudioSettings]);

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
    <div className="grid grid-rows-[30px_1fr] h-screen w-full backdrop-blur-sm overflow-hidden">
      <div className="relative z-50">
        <OverlayTabs />
      </div>
      <div className="relative grid grid-cols-[1fr_30px] overflow-hidden isolate ">
        <div className="flex flex-col-reverse overflow-hidden">
          {sessionData.isActive ? <OverlayDropsList /> : <OverlayEmpty />}
        </div>
        <div className="flex items-start justify-center bg-gradient-to-b from-base-300 from-50% to-transparent cursor-default select-none">
          <span
            className="pt-1 text-sm font-semibold tracking-wider whitespace-nowrap text-base-content/50"
            style={{
              writingMode: "vertical-rl",
              textOrientation: "sideways",
            }}
          >
            soothsayer
          </span>
        </div>
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
