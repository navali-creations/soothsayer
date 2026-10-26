import { ipcRenderer } from "electron";

import { CommunityUploadChannel } from "./CommunityUpload.channels";
import type {
  CommunityBackfillLeaguesResult,
  CommunityBackfillResult,
  CommunityDropContextUploadStatus,
  CommunityDropContextUploadStatusResult,
} from "./CommunityUpload.dto";

export const CommunityUploadAPI = {
  getBackfillLeagues: (): Promise<CommunityBackfillLeaguesResult> =>
    ipcRenderer.invoke(CommunityUploadChannel.GetBackfillLeagues),

  getDropContextUploadStatus:
    (): Promise<CommunityDropContextUploadStatusResult> =>
      ipcRenderer.invoke(CommunityUploadChannel.GetDropContextUploadStatus),

  triggerBackfill: (): Promise<CommunityBackfillResult> =>
    ipcRenderer.invoke(CommunityUploadChannel.TriggerBackfill),

  onDropContextUploadStatusChanged: (
    callback: (status: CommunityDropContextUploadStatus) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      status: CommunityDropContextUploadStatus,
    ) => callback(status);
    ipcRenderer.on(
      CommunityUploadChannel.DropContextUploadStatusChanged,
      handler,
    );
    return () =>
      ipcRenderer.removeListener(
        CommunityUploadChannel.DropContextUploadStatusChanged,
        handler,
      );
  },
};
