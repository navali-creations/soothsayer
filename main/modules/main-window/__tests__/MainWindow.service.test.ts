import path from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockSettingsGet,
  mockOverlayDestroy,
  mockBrowserWindowMinimize,
  mockBrowserWindowMaximize,
  mockBrowserWindowUnmaximize,
  mockBrowserWindowIsMaximized,
  mockBrowserWindowClose,
  mockBrowserWindowHide,
  mockBrowserWindowShow,
  mockBrowserWindowLoadURL,
  mockBrowserWindowLoadFile,
  mockBrowserWindowOnce,
  mockBrowserWindowOn,
  mockBrowserWindowIsDestroyed,
  mockBrowserWindowWebContentsSend,
  mockBrowserWindowWebContentsOn,
  mockBrowserWindowWebContentsSetWindowOpenHandler,
  mockBrowserWindowWebContentsOpenDevTools,
  mockBrowserWindowWebContentsGetURL,
  mockNativeImageCreateFromPath,
  mockAppIsPackaged,
  mockAppGetAppPath,
  mockShellOpenExternal,
  mockDialogShowOpenDialog,
  mockValidateFileDialogOptions,
  mockAppServiceIsQuitting,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockOverlayDestroy: vi.fn(),
  mockBrowserWindowMinimize: vi.fn(),
  mockBrowserWindowMaximize: vi.fn(),
  mockBrowserWindowUnmaximize: vi.fn(),
  mockBrowserWindowIsMaximized: vi.fn(() => false),
  mockBrowserWindowClose: vi.fn(),
  mockBrowserWindowHide: vi.fn(),
  mockBrowserWindowShow: vi.fn(),
  mockBrowserWindowLoadURL: vi.fn(),
  mockBrowserWindowLoadFile: vi.fn(),
  mockBrowserWindowOnce: vi.fn(),
  mockBrowserWindowOn: vi.fn(),
  mockBrowserWindowIsDestroyed: vi.fn(() => false),
  mockBrowserWindowWebContentsSend: vi.fn(),
  mockBrowserWindowWebContentsOn: vi.fn(),
  mockBrowserWindowWebContentsSetWindowOpenHandler: vi.fn(),
  mockBrowserWindowWebContentsOpenDevTools: vi.fn(),
  mockBrowserWindowWebContentsGetURL: vi.fn(() => "http://localhost:5173"),
  mockNativeImageCreateFromPath: vi.fn(() => ({ isEmpty: vi.fn(() => false) })),
  mockAppIsPackaged: { value: false },
  mockAppGetAppPath: vi.fn(() => "/mock-app-path"),
  mockShellOpenExternal: vi.fn(),
  mockDialogShowOpenDialog: vi.fn(() =>
    Promise.resolve({ canceled: false, filePaths: ["/mock/path/file.txt"] }),
  ),
  mockValidateFileDialogOptions: vi.fn((raw: any, _channel: string) => ({
    title: raw?.title ?? "Select File",
    filters: raw?.filters ?? [],
    properties: raw?.properties ?? ["openFile"],
  })),
  mockAppServiceIsQuitting: { value: false },
}));

// ─── Track BrowserWindow instances ───────────────────────────────────────────
let browserWindowInstances: any[] = [];

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => {
  class MockBrowserWindow {
    minimize = mockBrowserWindowMinimize;
    maximize = mockBrowserWindowMaximize;
    unmaximize = mockBrowserWindowUnmaximize;
    isMaximized = mockBrowserWindowIsMaximized;
    close = mockBrowserWindowClose;
    hide = mockBrowserWindowHide;
    show = mockBrowserWindowShow;
    loadURL = mockBrowserWindowLoadURL;
    loadFile = mockBrowserWindowLoadFile;
    once = mockBrowserWindowOnce;
    on = mockBrowserWindowOn;
    isDestroyed = mockBrowserWindowIsDestroyed;
    webContents = {
      send: mockBrowserWindowWebContentsSend,
      on: mockBrowserWindowWebContentsOn,
      setWindowOpenHandler: mockBrowserWindowWebContentsSetWindowOpenHandler,
      openDevTools: mockBrowserWindowWebContentsOpenDevTools,
      getURL: mockBrowserWindowWebContentsGetURL,
    };

    constructor(_opts: any) {
      browserWindowInstances.push(this);
    }

    static getAllWindows = vi.fn(() => []);
  }

  return {
    BrowserWindow: MockBrowserWindow,
    ipcMain: {
      handle: mockIpcHandle,
      on: vi.fn(),
      removeHandler: vi.fn(),
    },
    app: {
      get isPackaged() {
        return mockAppIsPackaged.value;
      },
      getAppPath: mockAppGetAppPath,
    },
    nativeImage: {
      createFromPath: mockNativeImageCreateFromPath,
    },
    shell: {
      openExternal: mockShellOpenExternal,
    },
    dialog: {
      showOpenDialog: mockDialogShowOpenDialog,
    },
  };
});

// ─── Mock IPC validation ─────────────────────────────────────────────────────
vi.mock("~/main/utils/ipc-validation", () => ({
  validateFileDialogOptions: mockValidateFileDialogOptions,
}));

// ─── Mock all services from barrel ───────────────────────────────────────────
vi.mock("~/main/modules", () => ({
  AnalyticsService: { getInstance: vi.fn(() => ({})) },
  AppService: {
    getInstance: vi.fn(() => ({
      get isQuitting() {
        return mockAppServiceIsQuitting.value;
      },
      set isQuitting(val: boolean) {
        mockAppServiceIsQuitting.value = val;
      },
    })),
  },
  ClientLogReaderService: {
    getInstance: vi.fn(() =>
      Promise.resolve({
        on: vi.fn().mockReturnThis(),
      }),
    ),
  },
  CsvService: { getInstance: vi.fn(() => ({})) },
  CurrentSessionService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
    })),
  },
  DatabaseService: {
    getInstance: vi.fn(() => ({
      getPath: vi.fn(() => "/mock/db/path"),
    })),
  },
  DivinationCardsService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
    })),
  },
  MainWindowChannel: {
    OnAppStart: "on-app-restart",
    OnClose: "on-close",
    ReadyToShow: "ready-to-show",
    Close: "main-window:close",
    Maximize: "main-window:maximize",
    Minimize: "main-window:minimize",
    Unmaximize: "main-window:unmaximize",
    IsMaximized: "main-window:is-maximized",
  },
  OverlayService: {
    getInstance: vi.fn(() => ({
      destroy: mockOverlayDestroy,
    })),
  },
  PoeLeaguesService: { getInstance: vi.fn(() => ({})) },
  PoeProcessService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
    })),
  },
  ProhibitedLibraryService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn().mockResolvedValue(undefined),
    })),
  },
  SessionsService: { getInstance: vi.fn(() => ({})) },
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
    })),
  },
  SettingsKey: {
    AppExitAction: "appExitAction",
    AppOpenAtLogin: "appOpenAtLogin",
    AppOpenAtLoginMinimized: "appOpenAtLoginMinimized",
  },
  SnapshotService: { getInstance: vi.fn(() => ({})) },
  SupabaseClientService: {
    getInstance: vi.fn(() => ({
      isConfigured: vi.fn(() => true),
    })),
  },
  TrayService: {
    getInstance: vi.fn(() => ({
      createTray: vi.fn(),
    })),
  },
  UpdaterService: {
    getInstance: vi.fn(() => ({
      initialize: vi.fn(),
      destroy: vi.fn(),
    })),
  },
}));

// ─── Global constants injected by Vite at build time ─────────────────────────
// @ts-expect-error — injected by Vite at build time
globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5173";
// @ts-expect-error — injected by Vite at build time
globalThis.MAIN_WINDOW_VITE_NAME = "main_window";

import { MainWindowService } from "../MainWindow.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the IPC handler registered for a given channel */
function getIpcHandler(
  channel: string,
  calls?: any[][],
): (...args: any[]) => any {
  const source = calls ?? mockIpcHandle.mock.calls;
  const call = source.find(([ch]: [string]) => ch === channel);
  if (!call) {
    const registered = source.map(([ch]: [string]) => ch).join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered channels: ${registered}`,
    );
  }
  return call[1];
}

/** Capture all IPC handler registrations (snapshot of call history) */
function captureIpcHandlers(): any[][] {
  return [...mockIpcHandle.mock.calls];
}

/** Get handler registered on BrowserWindow via .on(event, handler) */
function getWindowOnHandler(event: string): (...args: any[]) => any {
  const call = mockBrowserWindowOn.mock.calls.find(
    ([ev]: [string]) => ev === event,
  );
  if (!call) {
    const registered = mockBrowserWindowOn.mock.calls
      .map(([ev]: [string]) => ev)
      .join(", ");
    throw new Error(
      `window.on was not called with "${event}". Registered events: ${registered}`,
    );
  }
  return call[1];
}

/** Get handler registered on BrowserWindow via .once(event, handler) */
function getWindowOnceHandler(event: string): (...args: any[]) => any {
  const call = mockBrowserWindowOnce.mock.calls.find(
    ([ev]: [string]) => ev === event,
  );
  if (!call) {
    const registered = mockBrowserWindowOnce.mock.calls
      .map(([ev]: [string]) => ev)
      .join(", ");
    throw new Error(
      `window.once was not called with "${event}". Registered events: ${registered}`,
    );
  }
  return call[1];
}

/** Get handler registered on webContents via .on(event, handler) */
function getWebContentsOnHandler(event: string): (...args: any[]) => any {
  const call = mockBrowserWindowWebContentsOn.mock.calls.find(
    ([ev]: [string]) => ev === event,
  );
  if (!call) {
    const registered = mockBrowserWindowWebContentsOn.mock.calls
      .map(([ev]: [string]) => ev)
      .join(", ");
    throw new Error(
      `webContents.on was not called with "${event}". Registered events: ${registered}`,
    );
  }
  return call[1];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MainWindowService", () => {
  let service: MainWindowService;
  const originalPlatform = process.platform;
  let ipcHandlerCalls: any[][];

  beforeEach(() => {
    vi.clearAllMocks();
    browserWindowInstances = [];

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    MainWindowService._instance = undefined;

    // Default: development mode, Windows
    mockAppIsPackaged.value = false;
    mockAppGetAppPath.mockReturnValue("/mock-app-path");
    Object.defineProperty(process, "platform", {
      value: "win32",
      writable: true,
      configurable: true,
    });

    // Re-seed return values after clearAllMocks
    mockNativeImageCreateFromPath.mockReturnValue({
      isEmpty: vi.fn(() => false),
    });
    mockBrowserWindowIsMaximized.mockReturnValue(false);
    mockBrowserWindowIsDestroyed.mockReturnValue(false);
    mockDialogShowOpenDialog.mockResolvedValue({
      canceled: false,
      filePaths: ["/mock/path/file.txt"],
    });
    mockSettingsGet.mockResolvedValue(false);

    // Provide process.resourcesPath for production path tests
    if (!process.resourcesPath) {
      Object.defineProperty(process, "resourcesPath", {
        value: "/mock-resources",
        writable: true,
        configurable: true,
      });
    }

    service = MainWindowService.getInstance();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = MainWindowService.getInstance();
      const b = MainWindowService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      // @ts-expect-error
      MainWindowService._instance = undefined;
      const instance = MainWindowService.getInstance();
      expect(instance).toBeInstanceOf(MainWindowService);
    });
  });

  // ─── getWindow / isDestroyed / getWebContents before createMainWindow ───

  describe("before createMainWindow", () => {
    it("getWindow should return null before window is created", () => {
      // @ts-expect-error
      MainWindowService._instance = undefined;
      const svc = MainWindowService.getInstance();
      expect(svc.getWindow()).toBeNull();
    });

    it("isDestroyed should return true before window is created", () => {
      // @ts-expect-error
      MainWindowService._instance = undefined;
      const svc = MainWindowService.getInstance();
      expect(svc.isDestroyed()).toBe(true);
    });

    it("getWebContents should return undefined before window is created", () => {
      // @ts-expect-error
      MainWindowService._instance = undefined;
      const svc = MainWindowService.getInstance();
      expect(svc.getWebContents()).toBeUndefined();
    });
  });

  // ─── createMainWindow ────────────────────────────────────────────────────

  describe("createMainWindow", () => {
    it("should create a BrowserWindow instance", async () => {
      await service.createMainWindow();
      expect(browserWindowInstances).toHaveLength(1);
    });

    it("should load the dev server URL in development mode", async () => {
      mockAppIsPackaged.value = false;
      await service.createMainWindow();

      expect(mockBrowserWindowLoadURL).toHaveBeenCalledWith(
        "http://localhost:5173",
      );
    });

    it("should open DevTools in development mode", async () => {
      mockAppIsPackaged.value = false;
      await service.createMainWindow();

      expect(mockBrowserWindowWebContentsOpenDevTools).toHaveBeenCalled();
    });

    it("should load file in production mode", async () => {
      mockAppIsPackaged.value = true;
      // Set the URL to empty/null so the else branch runs
      // @ts-expect-error
      globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "";

      // @ts-expect-error
      MainWindowService._instance = undefined;
      const svc = MainWindowService.getInstance();

      await svc.createMainWindow();

      expect(mockBrowserWindowLoadFile).toHaveBeenCalled();
      expect(mockBrowserWindowWebContentsOpenDevTools).not.toHaveBeenCalled();

      // Restore
      // @ts-expect-error
      globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:5173";
    });

    it("should register will-navigate security handler on webContents", async () => {
      await service.createMainWindow();

      expect(mockBrowserWindowWebContentsOn).toHaveBeenCalledWith(
        "will-navigate",
        expect.any(Function),
      );
    });

    it("should register window open handler for security", async () => {
      await service.createMainWindow();

      expect(
        mockBrowserWindowWebContentsSetWindowOpenHandler,
      ).toHaveBeenCalledWith(expect.any(Function));
    });

    it("should register a close handler on the window", async () => {
      await service.createMainWindow();

      expect(mockBrowserWindowOn).toHaveBeenCalledWith(
        "close",
        expect.any(Function),
      );
    });

    it("should register a ready-to-show handler", async () => {
      await service.createMainWindow();

      expect(mockBrowserWindowOnce).toHaveBeenCalledWith(
        "ready-to-show",
        expect.any(Function),
      );
    });

    it("should register all expected IPC channels", async () => {
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();

      const channels = ipcHandlerCalls.map(([ch]: [string]) => ch);

      expect(channels).toContain("main-window:minimize");
      expect(channels).toContain("main-window:maximize");
      expect(channels).toContain("main-window:unmaximize");
      expect(channels).toContain("main-window:is-maximized");
      expect(channels).toContain("main-window:close");
      expect(channels).toContain("select-file");
    });

    it("getWindow should return the BrowserWindow after creation", async () => {
      await service.createMainWindow();

      const window = service.getWindow();
      expect(window).toBe(browserWindowInstances[0]);
    });

    it("isDestroyed should return false after window is created", async () => {
      await service.createMainWindow();

      expect(service.isDestroyed()).toBe(false);
    });

    it("getWebContents should return the webContents after creation", async () => {
      await service.createMainWindow();

      const wc = service.getWebContents();
      expect(wc).toBeDefined();
      expect(wc?.send).toBe(mockBrowserWindowWebContentsSend);
    });
  });

  // ─── IPC: caption events ─────────────────────────────────────────────────

  describe("IPC caption events", () => {
    beforeEach(async () => {
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();
    });

    describe("main-window:minimize", () => {
      it("should call minimize on the main window", async () => {
        const handler = getIpcHandler("main-window:minimize", ipcHandlerCalls);
        await handler();

        expect(mockBrowserWindowMinimize).toHaveBeenCalled();
      });
    });

    describe("main-window:maximize", () => {
      it("should call maximize on the main window", async () => {
        const handler = getIpcHandler("main-window:maximize", ipcHandlerCalls);
        await handler();

        expect(mockBrowserWindowMaximize).toHaveBeenCalled();
      });
    });

    describe("main-window:unmaximize", () => {
      it("should call unmaximize on the main window", async () => {
        const handler = getIpcHandler(
          "main-window:unmaximize",
          ipcHandlerCalls,
        );
        await handler();

        expect(mockBrowserWindowUnmaximize).toHaveBeenCalled();
      });
    });

    describe("main-window:is-maximized", () => {
      it("should return false when window is not maximized", async () => {
        mockBrowserWindowIsMaximized.mockReturnValue(false);
        const handler = getIpcHandler(
          "main-window:is-maximized",
          ipcHandlerCalls,
        );
        const result = await handler();

        expect(result).toBe(false);
      });

      it("should return true when window is maximized", async () => {
        mockBrowserWindowIsMaximized.mockReturnValue(true);
        const handler = getIpcHandler(
          "main-window:is-maximized",
          ipcHandlerCalls,
        );
        const result = await handler();

        expect(result).toBe(true);
      });
    });

    describe("main-window:close", () => {
      it("should close the window and destroy overlay when exit action is 'exit'", async () => {
        mockSettingsGet.mockResolvedValue("exit");

        const handler = getIpcHandler("main-window:close", ipcHandlerCalls);
        await handler();

        expect(mockOverlayDestroy).toHaveBeenCalled();
        expect(mockBrowserWindowClose).toHaveBeenCalled();
        expect(mockBrowserWindowHide).not.toHaveBeenCalled();
      });

      it("should hide the window when exit action is 'minimize'", async () => {
        mockSettingsGet.mockResolvedValue("minimize");

        const handler = getIpcHandler("main-window:close", ipcHandlerCalls);
        await handler();

        expect(mockBrowserWindowHide).toHaveBeenCalled();
        expect(mockOverlayDestroy).not.toHaveBeenCalled();
        expect(mockBrowserWindowClose).not.toHaveBeenCalled();
      });

      it("should default to quitting when exit action is undefined", async () => {
        mockSettingsGet.mockResolvedValue(undefined);

        const handler = getIpcHandler("main-window:close", ipcHandlerCalls);
        await handler();

        expect(mockOverlayDestroy).toHaveBeenCalled();
        expect(mockBrowserWindowClose).toHaveBeenCalled();
      });

      it("should default to quitting when exit action is null", async () => {
        mockSettingsGet.mockResolvedValue(null);

        const handler = getIpcHandler("main-window:close", ipcHandlerCalls);
        await handler();

        expect(mockOverlayDestroy).toHaveBeenCalled();
        expect(mockBrowserWindowClose).toHaveBeenCalled();
      });

      it("should default to quitting when exit action is an unknown string", async () => {
        mockSettingsGet.mockResolvedValue("unknown-action");

        const handler = getIpcHandler("main-window:close", ipcHandlerCalls);
        await handler();

        // Neither "exit" nor "minimize", so byDefaultQuitApp = true
        expect(mockOverlayDestroy).toHaveBeenCalled();
        expect(mockBrowserWindowClose).toHaveBeenCalled();
      });
    });
  });

  // ─── IPC: file dialog ────────────────────────────────────────────────────

  describe("IPC: select-file", () => {
    beforeEach(async () => {
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();
    });

    it("should register a handler for select-file", () => {
      const channels = ipcHandlerCalls.map(([ch]: [string]) => ch);
      expect(channels).toContain("select-file");
    });

    it("should validate options before showing the dialog", async () => {
      const handler = getIpcHandler("select-file", ipcHandlerCalls);
      const options = {
        title: "Pick a file",
        filters: [],
        properties: ["openFile"],
      };

      await handler({}, options);

      expect(mockValidateFileDialogOptions).toHaveBeenCalledWith(
        options,
        "select-file",
      );
    });

    it("should return the first selected file path when not canceled", async () => {
      mockDialogShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ["/selected/file.csv", "/other/file.csv"],
      });

      const handler = getIpcHandler("select-file", ipcHandlerCalls);
      const result = await handler({}, {});

      expect(result).toBe("/selected/file.csv");
    });

    it("should return undefined when dialog is canceled", async () => {
      mockDialogShowOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const handler = getIpcHandler("select-file", ipcHandlerCalls);
      const result = await handler({}, {});

      expect(result).toBeUndefined();
    });

    it("should pass validated options to showOpenDialog", async () => {
      mockValidateFileDialogOptions.mockReturnValue({
        title: "Validated Title",
        filters: [{ name: "CSV", extensions: ["csv"] }],
        properties: ["openFile"],
      });

      const handler = getIpcHandler("select-file", ipcHandlerCalls);
      await handler({}, {});

      expect(mockDialogShowOpenDialog).toHaveBeenCalledWith(expect.anything(), {
        title: "Validated Title",
        filters: [{ name: "CSV", extensions: ["csv"] }],
        properties: ["openFile"],
      });
    });
  });

  // ─── Security: will-navigate ─────────────────────────────────────────────

  describe("Security: will-navigate", () => {
    beforeEach(async () => {
      await service.createMainWindow();
    });

    it("should allow navigation to the dev server origin", () => {
      const navHandler = getWebContentsOnHandler("will-navigate");
      const mockEvent = { preventDefault: vi.fn() };

      navHandler(mockEvent, "http://localhost:5173/some-page");

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
    });

    it("should block navigation to untrusted URLs", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const navHandler = getWebContentsOnHandler("will-navigate");
      const mockEvent = { preventDefault: vi.fn() };

      navHandler(mockEvent, "https://evil-site.com/phishing");

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Blocked navigation"),
      );
    });

    it("should block navigation to file:// URLs when using dev server", () => {
      const navHandler = getWebContentsOnHandler("will-navigate");
      const mockEvent = { preventDefault: vi.fn() };

      navHandler(mockEvent, "file:///etc/passwd");

      expect(mockEvent.preventDefault).toHaveBeenCalled();
    });
  });

  // ─── Security: window.open ───────────────────────────────────────────────

  describe("Security: window.open handler", () => {
    beforeEach(async () => {
      await service.createMainWindow();
    });

    it("should allow opening Discord URLs externally", () => {
      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];

      const result = openHandler({ url: "https://discord.gg/soothsayer" });

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://discord.gg/soothsayer",
      );
      expect(result).toEqual({ action: "deny" });
    });

    it("should allow opening Discord.com URLs externally", () => {
      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];

      const result = openHandler({
        url: "https://discord.com/invite/something",
      });

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://discord.com/invite/something",
      );
      expect(result).toEqual({ action: "deny" });
    });

    it("should allow opening PoE OAuth URLs externally", () => {
      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];

      const result = openHandler({
        url: "https://www.pathofexile.com/oauth/authorize?client_id=foo",
      });

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://www.pathofexile.com/oauth/authorize?client_id=foo",
      );
      expect(result).toEqual({ action: "deny" });
    });

    it("should allow opening Navali Creations GitHub URLs externally", () => {
      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];

      const result = openHandler({
        url: "https://github.com/navali-creations/soothsayer",
      });

      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://github.com/navali-creations/soothsayer",
      );
      expect(result).toEqual({ action: "deny" });
    });

    it("should block and log non-allowlisted URLs", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];

      const result = openHandler({
        url: "https://malicious-site.com/steal-data",
      });

      expect(mockShellOpenExternal).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Blocked window.open"),
      );
      expect(result).toEqual({ action: "deny" });
    });

    it("should always return deny action even for allowed URLs", () => {
      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];

      const result = openHandler({ url: "https://discord.gg/help" });

      // Window is always denied — external links open in OS browser
      expect(result).toEqual({ action: "deny" });
    });
  });

  // ─── emitOnMainWindowClose ───────────────────────────────────────────────

  describe("emitOnMainWindowClose", () => {
    it("should hide window when isQuitting is false and close is triggered", async () => {
      mockAppServiceIsQuitting.value = false;
      await service.createMainWindow();

      const closeHandler = getWindowOnHandler("close");
      const mockEvent = { preventDefault: vi.fn() };

      closeHandler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockBrowserWindowHide).toHaveBeenCalled();
    });

    it("should allow close when isQuitting is true", async () => {
      mockAppServiceIsQuitting.value = true;
      await service.createMainWindow();

      const closeHandler = getWindowOnHandler("close");
      const mockEvent = { preventDefault: vi.fn() };

      closeHandler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockBrowserWindowHide).not.toHaveBeenCalled();
    });
  });

  // ─── Combined: IPC close + native close interaction ──────────────────────

  describe("combined: IPC close handler + emitOnMainWindowClose interaction", () => {
    it("should allow app to quit even when user prefers minimize (isQuitting = true)", async () => {
      mockAppServiceIsQuitting.value = false;
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();

      // Get both handlers before any mock clearing
      const ipcCloseHandler = getIpcHandler(
        "main-window:close",
        ipcHandlerCalls,
      );
      const nativeCloseHandler = getWindowOnHandler("close");

      // Step 1: User clicks X with minimize preference → window hides
      mockSettingsGet.mockResolvedValue("minimize");
      await ipcCloseHandler();

      expect(mockBrowserWindowHide).toHaveBeenCalled();
      expect(mockBrowserWindowClose).not.toHaveBeenCalled();

      // Step 2: Later, the app is truly quitting (e.g. "Quit" from tray)
      mockAppServiceIsQuitting.value = true;
      mockBrowserWindowHide.mockClear();

      const mockEvent = { preventDefault: vi.fn() };
      nativeCloseHandler(mockEvent);

      // Native close should NOT be intercepted — app should quit
      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockBrowserWindowHide).not.toHaveBeenCalled();
    });

    it("should not intercept native close when user prefers exit and clicks X", async () => {
      mockAppServiceIsQuitting.value = false;
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();

      const ipcCloseHandler = getIpcHandler(
        "main-window:close",
        ipcHandlerCalls,
      );
      const nativeCloseHandler = getWindowOnHandler("close");

      // User clicks X with exit preference
      mockSettingsGet.mockResolvedValue("exit");
      await ipcCloseHandler();

      // IPC handler should call close() and destroy overlay
      expect(mockOverlayDestroy).toHaveBeenCalled();
      expect(mockBrowserWindowClose).toHaveBeenCalled();

      // Simulate what Electron does: close() triggers the native "close" event.
      // Since the user explicitly chose "exit", this should NOT be intercepted.
      const mockEvent = { preventDefault: vi.fn() };
      nativeCloseHandler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockBrowserWindowHide).not.toHaveBeenCalled();
    });
  });

  // ─── showAppOnceReadyToShow ──────────────────────────────────────────────

  describe("showAppOnceReadyToShow", () => {
    it("should register a ready-to-show handler when mainWindow is a BrowserWindow", async () => {
      await service.createMainWindow();

      // ready-to-show should have been registered via once
      expect(mockBrowserWindowOnce).toHaveBeenCalledWith(
        "ready-to-show",
        expect.any(Function),
      );
    });

    it("should show the window when not set to open minimized", async () => {
      mockSettingsGet.mockResolvedValue(false);

      await service.createMainWindow();

      const readyHandler = getWindowOnceHandler("ready-to-show");
      await readyHandler();

      expect(mockBrowserWindowShow).toHaveBeenCalled();
    });

    it("should NOT show the window when openAtLogin AND openAtLoginMinimized are both true", async () => {
      await service.createMainWindow();

      // Reset show calls before testing the handler
      mockBrowserWindowShow.mockClear();

      // Clear any queued mock return values, then set fresh ones for the handler
      mockSettingsGet.mockReset();
      mockSettingsGet.mockResolvedValueOnce(true); // openAtLogin
      mockSettingsGet.mockResolvedValueOnce(true); // openAtLoginMinimized

      const readyHandler = getWindowOnceHandler("ready-to-show");
      await readyHandler();

      expect(mockBrowserWindowShow).not.toHaveBeenCalled();
    });

    it("should show the window when openAtLogin is true but minimized is false", async () => {
      await service.createMainWindow();

      mockBrowserWindowShow.mockClear();

      mockSettingsGet.mockResolvedValueOnce(true); // openAtLogin
      mockSettingsGet.mockResolvedValueOnce(false); // openAtLoginMinimized

      const readyHandler = getWindowOnceHandler("ready-to-show");
      await readyHandler();

      expect(mockBrowserWindowShow).toHaveBeenCalled();
    });
  });

  // ─── getAppIcon ──────────────────────────────────────────────────────────

  describe("getAppIcon (via createMainWindow)", () => {
    describe("in development mode", () => {
      beforeEach(() => {
        mockAppIsPackaged.value = false;
        mockAppGetAppPath.mockReturnValue("/mock-app-path");
      });

      it("should use windows icon path on win32", async () => {
        Object.defineProperty(process, "platform", { value: "win32" });

        // @ts-expect-error
        MainWindowService._instance = undefined;
        const svc = MainWindowService.getInstance();
        mockNativeImageCreateFromPath.mockClear();

        await svc.createMainWindow();

        const iconPath = (
          mockNativeImageCreateFromPath.mock.calls as any[][]
        )[0][0] as string;
        const parts = iconPath.split(path.sep);

        expect(parts).toContain("renderer");
        expect(parts).toContain("logo");
        expect(parts).toContain("windows");
        expect(parts[parts.length - 1]).toBe("icon.ico");
      });

      it("should use macOS icon path on darwin", async () => {
        Object.defineProperty(process, "platform", { value: "darwin" });

        // @ts-expect-error
        MainWindowService._instance = undefined;
        const svc = MainWindowService.getInstance();
        mockNativeImageCreateFromPath.mockClear();

        await svc.createMainWindow();

        const iconPath = (
          mockNativeImageCreateFromPath.mock.calls as any[][]
        )[0][0] as string;
        const parts = iconPath.split(path.sep);

        expect(parts).toContain("macos");
        expect(parts[parts.length - 1]).toBe("512x512.png");
      });

      it("should use linux icon path on linux", async () => {
        Object.defineProperty(process, "platform", { value: "linux" });

        // @ts-expect-error
        MainWindowService._instance = undefined;
        const svc = MainWindowService.getInstance();
        mockNativeImageCreateFromPath.mockClear();

        await svc.createMainWindow();

        const iconPath = (
          mockNativeImageCreateFromPath.mock.calls as any[][]
        )[0][0] as string;
        const parts = iconPath.split(path.sep);

        expect(parts).toContain("linux");
        expect(parts).toContain("icons");
        expect(parts[parts.length - 1]).toBe("512x512.png");
      });
    });

    describe("in production mode", () => {
      let originalResourcesPath: string | undefined;

      beforeEach(() => {
        mockAppIsPackaged.value = true;
        originalResourcesPath = process.resourcesPath;
        Object.defineProperty(process, "resourcesPath", {
          value: "/mock-resources",
          writable: true,
          configurable: true,
        });
      });

      afterEach(() => {
        if (originalResourcesPath !== undefined) {
          Object.defineProperty(process, "resourcesPath", {
            value: originalResourcesPath,
            writable: true,
            configurable: true,
          });
        }
      });

      it("should use resourcesPath instead of appPath on win32", async () => {
        Object.defineProperty(process, "platform", { value: "win32" });

        // @ts-expect-error
        MainWindowService._instance = undefined;
        const svc = MainWindowService.getInstance();
        mockNativeImageCreateFromPath.mockClear();

        await svc.createMainWindow();

        const iconPath = (
          mockNativeImageCreateFromPath.mock.calls as any[][]
        )[0][0] as string;
        expect(iconPath).toContain("mock-resources");
        expect(iconPath).not.toContain("renderer");
      });

      it("should use resourcesPath for macOS in production", async () => {
        Object.defineProperty(process, "platform", { value: "darwin" });

        // @ts-expect-error
        MainWindowService._instance = undefined;
        const svc = MainWindowService.getInstance();
        mockNativeImageCreateFromPath.mockClear();

        await svc.createMainWindow();

        const iconPath = (
          mockNativeImageCreateFromPath.mock.calls as any[][]
        )[0][0] as string;
        expect(iconPath).toContain("mock-resources");
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("macos");
      });

      it("should use resourcesPath for linux in production", async () => {
        Object.defineProperty(process, "platform", { value: "linux" });

        // @ts-expect-error
        MainWindowService._instance = undefined;
        const svc = MainWindowService.getInstance();
        mockNativeImageCreateFromPath.mockClear();

        await svc.createMainWindow();

        const iconPath = (
          mockNativeImageCreateFromPath.mock.calls as any[][]
        )[0][0] as string;
        expect(iconPath).toContain("mock-resources");
        const parts = iconPath.split(path.sep);
        expect(parts).toContain("linux");
      });
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle getWindow returning null when window is falsy", () => {
      // @ts-expect-error
      MainWindowService._instance = undefined;
      const svc = MainWindowService.getInstance();

      // mainWindow not assigned yet
      const win = svc.getWindow();
      expect(win).toBeNull();
    });

    it("should handle isDestroyed when mainWindow is destroyed", async () => {
      await service.createMainWindow();

      // Simulate destroyed window — isDestroyed() returns !this.mainWindow || this.mainWindow.isDestroyed()
      // mainWindow exists, so it delegates to the mock's isDestroyed which we set to true
      mockBrowserWindowIsDestroyed.mockReturnValue(true);
      expect(service.isDestroyed()).toBe(true);
    });

    it("should not throw when mainWindow methods use optional chaining", async () => {
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();

      // Even if underlying methods are undefined, the optional chaining should prevent errors
      const minimizeHandler = getIpcHandler(
        "main-window:minimize",
        ipcHandlerCalls,
      );
      expect(async () => await minimizeHandler()).not.toThrow();
    });
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should handle create -> use caption events -> security -> close", async () => {
      // 1. Create window
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();

      expect(browserWindowInstances).toHaveLength(1);
      expect(service.getWindow()).not.toBeNull();
      expect(service.isDestroyed()).toBe(false);

      // 2. Use minimize
      const minimizeHandler = getIpcHandler(
        "main-window:minimize",
        ipcHandlerCalls,
      );
      await minimizeHandler();
      expect(mockBrowserWindowMinimize).toHaveBeenCalled();

      // 3. Use maximize
      const maximizeHandler = getIpcHandler(
        "main-window:maximize",
        ipcHandlerCalls,
      );
      await maximizeHandler();
      expect(mockBrowserWindowMaximize).toHaveBeenCalled();

      // 4. Check is-maximized
      mockBrowserWindowIsMaximized.mockReturnValue(true);
      const isMaxHandler = getIpcHandler(
        "main-window:is-maximized",
        ipcHandlerCalls,
      );
      const isMaxResult = await isMaxHandler();
      expect(isMaxResult).toBe(true);

      // 5. Unmaximize
      const unmaximizeHandler = getIpcHandler(
        "main-window:unmaximize",
        ipcHandlerCalls,
      );
      await unmaximizeHandler();
      expect(mockBrowserWindowUnmaximize).toHaveBeenCalled();

      // 6. Test security: block malicious navigation
      const navHandler = getWebContentsOnHandler("will-navigate");
      const mockNavEvent = { preventDefault: vi.fn() };
      navHandler(mockNavEvent, "https://malicious.com");
      expect(mockNavEvent.preventDefault).toHaveBeenCalled();

      // 7. Test security: allow discord
      const openHandler =
        mockBrowserWindowWebContentsSetWindowOpenHandler.mock.calls[0][0];
      openHandler({ url: "https://discord.gg/test" });
      expect(mockShellOpenExternal).toHaveBeenCalledWith(
        "https://discord.gg/test",
      );

      // 8. Close with exit action
      mockSettingsGet.mockResolvedValue("exit");
      const closeHandler = getIpcHandler("main-window:close", ipcHandlerCalls);
      await closeHandler();
      expect(mockOverlayDestroy).toHaveBeenCalled();
      expect(mockBrowserWindowClose).toHaveBeenCalled();
    });

    it("should handle close intercepted by emitOnMainWindowClose", async () => {
      // Create with isQuitting=false so close is intercepted
      mockAppServiceIsQuitting.value = false;
      await service.createMainWindow();

      const closeHandler = getWindowOnHandler("close");
      const mockEvent = { preventDefault: vi.fn() };

      // First close attempt should be intercepted
      closeHandler(mockEvent);
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockBrowserWindowHide).toHaveBeenCalled();
    });

    it("should handle file selection lifecycle", async () => {
      await service.createMainWindow();
      ipcHandlerCalls = captureIpcHandlers();

      const handler = getIpcHandler("select-file", ipcHandlerCalls);

      // Successful selection
      mockDialogShowOpenDialog.mockResolvedValue({
        canceled: false,
        filePaths: ["/users/data/export.csv"],
      });

      const path1 = await handler(
        {},
        { title: "Export", properties: ["openFile"] },
      );
      expect(path1).toBe("/users/data/export.csv");

      // Cancelled selection
      mockDialogShowOpenDialog.mockResolvedValue({
        canceled: true,
        filePaths: [],
      });

      const path2 = await handler(
        {},
        { title: "Export", properties: ["openFile"] },
      );
      expect(path2).toBeUndefined();
    });
  });

  // ─── State management ────────────────────────────────────────────────────

  describe("state management", () => {
    it("should maintain singleton across createMainWindow calls", async () => {
      const instance1 = MainWindowService.getInstance();
      await instance1.createMainWindow();

      const instance2 = MainWindowService.getInstance();
      expect(instance1).toBe(instance2);
    });

    it("getWebContents should reflect the current window's webContents", async () => {
      await service.createMainWindow();

      const wc = service.getWebContents();
      expect(wc).toBeDefined();
      expect(wc?.send).toBe(mockBrowserWindowWebContentsSend);
      expect(wc?.on).toBe(mockBrowserWindowWebContentsOn);
    });
  });
});
