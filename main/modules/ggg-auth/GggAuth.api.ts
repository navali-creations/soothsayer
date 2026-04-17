import { ipcRenderer } from "electron";

import { GggAuthChannel } from "./GggAuth.channels";

export const GggAuthAPI = {
  getAuthStatus: (): Promise<{
    authenticated: boolean;
    username: string | null;
    accountId: string | null;
  }> => ipcRenderer.invoke(GggAuthChannel.GetAuthStatus),

  authenticate: (): Promise<{
    success: boolean;
    username?: string;
    accountId?: string;
    error?: string;
  }> => ipcRenderer.invoke(GggAuthChannel.Authenticate),

  logout: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(GggAuthChannel.Logout),
};
