import { useCallback, useEffect, useRef } from "react";

import { useBoundStore, useOverlay } from "~/renderer/store";
import type { GameType } from "~/types/data-stores";

import { applyOverlayCardDelta } from "./useOverlaySessionSync.utils";

interface UseOverlaySessionSyncOptions {
  enabled: boolean;
  refreshOverlaySettings: () => Promise<void>;
}

function useOverlaySessionSync({
  enabled,
  refreshOverlaySettings,
}: UseOverlaySessionSyncOptions): void {
  const { setSessionData, detectZone } = useOverlay();
  const activeGameRef = useRef<GameType | null>(null);

  const refreshSessionData = useCallback(async () => {
    try {
      const [activeGame, sessionData] = await Promise.all([
        window.electron.overlay.getActiveGame(),
        window.electron.overlay.getSessionData(),
      ]);
      activeGameRef.current = activeGame;
      if (sessionData) {
        setSessionData(sessionData);
      }
    } catch (error) {
      console.error("[Overlay] Failed to refresh session data:", error);
    }
  }, [setSessionData]);

  useEffect(() => {
    if (!enabled) return;

    detectZone();
    void refreshOverlaySettings();
    void refreshSessionData();

    const unsubscribeStateChange = window.electron.session.onStateChanged(
      (update) => {
        if (update.game !== activeGameRef.current) return;

        if (update.isActive) {
          void refreshOverlaySettings().then(refreshSessionData);
          return;
        }

        void refreshSessionData();
      },
    );

    const unsubscribeCardDelta = window.electron.session.onCardDelta(
      (update) => {
        if (update.game !== activeGameRef.current || !update.delta) {
          return;
        }

        const previous = useBoundStore.getState().overlay.sessionData;
        setSessionData(applyOverlayCardDelta(previous, update.delta));
      },
    );

    const unsubscribeDataInvalidated =
      window.electron.session.onDataInvalidated((update) => {
        if (update.game !== activeGameRef.current) return;
        void refreshSessionData();
      });

    const unsubscribeSettingsChanged =
      window.electron.overlay.onSettingsChanged(() => {
        void refreshOverlaySettings().then(refreshSessionData);
      });

    return () => {
      unsubscribeStateChange();
      unsubscribeCardDelta();
      unsubscribeDataInvalidated();
      unsubscribeSettingsChanged();
    };
  }, [
    detectZone,
    enabled,
    refreshOverlaySettings,
    refreshSessionData,
    setSessionData,
  ]);
}

export { useOverlaySessionSync };
