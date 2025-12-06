import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import { createSessionSlice, type SessionSlice } from "./sessionSlice";
import { createSettingsSlice, type SettingsSlice } from "./settingsSlice";
import { createSetupSlice, type SetupSlice } from "./setupSlice";

interface RootActions {
  hydrate: () => Promise<void>;
  startListeners: () => () => void;
  reset: () => void;
}

type BoundStore = SettingsSlice & SetupSlice & SessionSlice & RootActions;

export const useBoundStore = create<BoundStore>()(
  devtools(
    immer((...a) => {
      const settingsSlice = createSettingsSlice(...a);
      const setupSlice = createSetupSlice(...a);
      const sessionSlice = createSessionSlice(...a);

      return {
        ...settingsSlice,
        ...setupSlice,
        ...sessionSlice,

        hydrate: async () => {
          await Promise.all([
            settingsSlice.hydrate(),
            setupSlice.hydrate(),
            sessionSlice.hydrate(),
          ]);
        },

        // Start all listeners
        startListeners: () => {
          const unsubscribeSession = sessionSlice.startListening();

          return () => {
            unsubscribeSession();
          };
        },

        reset: () => {
          a[0]((state) => {
            state.settings = null;
            state.setupState = null;
            state.poe1Session = null;
            state.poe2Session = null;
            state.isLoading = false;
            state.error = null;
          });
        },
      };
    }),
  ),
);
