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
  setOpacity: (opacity: number) =>
    ipcRenderer.invoke(OverlayChannel.SetOpacity, opacity),
  getSessionData: () => ipcRenderer.invoke("overlay:get-session-data"),
};

export { OverlayAPI };
