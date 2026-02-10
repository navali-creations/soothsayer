import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockTrayConstructor,
  mockTraySetToolTip,
  mockTraySetContextMenu,
  mockTrayOn,
  mockTraySetIgnoreDoubleClickEvents,
  mockTrayDestroy,
  mockMenuBuildFromTemplate,
  mockNativeImageCreateFromPath,
  mockNativeImageSetTemplateImage,
  mockNativeImageIsEmpty,
  mockShellOpenExternal,
  mockAppIsPackaged,
  mockAppGetAppPath,
  mockMainWindowShow,
  mockAppServiceQuit,
} = vi.hoisted(() => ({
  mockTrayConstructor: vi.fn(),
  mockTraySetToolTip: vi.fn(),
  mockTraySetContextMenu: vi.fn(),
  mockTrayOn: vi.fn(),
  mockTraySetIgnoreDoubleClickEvents: vi.fn(),
  mockTrayDestroy: vi.fn(),
  mockMenuBuildFromTemplate: vi.fn(),
  mockNativeImageCreateFromPath: vi.fn(),
  mockNativeImageSetTemplateImage: vi.fn(),
  mockNativeImageIsEmpty: vi.fn(() => false),
  mockShellOpenExternal: vi.fn(),
  mockAppIsPackaged: { value: false },
  mockAppGetAppPath: vi.fn(() => "/mock-app-path"),
  mockMainWindowShow: vi.fn(),
  mockAppServiceQuit: vi.fn(),
}));

// ─── Track Tray instances ────────────────────────────────────────────────────
let trayInstances: any[] = [];

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => {
  // Create a mock Tray class that tracks instances
  class MockTray {
    setToolTip = mockTraySetToolTip;
    setContextMenu = mockTraySetContextMenu;
    on = mockTrayOn;
    setIgnoreDoubleClickEvents = mockTraySetIgnoreDoubleClickEvents;
    destroy = mockTrayDestroy;

    constructor(icon: any) {
      mockTrayConstructor(icon);
      trayInstances.push(this);
    }
  }

  const mockContextMenu = { type: "mock-context-menu" };
  mockMenuBuildFromTemplate.mockReturnValue(mockContextMenu);

  const mockImage = {
    isEmpty: mockNativeImageIsEmpty,
    setTemplateImage: mockNativeImageSetTemplateImage,
  };
  mockNativeImageCreateFromPath.mockReturnValue(mockImage);

  return {
    Tray: MockTray,
    Menu: {
      buildFromTemplate: mockMenuBuildFromTemplate,
    },
    nativeImage: {
      createFromPath: mockNativeImageCreateFromPath,
    },
    shell: {
      openExternal: mockShellOpenExternal,
    },
    app: {
      get isPackaged() {
        return mockAppIsPackaged.value;
      },
      getAppPath: mockAppGetAppPath,
    },
    ipcMain: {
      handle: vi.fn(),
      on: vi.fn(),
      removeHandler: vi.fn(),
    },
    BrowserWindow: {
      getAllWindows: vi.fn(() => []),
    },
    dialog: {
      showMessageBox: vi.fn(),
    },
  };
});

// ─── Mock MainWindowService ──────────────────────────────────────────────────
vi.mock("~/main/modules", () => ({
  MainWindowService: {
    getInstance: vi.fn(() => ({
      show: mockMainWindowShow,
    })),
  },
  AppService: {
    getInstance: vi.fn(() => ({
      quit: mockAppServiceQuit,
    })),
  },
}));

import { TrayService } from "../Tray.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the menu template passed to Menu.buildFromTemplate */
function getMenuTemplate(): Electron.MenuItemConstructorOptions[] {
  const call = mockMenuBuildFromTemplate.mock.calls[0];
  if (!call) throw new Error("Menu.buildFromTemplate was not called");
  return call[0];
}

/** Get the click handler registered on the tray via tray.on("click", ...) */
function getTrayClickHandler(): () => void {
  const call = mockTrayOn.mock.calls.find(
    ([event]: [string]) => event === "click",
  );
  if (!call) throw new Error('tray.on("click", ...) was not called');
  return call[1];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("TrayService", () => {
  let service: TrayService;
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    trayInstances = [];

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    TrayService._instance = undefined;

    // Default: development mode, Windows
    mockAppIsPackaged.value = false;
    mockAppGetAppPath.mockReturnValue("/mock-app-path");

    // Re-setup return values after clearAllMocks
    mockMenuBuildFromTemplate.mockReturnValue({ type: "mock-context-menu" });
    mockNativeImageCreateFromPath.mockReturnValue({
      isEmpty: mockNativeImageIsEmpty,
      setTemplateImage: mockNativeImageSetTemplateImage,
    });
    mockNativeImageIsEmpty.mockReturnValue(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore platform
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = TrayService.getInstance();
      const b = TrayService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      const instance = TrayService.getInstance();
      expect(instance).toBeInstanceOf(TrayService);
    });
  });

  // ─── createTray ──────────────────────────────────────────────────────────

  describe("createTray", () => {
    beforeEach(() => {
      service = TrayService.getInstance();
    });

    it("should create a Tray instance", () => {
      service.createTray();
      expect(trayInstances.length).toBe(1);
      expect(mockTrayConstructor).toHaveBeenCalledTimes(1);
    });

    it("should set the tooltip to 'soothsayer'", () => {
      service.createTray();
      expect(mockTraySetToolTip).toHaveBeenCalledWith("soothsayer");
    });

    it("should register a click handler on the tray", () => {
      service.createTray();
      expect(mockTrayOn).toHaveBeenCalledWith("click", expect.any(Function));
    });

    it("should set ignoreDoubleClickEvents to true", () => {
      service.createTray();
      expect(mockTraySetIgnoreDoubleClickEvents).toHaveBeenCalledWith(true);
    });

    it("should create and set a context menu", () => {
      service.createTray();
      expect(mockMenuBuildFromTemplate).toHaveBeenCalledTimes(1);
      expect(mockTraySetContextMenu).toHaveBeenCalledTimes(1);
    });

    it("should create the native image from the icon path", () => {
      service.createTray();
      expect(mockNativeImageCreateFromPath).toHaveBeenCalledTimes(1);
      expect(mockNativeImageCreateFromPath).toHaveBeenCalledWith(
        expect.stringContaining("icon"),
      );
    });
  });

  // ─── Icon path resolution ────────────────────────────────────────────────

  describe("getIconPath (via createTray)", () => {
    beforeEach(() => {
      service = TrayService.getInstance();
    });

    describe("in development mode", () => {
      beforeEach(() => {
        mockAppIsPackaged.value = false;
        mockAppGetAppPath.mockReturnValue("/dev/project");
      });

      it("should use windows icon path on win32", () => {
        Object.defineProperty(process, "platform", { value: "win32" });
        service.createTray();

        const iconPath: string = mockNativeImageCreateFromPath.mock.calls[0][0];
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("renderer");
        expect(parts).toContain("assets");
        expect(parts).toContain("logo");
        expect(parts).toContain("windows");
        expect(iconPath).toContain("icon.ico");
      });

      it("should use macOS icon path on darwin", () => {
        Object.defineProperty(process, "platform", { value: "darwin" });
        service.createTray();

        const iconPath: string = mockNativeImageCreateFromPath.mock.calls[0][0];
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("renderer");
        expect(parts).toContain("assets");
        expect(parts).toContain("logo");
        expect(parts).toContain("macos");
        expect(iconPath).toContain("16x16.png");
      });

      it("should use linux icon path on linux", () => {
        Object.defineProperty(process, "platform", { value: "linux" });
        service.createTray();

        const iconPath: string = mockNativeImageCreateFromPath.mock.calls[0][0];
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("renderer");
        expect(parts).toContain("assets");
        expect(parts).toContain("logo");
        expect(parts).toContain("linux");
        expect(iconPath).toContain("32x32.png");
      });
    });

    describe("in production mode", () => {
      let originalResourcesPath: string;

      beforeEach(() => {
        mockAppIsPackaged.value = true;
        originalResourcesPath = process.resourcesPath;
        // Use vi.stubGlobal-style approach: override via the process object directly
        // process.resourcesPath may not be configurable, so we use a getter spy
        try {
          Object.defineProperty(process, "resourcesPath", {
            value: path.join("prod", "resources"),
            writable: true,
            configurable: true,
          });
        } catch {
          // If not configurable, just assign directly (some Node versions allow it)
          (process as any).resourcesPath = path.join("prod", "resources");
        }
      });

      afterEach(() => {
        try {
          Object.defineProperty(process, "resourcesPath", {
            value: originalResourcesPath,
            writable: true,
            configurable: true,
          });
        } catch {
          (process as any).resourcesPath = originalResourcesPath;
        }
      });

      it("should use resourcesPath instead of appPath on win32", () => {
        Object.defineProperty(process, "platform", { value: "win32" });
        service.createTray();

        const iconPath: string = mockNativeImageCreateFromPath.mock.calls[0][0];
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("resources");
        expect(parts).toContain("logo");
        expect(parts).toContain("windows");
        expect(iconPath).toContain("icon.ico");
        // Should NOT contain renderer/assets path segments together
        expect(parts).not.toContain("assets");
      });

      it("should use resourcesPath for macOS in production", () => {
        Object.defineProperty(process, "platform", { value: "darwin" });
        service.createTray();

        const iconPath: string = mockNativeImageCreateFromPath.mock.calls[0][0];
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("resources");
        expect(parts).toContain("macos");
      });

      it("should use resourcesPath for linux in production", () => {
        Object.defineProperty(process, "platform", { value: "linux" });
        service.createTray();

        const iconPath: string = mockNativeImageCreateFromPath.mock.calls[0][0];
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("resources");
        expect(parts).toContain("linux");
      });
    });

    describe("template image on macOS", () => {
      it("should set template image to true on darwin", () => {
        Object.defineProperty(process, "platform", { value: "darwin" });
        service.createTray();

        expect(mockNativeImageSetTemplateImage).toHaveBeenCalledWith(true);
      });

      it("should NOT set template image on win32", () => {
        Object.defineProperty(process, "platform", { value: "win32" });
        service.createTray();

        expect(mockNativeImageSetTemplateImage).not.toHaveBeenCalled();
      });

      it("should NOT set template image on linux", () => {
        Object.defineProperty(process, "platform", { value: "linux" });
        service.createTray();

        expect(mockNativeImageSetTemplateImage).not.toHaveBeenCalled();
      });
    });

    describe("empty icon handling", () => {
      it("should log an error when the icon is empty", () => {
        mockNativeImageIsEmpty.mockReturnValue(true);
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        service.createTray();

        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("[Tray] Failed to load icon from:"),
          expect.any(String),
        );
      });

      it("should NOT log an error when the icon loads successfully", () => {
        mockNativeImageIsEmpty.mockReturnValue(false);
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        service.createTray();

        expect(consoleSpy).not.toHaveBeenCalled();
      });
    });
  });

  // ─── Tray click handler ──────────────────────────────────────────────────

  describe("tray click handler", () => {
    it("should call mainWindow.show when tray is clicked", () => {
      service = TrayService.getInstance();
      service.createTray();

      const clickHandler = getTrayClickHandler();
      clickHandler();

      expect(mockMainWindowShow).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Context menu ────────────────────────────────────────────────────────

  describe("context menu", () => {
    beforeEach(() => {
      service = TrayService.getInstance();
      service.createTray();
    });

    it("should create a menu with 5 items (Show, separator, Discord, separator, Quit)", () => {
      const template = getMenuTemplate();
      expect(template).toHaveLength(5);
    });

    it("should have 'Show Soothsayer' as the first menu item", () => {
      const template = getMenuTemplate();
      expect(template[0].label).toBe("Show Soothsayer");
    });

    it("should call mainWindow.show when 'Show Soothsayer' is clicked", () => {
      const template = getMenuTemplate();
      const showItem = template[0];
      showItem.click!({} as any, {} as any, {} as any);
      expect(mockMainWindowShow).toHaveBeenCalledTimes(1);
    });

    it("should have a separator as the second item", () => {
      const template = getMenuTemplate();
      expect(template[1].type).toBe("separator");
    });

    it("should have 'Discord / Help' as the third item", () => {
      const template = getMenuTemplate();
      expect(template[2].label).toBe("Discord / Help");
      expect(template[2].type).toBe("normal");
    });

    it("should open the Discord URL when 'Discord / Help' is clicked", async () => {
      const template = getMenuTemplate();
      const discordItem = template[2];
      await discordItem.click!({} as any, {} as any, {} as any);
      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://discord.gg/yxuBrPY",
      );
    });

    it("should have a separator as the fourth item", () => {
      const template = getMenuTemplate();
      expect(template[3].type).toBe("separator");
    });

    it("should have 'Quit' as the fifth item", () => {
      const template = getMenuTemplate();
      expect(template[4].label).toBe("Quit");
      expect(template[4].type).toBe("normal");
    });

    it("should call app.quit when 'Quit' is clicked", () => {
      const template = getMenuTemplate();
      const quitItem = template[4];
      quitItem.click!({} as any, {} as any, {} as any);
      expect(mockAppServiceQuit).toHaveBeenCalledTimes(1);
    });
  });

  // ─── destroyTray ─────────────────────────────────────────────────────────

  describe("destroyTray", () => {
    it("should destroy the tray when it has been created", () => {
      service = TrayService.getInstance();
      service.createTray();

      service.destroyTray();

      expect(mockTrayDestroy).toHaveBeenCalledTimes(1);
    });

    it("should not throw when tray has not been created", () => {
      service = TrayService.getInstance();

      // destroyTray should not throw even if tray is null
      expect(() => service.destroyTray()).not.toThrow();
    });

    it("should return false when tray is null (not an instance of Tray)", () => {
      service = TrayService.getInstance();

      // When tray is null, the instanceof check returns false
      const result = service.destroyTray();
      expect(result).toBe(false);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should allow creating the tray multiple times (replaces tray reference)", () => {
      service = TrayService.getInstance();
      service.createTray();
      service.createTray();

      // Two Tray instances created
      expect(trayInstances.length).toBe(2);
      expect(mockTrayConstructor).toHaveBeenCalledTimes(2);
    });

    it("should use the default platform path for unknown platforms", () => {
      Object.defineProperty(process, "platform", { value: "freebsd" });
      service = TrayService.getInstance();
      service.createTray();

      const iconPath = mockNativeImageCreateFromPath.mock.calls[0][0];
      // Falls through to the default case (linux path)
      expect(iconPath).toContain("linux");
      expect(iconPath).toContain("32x32.png");
    });
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should create tray, handle clicks, and destroy cleanly", () => {
      service = TrayService.getInstance();

      // Create
      service.createTray();
      expect(trayInstances.length).toBe(1);

      // Click
      const clickHandler = getTrayClickHandler();
      clickHandler();
      expect(mockMainWindowShow).toHaveBeenCalledTimes(1);

      // Context menu actions
      const template = getMenuTemplate();
      template[0].click!({} as any, {} as any, {} as any);
      expect(mockMainWindowShow).toHaveBeenCalledTimes(2);

      // Destroy
      service.destroyTray();
      expect(mockTrayDestroy).toHaveBeenCalledTimes(1);
    });
  });
});
