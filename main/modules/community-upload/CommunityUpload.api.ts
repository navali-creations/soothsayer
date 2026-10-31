import { ipcRenderer } from "electron";

import { CommunityUploadChannel } from "./CommunityUpload.channels";
import type {
  CommunityBackfillLeaguesResult,
  CommunityBackfillResult,
  CommunityDropContextConsentResult,
  CommunityDropContextUploadStatus,
  CommunityDropContextUploadStatusResult,
} from "./CommunityUpload.dto";

export const CommunityUploadAPI = {
  getDropContextConsent: (): Promise<CommunityDropContextConsentResult> =>
    ipcRenderer.invoke(CommunityUploadChannel.GetDropContextConsent),

  setDropContextConsent: (
    enabled: boolean,
  ): Promise<CommunityDropContextConsentResult> =>
    ipcRenderer.invoke(CommunityUploadChannel.SetDropContextConsent, enabled),

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
