import { ipcRenderer } from "electron";

import { StorageChannel } from "./Storage.channels";
import type {
  DeleteLeagueDataResult,
  DiskSpaceCheck,
  LeagueStorageUsage,
  StorageInfo,
} from "./Storage.types";

const StorageAPI = {
  getInfo: (): Promise<StorageInfo> =>
    ipcRenderer.invoke(StorageChannel.GetInfo),

  getLeagueUsage: (): Promise<LeagueStorageUsage[]> =>
    ipcRenderer.invoke(StorageChannel.GetLeagueUsage),

  deleteLeagueData: (leagueId: string): Promise<DeleteLeagueDataResult> =>
    ipcRenderer.invoke(StorageChannel.DeleteLeagueData, leagueId),

  checkDiskSpace: (): Promise<DiskSpaceCheck> =>
    ipcRenderer.invoke(StorageChannel.CheckDiskSpace),

  revealPaths: (): Promise<{ appDataPath: string }> =>
    ipcRenderer.invoke(StorageChannel.RevealPaths),
};

export { StorageAPI };
