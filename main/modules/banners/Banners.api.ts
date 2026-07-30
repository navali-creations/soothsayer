import { ipcRenderer } from "electron";

import { BannersChannel } from "./Banners.channels";
import type {
  BannerDismissalsResult,
  BannerDismissResult,
  BannerId,
} from "./Banners.types";

export const BannersAPI = {
  dismiss: (bannerId: BannerId): Promise<BannerDismissResult> =>
    ipcRenderer.invoke(BannersChannel.Dismiss, bannerId),

  getAllDismissed: (): Promise<BannerDismissalsResult> =>
    ipcRenderer.invoke(BannersChannel.GetAllDismissed),
};
