import { ipcRenderer } from "electron";
import { OverlayChannel } from "./Overlay.channels";
import type { OverlayBounds } from "./Overlay.service";

const OverlayAPI = {
  show: () => ipcRenderer.invoke(OverlayChannel.Show),
  hide: () => ipcRenderer.invoke(OverlayChannel.Hide),
  toggle: () => ipcRenderer.invoke(OverlayChannel.Toggle),
  isVisible: (): Promise<boolean> =>
    ipcRenderer.invoke(OverlayChannel.IsVisible),
  setPosition: (x: number, y: number) =>
    ipcRenderer.invoke(OverlayChannel.SetPosition, x, y),
  setSize: (width: number, height: number) =>
    ipcRenderer.invoke(OverlayChannel.SetSize, width, height),
  getBounds: (): Promise<OverlayBounds | null> =>
    ipcRenderer.invoke(OverlayChannel.GetBounds),
  getSessionData: () => ipcRenderer.invoke("overlay:get-session-data"),
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
};

export { OverlayAPI };
