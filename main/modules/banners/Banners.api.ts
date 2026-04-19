import { ipcRenderer } from "electron";

import { BannersChannel } from "./Banners.channels";

export const BannersAPI = {
  isDismissed: (bannerId: string): Promise<boolean> =>
    ipcRenderer.invoke(BannersChannel.IsDismissed, bannerId),

  dismiss: (bannerId: string): Promise<void> =>
    ipcRenderer.invoke(BannersChannel.Dismiss, bannerId),

  getAllDismissed: (): Promise<string[]> =>
    ipcRenderer.invoke(BannersChannel.GetAllDismissed),
};
