import type { StateCreator } from "zustand";

import { BANNER_IDS } from "~/main/modules/banners/Banners.types";
import type { CommunityBackfillLeague } from "~/main/modules/community-upload/CommunityUpload.dto";
import type { BoundStore } from "~/renderer/store/store.types";

export interface CommunityUploadSlice {
  communityUpload: {
    // GGG auth status
    gggAuthenticated: boolean;
    gggUsername: string | null;
    gggAccountId: string | null;

    // UI state
    isAuthenticating: boolean;
    isLoadingStatus: boolean;
    authError: string | null;

    // Backfill state
    backfillLeagues: CommunityBackfillLeague[];
    isBackfilling: boolean;
    backfillError: string | null;

    // Actions
    fetchStatus: () => Promise<void>;
    authenticate: () => Promise<void>;
    logout: () => Promise<void>;
    checkBackfill: () => Promise<void>;
    triggerBackfill: () => Promise<boolean>;
    dismissBackfillBanner: () => Promise<boolean>;
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
    isLoadingStatus: false,
    authError: null,

    // Backfill state
    backfillLeagues: [],
    isBackfilling: false,
    backfillError: null,

    // Actions
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
      try {
        const result = await window.electron.gggAuth.logout();

        if (result.success) {
          console.log("[CommunityUploadSlice] Logout successful");

          set(
            ({ communityUpload }) => {
              communityUpload.gggAuthenticated = false;
              communityUpload.gggUsername = null;
              communityUpload.gggAccountId = null;
            },
            false,
            "communityUploadSlice/logout/success",
          );
        }
      } catch (error) {
        console.error("[CommunityUploadSlice] Logout failed:", error);
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
  },
});
