import type { StateCreator } from "zustand";

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

    // Actions
    fetchStatus: () => Promise<void>;
    authenticate: () => Promise<void>;
    logout: () => Promise<void>;
  };
}

export const createCommunityUploadSlice: StateCreator<
  BoundStore,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  CommunityUploadSlice
> = (set, _get) => ({
  communityUpload: {
    // GGG auth status
    gggAuthenticated: false,
    gggUsername: null,
    gggAccountId: null,

    // UI state
    isAuthenticating: false,
    isLoadingStatus: false,
    authError: null,

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
  },
});
