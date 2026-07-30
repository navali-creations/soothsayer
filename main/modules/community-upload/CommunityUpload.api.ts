import { ipcRenderer } from "electron";

import { CommunityUploadChannel } from "./CommunityUpload.channels";
import type {
  CommunityBackfillLeaguesResult,
  CommunityBackfillResult,
} from "./CommunityUpload.dto";

export const CommunityUploadAPI = {
  getBackfillLeagues: (): Promise<CommunityBackfillLeaguesResult> =>
    ipcRenderer.invoke(CommunityUploadChannel.GetBackfillLeagues),

  triggerBackfill: (): Promise<CommunityBackfillResult> =>
    ipcRenderer.invoke(CommunityUploadChannel.TriggerBackfill),
};
