import type { StateCreator } from "zustand";

export interface OverlaySlice {
  overlay: {
    // State
    isVisible: boolean;
    isLoading: boolean;
    error: string | null;

    // Actions
    hydrate: () => Promise<void>;
    show: () => Promise<void>;
    hide: () => Promise<void>;
    toggle: () => Promise<void>;
    setIsVisible: (isVisible: boolean) => void;
    setPosition: (x: number, y: number) => Promise<void>;
    setSize: (width: number, height: number) => Promise<void>;
    setOpacity: (opacity: number) => Promise<void>;
  };
}

export const createOverlaySlice: StateCreator<
  OverlaySlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  OverlaySlice
> = (set) => ({
  overlay: {
    // Initial state
    isVisible: false,
    isLoading: false,
    error: null,

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

    setOpacity: async (opacity) => {
      await window.electron?.overlay.setOpacity(opacity);
    },
  },
});
