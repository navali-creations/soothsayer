import { ipcRenderer } from "electron";

import type { GameType } from "~/types/data-stores";

import { OverlayChannel } from "./Overlay.channels";
import type { OverlaySessionDataDTO } from "./Overlay.dto";
import type { OverlayBounds } from "./Overlay.service";

const OverlayAPI = {
  show: () => ipcRenderer.invoke(OverlayChannel.Show),
  hide: () => ipcRenderer.invoke(OverlayChannel.Hide),
  toggle: () => ipcRenderer.invoke(OverlayChannel.Toggle),
  isVisible: (): Promise<boolean> =>
    ipcRenderer.invoke(OverlayChannel.IsVisible),
  setLocked: (locked: boolean) =>
    ipcRenderer.invoke(OverlayChannel.SetLocked, locked),
  setPosition: (x: number, y: number) =>
    ipcRenderer.invoke(OverlayChannel.SetPosition, x, y),
  setSize: (width: number, height: number) =>
    ipcRenderer.invoke(OverlayChannel.SetSize, width, height),
  getBounds: (): Promise<OverlayBounds | null> =>
    ipcRenderer.invoke(OverlayChannel.GetBounds),
  restoreDefaults: () => ipcRenderer.invoke(OverlayChannel.RestoreDefaults),
  getSessionData: (): Promise<OverlaySessionDataDTO> =>
    ipcRenderer.invoke(OverlayChannel.GetSessionData),
  getActiveGame: (): Promise<GameType> =>
    ipcRenderer.invoke(OverlayChannel.GetActiveGame),
  onVisibilityChanged: (callback: (isVisible: boolean) => void) => {
    const listener = (
      _event: Electron.IpcRendererEvent,
      isVisible: boolean,
    ) => {
      callback(isVisible);
    };
    ipcRenderer.on(OverlayChannel.VisibilityChanged, listener);
    // Return cleanup function
    return () => {
      ipcRenderer.removeListener(OverlayChannel.VisibilityChanged, listener);
    };
  },
  onSettingsChanged: (callback: () => void) => {
    const listener = () => {
      callback();
    };
    ipcRenderer.on(OverlayChannel.SettingsChanged, listener);
    return () => {
      ipcRenderer.removeListener(OverlayChannel.SettingsChanged, listener);
    };
  },
};

export { OverlayAPI };
