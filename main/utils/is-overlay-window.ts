import type { BrowserWindow } from "electron";

function isOverlayWindow(window: BrowserWindow): boolean {
  try {
    return window.webContents.getURL().includes("overlay.html");
  } catch {
    return false;
  }
}

export { isOverlayWindow };
