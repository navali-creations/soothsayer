import { ipcRenderer } from "electron";

import { UpdaterChannel } from "./Updater.channels";
import type { DownloadProgress, UpdateInfo } from "./Updater.service";

const UpdaterAPI = {
  checkForUpdates: (): Promise<UpdateInfo | null> =>
    ipcRenderer.invoke(UpdaterChannel.CheckForUpdates),
  getUpdateInfo: (): Promise<UpdateInfo | null> =>
    ipcRenderer.invoke(UpdaterChannel.GetUpdateInfo),
  downloadUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(UpdaterChannel.DownloadUpdate),
  installUpdate: (): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke(UpdaterChannel.InstallUpdate),
  onUpdateAvailable: (callback: (updateInfo: UpdateInfo) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, info: UpdateInfo) =>
      callback(info);
    ipcRenderer.on(UpdaterChannel.OnUpdateAvailable, handler);
    return () => {
      ipcRenderer.removeListener(UpdaterChannel.OnUpdateAvailable, handler);
    };
  },
  onDownloadProgress: (callback: (progress: DownloadProgress) => void) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      progress: DownloadProgress,
    ) => callback(progress);
    ipcRenderer.on(UpdaterChannel.OnDownloadProgress, handler);
    return () => {
      ipcRenderer.removeListener(UpdaterChannel.OnDownloadProgress, handler);
    };
  },
};

export { UpdaterAPI };
