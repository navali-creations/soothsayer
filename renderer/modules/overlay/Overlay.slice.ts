import type { StateCreator } from "zustand";

import type { OverlayTab, SessionData } from "./Overlay.types";

export interface OverlaySlice {
  overlay: {
    // State
    isVisible: boolean;
    isLoading: boolean;
    error: string | null;
    sessionData: SessionData;
    activeTab: OverlayTab;

    // Actions
    hydrate: () => Promise<void>;
    show: () => Promise<void>;
    hide: () => Promise<void>;
    toggle: () => Promise<void>;
    setIsVisible: (isVisible: boolean) => void;
    setPosition: (x: number, y: number) => Promise<void>;
    setSize: (width: number, height: number) => Promise<void>;
    setSessionData: (data: SessionData) => void;
    setActiveTab: (tab: OverlayTab) => void;
    getFilteredDrops: () => SessionData["recentDrops"];
    startListening: () => () => void;
  };
}

export const createOverlaySlice: StateCreator<
  OverlaySlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  OverlaySlice
> = (set, get) => ({
  overlay: {
    // Initial state
    isVisible: false,
    isLoading: false,
    error: null,
    sessionData: {
      totalCount: 0,
      totalProfit: 0,
      chaosToDivineRatio: 0,
      priceSource: "exchange",
      cards: [],
      recentDrops: [],
      isActive: false,
    },
    activeTab: "all",

    // Hydrate overlay visibility state
    hydrate: async () => {
      try {
        const isVisible = await window.electron?.overlay.isVisible();
        set(
          ({ overlay }) => {
            overlay.isVisible = isVisible ?? false;
          },
          false,
          "overlaySlice/hydrate",
        );
      } catch (error) {
        console.error("Failed to get overlay visibility:", error);
      }
    },

    show: async () => {
      await window.electron?.overlay.show();
      set(
        ({ overlay }) => {
          overlay.isVisible = true;
        },
        false,
        "overlaySlice/show",
      );
    },

    hide: async () => {
      await window.electron?.overlay.hide();
      set(
        ({ overlay }) => {
          overlay.isVisible = false;
        },
        false,
        "overlaySlice/hide",
      );
    },

    toggle: async () => {
      await window.electron?.overlay.toggle();
      const isVisible = await window.electron?.overlay.isVisible();
      set(
        ({ overlay }) => {
          overlay.isVisible = isVisible ?? false;
        },
        false,
        "overlaySlice/toggle",
      );
    },

    setIsVisible: (isVisible) => {
      set(
        ({ overlay }) => {
          overlay.isVisible = isVisible;
        },
        false,
        "overlaySlice/setIsVisible",
      );
    },

    setPosition: async (x, y) => {
      await window.electron?.overlay.setPosition(x, y);
    },

    setSize: async (width, height) => {
      await window.electron?.overlay.setSize(width, height);
    },

    setSessionData: (sessionData) => {
      set(
        ({ overlay }) => {
          overlay.sessionData = sessionData;
        },
        false,
        "overlaySlice/setSessionData",
      );
    },

    setActiveTab: (tab) => {
      set(
        ({ overlay }) => {
          overlay.activeTab = tab;
        },
        false,
        "overlaySlice/setActiveTab",
      );
    },

    getFilteredDrops: () => {
      const { sessionData, activeTab } = get().overlay;

      if (!sessionData?.recentDrops) {
        return [];
      }

      if (activeTab === "all") {
        return sessionData.recentDrops;
      }

      // valuable = exclude rarity 4 (common)
      return sessionData.recentDrops.filter((drop) => drop.rarity < 4);
    },

    startListening: () => {
      if (!window.electron?.overlay?.onVisibilityChanged) {
        console.log("[OverlaySlice] onVisibilityChanged not available");
        return () => {};
      }

      console.log("[OverlaySlice] Setting up visibility change listener");

      // Listen for visibility changes from main process
      const cleanup = window.electron.overlay.onVisibilityChanged(
        (isVisible: boolean) => {
          console.log("[OverlaySlice] Visibility changed to:", isVisible);
          set(
            ({ overlay }) => {
              overlay.isVisible = isVisible;
            },
            false,
            "overlaySlice/visibilityChanged",
          );
        },
      );

      return cleanup;
    },
  },
});
