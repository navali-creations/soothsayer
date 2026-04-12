import { ipcRenderer } from "electron";

import { CommunityUploadChannel } from "./CommunityUpload.channels";

export const CommunityUploadAPI = {
  getUploadStatus: (): Promise<{
    enabled: boolean;
    deviceId: string;
    lastUploadAt: string | null;
  }> => ipcRenderer.invoke(CommunityUploadChannel.GetUploadStatus),

  setUploadsEnabled: (enabled: boolean): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(CommunityUploadChannel.SetUploadsEnabled, enabled),

  getUploadStats: (
    game: "poe1" | "poe2",
    league: string,
  ): Promise<{
    totalUploads: number;
    lastUploadAt: string | null;
  }> => ipcRenderer.invoke(CommunityUploadChannel.GetUploadStats, game, league),
};
