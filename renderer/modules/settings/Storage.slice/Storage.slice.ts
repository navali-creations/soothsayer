import type { StateCreator } from "zustand";

import type {
  DiskSpaceCheck,
  LeagueStorageUsage,
  StorageInfo,
} from "~/main/modules/storage/Storage.types";

export interface StorageSlice {
  storage: {
    info: StorageInfo | null;
    leagueUsage: LeagueStorageUsage[];
    isLoading: boolean;
    error: string | null;
    isDiskLow: boolean;
    deletingLeagueId: string | null;

    fetchStorageInfo: () => Promise<void>;
    fetchLeagueUsage: () => Promise<void>;
    deleteLeagueData: (
      leagueId: string,
    ) => Promise<{ success: boolean; freedBytes: number }>;
    checkDiskSpace: () => Promise<void>;
  };
}

export const createStorageSlice: StateCreator<
  StorageSlice,
  [["zustand/devtools", never], ["zustand/immer", never]],
  [],
  StorageSlice
> = (set, get) => ({
  storage: {
    info: null,
    leagueUsage: [],
    isLoading: false,
    error: null,
    isDiskLow: false,
    deletingLeagueId: null,

    fetchStorageInfo: async () => {
      set(
        ({ storage }) => {
          storage.isLoading = true;
          storage.error = null;
        },
        false,
        "storageSlice/fetchStorageInfo/start",
      );

      try {
        const [info, diskCheck] = await Promise.all([
          window.electron.storage.getInfo(),
          window.electron.storage.checkDiskSpace(),
        ]);

        set(
          ({ storage }) => {
            storage.info = info;
            storage.isDiskLow = diskCheck.isLow;
            storage.isLoading = false;
          },
          false,
          "storageSlice/fetchStorageInfo/success",
        );
      } catch (error) {
        console.error("[StorageSlice] Failed to fetch storage info:", error);
        set(
          ({ storage }) => {
            storage.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch storage info";
            storage.isLoading = false;
          },
          false,
          "storageSlice/fetchStorageInfo/error",
        );
      }
    },

    fetchLeagueUsage: async () => {
      set(
        ({ storage }) => {
          storage.isLoading = true;
          storage.error = null;
        },
        false,
        "storageSlice/fetchLeagueUsage/start",
      );

      try {
        const leagueUsage = await window.electron.storage.getLeagueUsage();

        set(
          ({ storage }) => {
            storage.leagueUsage = leagueUsage;
            storage.isLoading = false;
          },
          false,
          "storageSlice/fetchLeagueUsage/success",
        );
      } catch (error) {
        console.error("[StorageSlice] Failed to fetch league usage:", error);
        set(
          ({ storage }) => {
            storage.error =
              error instanceof Error
                ? error.message
                : "Failed to fetch league usage";
            storage.isLoading = false;
          },
          false,
          "storageSlice/fetchLeagueUsage/error",
        );
      }
    },

    deleteLeagueData: async (leagueId: string) => {
      set(
        ({ storage }) => {
          storage.deletingLeagueId = leagueId;
          storage.error = null;
        },
        false,
        "storageSlice/deleteLeagueData/start",
      );

      try {
        const result = await window.electron.storage.deleteLeagueData(leagueId);

        if (!result.success) {
          set(
            ({ storage }) => {
              storage.error = result.error ?? "Failed to delete league data";
              storage.deletingLeagueId = null;
            },
            false,
            "storageSlice/deleteLeagueData/error",
          );
          return { success: false, freedBytes: 0 };
        }

        // Refresh storage info and league usage after successful deletion
        const { storage } = get();
        await Promise.all([
          storage.fetchStorageInfo(),
          storage.fetchLeagueUsage(),
        ]);

        set(
          ({ storage }) => {
            storage.deletingLeagueId = null;
          },
          false,
          "storageSlice/deleteLeagueData/success",
        );

        return { success: true, freedBytes: result.freedBytes };
      } catch (error) {
        console.error("[StorageSlice] Failed to delete league data:", error);
        set(
          ({ storage }) => {
            storage.error =
              error instanceof Error
                ? error.message
                : "Failed to delete league data";
            storage.deletingLeagueId = null;
          },
          false,
          "storageSlice/deleteLeagueData/error",
        );
        return { success: false, freedBytes: 0 };
      }
    },

    checkDiskSpace: async () => {
      try {
        const diskCheck: DiskSpaceCheck =
          await window.electron.storage.checkDiskSpace();

        set(
          ({ storage }) => {
            storage.isDiskLow = diskCheck.isLow;
          },
          false,
          "storageSlice/checkDiskSpace/success",
        );
      } catch (error) {
        console.error("[StorageSlice] Failed to check disk space:", error);
      }
    },
  },
});
