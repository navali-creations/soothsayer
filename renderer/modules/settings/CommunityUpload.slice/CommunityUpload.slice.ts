import type { StateCreator } from "zustand";

import { BANNER_IDS } from "~/main/modules/banners/Banners.types";
import type {
  CommunityBackfillLeague,
  CommunityDropContextUploadStatus,
} from "~/main/modules/community-upload/CommunityUpload.dto";
import type { BoundStore } from "~/renderer/store/store.types";

export interface CommunityUploadSlice {
  communityUpload: {
    // GGG auth status
    gggAuthenticated: boolean;
    gggUsername: string | null;
    gggAccountId: string | null;

    // UI state
    isAuthenticating: boolean;
    isUnlinking: boolean;
    isLoadingStatus: boolean;
    authError: string | null;

    // Backfill state
    backfillLeagues: CommunityBackfillLeague[];
    isBackfilling: boolean;
    backfillError: string | null;
    dropContextUploadStatus: CommunityDropContextUploadStatus;
    dropContextConsent: boolean | null;
    dropContextConsentLoaded: boolean;
    isLoadingDropContextConsent: boolean;
    isSavingDropContextConsent: boolean;
    dropContextConsentError: string | null;

    // Actions
    fetchStatus: () => Promise<void>;
    fetchDropContextConsent: () => Promise<void>;
    setDropContextConsent: (enabled: boolean) => Promise<boolean>;
    authenticate: () => Promise<void>;
    logout: () => Promise<void>;
    checkBackfill: () => Promise<void>;
    triggerBackfill: () => Promise<boolean>;
    dismissBackfillBanner: () => Promise<boolean>;
    refreshDropContextUploadStatus: () => Promise<void>;
    startListening: () => () => void;
  };
}

export const createCommunityUploadSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  CommunityUploadSlice
> = (set, get) => ({
  communityUpload: {
    // GGG auth status
    gggAuthenticated: false,
    gggUsername: null,
    gggAccountId: null,

    // UI state
    isAuthenticating: false,
    isUnlinking: false,
    isLoadingStatus: false,
    authError: null,

    // Backfill state
    backfillLeagues: [],
    isBackfilling: false,
    backfillError: null,
    dropContextConsent: null,
    dropContextConsentLoaded: false,
    isLoadingDropContextConsent: false,
    isSavingDropContextConsent: false,
    dropContextConsentError: null,
    dropContextUploadStatus: {
      pendingEvents: 0,
      isUploading: false,
      revision: -1,
    },

    // Actions
    fetchDropContextConsent: async () => {
      const state = get().communityUpload;
      if (state.dropContextConsentLoaded || state.isLoadingDropContextConsent) {
        return;
      }
      set(({ communityUpload }) => {
        communityUpload.isLoadingDropContextConsent = true;
        communityUpload.dropContextConsentError = null;
      });
      try {
        const result =
          await window.electron.communityUpload.getDropContextConsent();
        if (!result.success) throw new Error("Consent could not be loaded");
        set(({ communityUpload }) => {
          communityUpload.dropContextConsent = result.consent;
          communityUpload.dropContextConsentLoaded = true;
        });
      } catch {
        set(({ communityUpload }) => {
          communityUpload.dropContextConsentError =
            "Your sharing preference could not be loaded. Please try again.";
        });
      } finally {
        set(({ communityUpload }) => {
          communityUpload.isLoadingDropContextConsent = false;
        });
      }
    },

    setDropContextConsent: async (enabled) => {
      if (get().communityUpload.isSavingDropContextConsent) return false;
      set(({ communityUpload }) => {
        communityUpload.isSavingDropContextConsent = true;
        communityUpload.dropContextConsentError = null;
      });
      try {
        const result =
          await window.electron.communityUpload.setDropContextConsent(enabled);
        if (!result.success) throw new Error("Consent could not be saved");
        set(({ communityUpload }) => {
          communityUpload.dropContextConsent = result.consent;
          communityUpload.dropContextConsentLoaded = true;
        });
        await get().communityUpload.refreshDropContextUploadStatus();
        return true;
      } catch {
        set(({ communityUpload }) => {
          communityUpload.dropContextConsentError =
            "Your sharing preference could not be saved. Please try again.";
        });
        return false;
      } finally {
        set(({ communityUpload }) => {
          communityUpload.isSavingDropContextConsent = false;
        });
      }
    },

    fetchStatus: async () => {
      set(
        ({ communityUpload }) => {
          communityUpload.isLoadingStatus = true;
        },
        false,
        "communityUploadSlice/fetchStatus/start",
      );

      try {
        const authStatus = await window.electron.gggAuth.getAuthStatus();

        console.log(
          `[CommunityUploadSlice] Fetched status: authenticated=${
            authStatus.authenticated
          }, username=${authStatus.username ? "[redacted]" : "null"}`,
        );

        set(
          ({ communityUpload }) => {
            communityUpload.gggAuthenticated = authStatus.authenticated;
            communityUpload.gggUsername = authStatus.username;
            communityUpload.gggAccountId = authStatus.accountId;
            communityUpload.isLoadingStatus = false;
          },
          false,
          "communityUploadSlice/fetchStatus/success",
        );
      } catch (error) {
        console.error("[CommunityUploadSlice] Failed to fetch status:", error);
        set(
          ({ communityUpload }) => {
            communityUpload.isLoadingStatus = false;
          },
          false,
          "communityUploadSlice/fetchStatus/error",
        );
      }
    },

    authenticate: async () => {
      set(
        ({ communityUpload }) => {
          communityUpload.isAuthenticating = true;
          communityUpload.authError = null;
        },
        false,
        "communityUploadSlice/authenticate/start",
      );

      try {
        const result = await window.electron.gggAuth.authenticate();

        if (result.success) {
          console.log(
            `[CommunityUploadSlice] Authentication successful: username=${
              result.username ? "[redacted]" : "null"
            }`,
          );

          set(
            ({ communityUpload }) => {
              communityUpload.gggAuthenticated = true;
              communityUpload.gggUsername = result.username ?? null;
              communityUpload.gggAccountId = result.accountId ?? null;
              communityUpload.isAuthenticating = false;
            },
            false,
            "communityUploadSlice/authenticate/success",
          );
        } else {
          console.error(
            `[CommunityUploadSlice] Authentication failed: ${result.error}`,
          );

          set(
            ({ communityUpload }) => {
              communityUpload.authError =
                result.error ?? "Authentication failed";
              communityUpload.isAuthenticating = false;
            },
            false,
            "communityUploadSlice/authenticate/failure",
          );
        }
      } catch (error) {
        console.error("[CommunityUploadSlice] Authentication error:", error);

        set(
          ({ communityUpload }) => {
            communityUpload.authError =
              error instanceof Error ? error.message : "Authentication failed";
            communityUpload.isAuthenticating = false;
          },
          false,
          "communityUploadSlice/authenticate/error",
        );
      }
    },

    logout: async () => {
      if (get().communityUpload.isUnlinking) return;
      set(({ communityUpload }) => {
        communityUpload.isUnlinking = true;
        communityUpload.authError = null;
      });
      try {
        const result = await window.electron.gggAuth.logout();
        if (!result.success) throw new Error("Unlink was not acknowledged");
        console.log("[CommunityUploadSlice] Logout successful");

        set(
          ({ communityUpload }) => {
            communityUpload.gggAuthenticated = false;
            communityUpload.gggUsername = null;
            communityUpload.gggAccountId = null;
            communityUpload.authError = null;
          },
          false,
          "communityUploadSlice/logout/success",
        );
      } catch {
        // An expired token may have cleared local sign-in. Refresh it so the
        // user can reconnect, while retaining a visible server-unlink error.
        await get().communityUpload.fetchStatus();
        set(({ communityUpload }) => {
          communityUpload.authError =
            "Your community data could not be unlinked. Check your connection or link your GGG account again, then retry.";
        });
      } finally {
        set(({ communityUpload }) => {
          communityUpload.isUnlinking = false;
        });
      }
    },

    checkBackfill: async () => {
      try {
        const result =
          await window.electron.communityUpload.getBackfillLeagues();
        if (!result.success) {
          console.error(
            "[CommunityUploadSlice] Failed to check backfill eligibility.",
          );
          return;
        }

        set(
          ({ communityUpload }) => {
            communityUpload.backfillLeagues = result.leagues;
            communityUpload.backfillError = null;
          },
          false,
          "communityUploadSlice/checkBackfill/success",
        );
      } catch {
        console.error(
          "[CommunityUploadSlice] Failed to check backfill eligibility.",
        );
      }
    },

    triggerBackfill: async () => {
      set(
        ({ communityUpload }) => {
          communityUpload.isBackfilling = true;
          communityUpload.backfillError = null;
        },
        false,
        "communityUploadSlice/triggerBackfill/start",
      );

      try {
        const result = await window.electron.communityUpload.triggerBackfill();
        await get().settings.hydrate();
        if (!result.success) {
          console.error("[CommunityUploadSlice] Backfill trigger failed.");
          set(
            ({ communityUpload }) => {
              communityUpload.isBackfilling = false;
              communityUpload.backfillError = result.error;
            },
            false,
            "communityUploadSlice/triggerBackfill/failure",
          );
          return false;
        }

        get().banners.markDismissed(BANNER_IDS.COMMUNITY_BACKFILL);

        set(
          ({ communityUpload }) => {
            communityUpload.isBackfilling = false;
            communityUpload.backfillLeagues = [];
            communityUpload.backfillError = null;
          },
          false,
          "communityUploadSlice/triggerBackfill/success",
        );
        return true;
      } catch {
        console.error("[CommunityUploadSlice] Backfill trigger failed.");

        set(
          ({ communityUpload }) => {
            communityUpload.isBackfilling = false;
            communityUpload.backfillError =
              "Community data could not be queued. Please try again.";
          },
          false,
          "communityUploadSlice/triggerBackfill/error",
        );
        return false;
      }
    },

    dismissBackfillBanner: async () => {
      const dismissed = await get().banners.dismiss(
        BANNER_IDS.COMMUNITY_BACKFILL,
      );
      set(
        ({ communityUpload }) => {
          communityUpload.backfillError = dismissed
            ? null
            : "The banner preference could not be saved. Please try again.";
        },
        false,
        dismissed
          ? "communityUploadSlice/dismissBackfillBanner/success"
          : "communityUploadSlice/dismissBackfillBanner/error",
      );
      return dismissed;
    },

    refreshDropContextUploadStatus: async () => {
      try {
        const result =
          await window.electron.communityUpload.getDropContextUploadStatus();
        if (!result.success) {
          console.error(
            "[CommunityUploadSlice] Failed to fetch card-history upload status.",
          );
          return;
        }

        set(
          ({ communityUpload }) => {
            if (
              result.status.revision >=
              communityUpload.dropContextUploadStatus.revision
            ) {
              communityUpload.dropContextUploadStatus = result.status;
            }
          },
          false,
          "communityUploadSlice/refreshDropContextUploadStatus/success",
        );
      } catch {
        console.error(
          "[CommunityUploadSlice] Failed to fetch card-history upload status.",
        );
      }
    },

    startListening: () => {
      const unsubscribe =
        window.electron.communityUpload.onDropContextUploadStatusChanged(
          (status) => {
            set(
              ({ communityUpload }) => {
                if (
                  status.revision >=
                  communityUpload.dropContextUploadStatus.revision
                ) {
                  communityUpload.dropContextUploadStatus = status;
                }
              },
              false,
              "communityUploadSlice/dropContextUploadStatusChanged",
            );
          },
        );

      void get().communityUpload.refreshDropContextUploadStatus();
      void get().communityUpload.fetchDropContextConsent();
      return unsubscribe;
    },
  },
});
