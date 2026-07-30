import { describe, expect, it, vi } from "vitest";

import { isOverlayWindow } from "../is-overlay-window";

function createWindow(url: string) {
  return {
    webContents: {
      getURL: vi.fn(() => url),
    },
  } as Electron.BrowserWindow;
}

describe("isOverlayWindow", () => {
  it("identifies development and production overlay URLs", () => {
    expect(
      isOverlayWindow(createWindow("http://localhost:5173/overlay.html")),
    ).toBe(true);
    expect(isOverlayWindow(createWindow("file:///app/overlay.html"))).toBe(
      true,
    );
  });

  it("rejects non-overlay windows and inaccessible web contents", () => {
    expect(isOverlayWindow(createWindow("http://localhost:5173/"))).toBe(false);

    const inaccessibleWindow = createWindow("");
    vi.mocked(inaccessibleWindow.webContents.getURL).mockImplementation(() => {
      throw new Error("destroyed");
    });
    expect(isOverlayWindow(inaccessibleWindow)).toBe(false);
  });
});
