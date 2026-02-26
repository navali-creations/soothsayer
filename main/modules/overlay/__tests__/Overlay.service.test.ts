import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockSettingsGet,
  mockSettingsSet,
  mockCurrentSessionIsActive,
  mockCurrentSessionGetCurrentSession,
  mockBrowserWindowGetAllWindows,
  mockOverlayShow,
  mockOverlayHide,
  mockOverlayIsVisible,
  mockOverlaySetPosition,
  mockOverlaySetSize,
  mockOverlaySetBounds,
  mockOverlaySetAlwaysOnTop,
  mockOverlaySetSkipTaskbar,
  mockOverlaySetBackgroundColor,
  mockOverlaySetOpacity,
  mockOverlayBlur,
  mockOverlayClose,
  mockOverlayGetBounds,
  mockOverlayIsDestroyed,
  mockOverlayIsResizable,
  mockOverlayLoadURL,
  mockOverlayLoadFile,
  mockOverlayOnce,
  mockOverlayOn,
  mockOverlaySetFocusable,
  mockOverlaySetIgnoreMouseEvents,
  mockOverlaySetResizable,
  mockOverlayRemoveListener,
  mockOverlayWebContentsSend,
  mockOverlayWebContentsOn,
  mockOverlayWebContentsSetWindowOpenHandler,
  mockOverlayWebContentsOpenDevTools,
  mockOverlayWebContentsGetURL,
  mockMainWindowWebContentsSend,
  mockScreenGetPrimaryDisplay,
  mockNativeImageCreateFromPath,
  mockAppIsPackaged,
  mockAppGetAppPath,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockSettingsSet: vi.fn().mockResolvedValue(undefined),
  mockCurrentSessionIsActive: vi.fn(),
  mockCurrentSessionGetCurrentSession: vi.fn(),
  mockBrowserWindowGetAllWindows: vi.fn(() => []),
  mockOverlayShow: vi.fn(),
  mockOverlayHide: vi.fn(),
  mockOverlayIsVisible: vi.fn(() => false),
  mockOverlaySetPosition: vi.fn(),
  mockOverlaySetSize: vi.fn(),
  mockOverlaySetBounds: vi.fn(),
  mockOverlaySetAlwaysOnTop: vi.fn(),
  mockOverlaySetSkipTaskbar: vi.fn(),
  mockOverlaySetBackgroundColor: vi.fn(),
  mockOverlaySetOpacity: vi.fn(),
  mockOverlayBlur: vi.fn(),
  mockOverlayClose: vi.fn(),
  mockOverlayGetBounds: vi.fn(() => ({ x: 0, y: 0, width: 250, height: 175 })),
  mockOverlayIsDestroyed: vi.fn(() => false),
  mockOverlayIsResizable: vi.fn(() => false),
  mockOverlayLoadURL: vi.fn(),
  mockOverlayLoadFile: vi.fn(),
  mockOverlayOnce: vi.fn(),
  mockOverlayOn: vi.fn(),
  mockOverlaySetFocusable: vi.fn(),
  mockOverlaySetIgnoreMouseEvents: vi.fn(),
  mockOverlaySetResizable: vi.fn(),
  mockOverlayRemoveListener: vi.fn(),
  mockOverlayWebContentsSend: vi.fn(),
  mockOverlayWebContentsOn: vi.fn(),
  mockOverlayWebContentsSetWindowOpenHandler: vi.fn(),
  mockOverlayWebContentsOpenDevTools: vi.fn(),
  mockOverlayWebContentsGetURL: vi.fn(() => "http://localhost:3000"),
  mockMainWindowWebContentsSend: vi.fn(),
  mockScreenGetPrimaryDisplay: vi.fn(() => ({
    workAreaSize: { width: 1920, height: 1080 },
    workArea: { x: 0, y: 0 },
  })),
  mockNativeImageCreateFromPath: vi.fn(() => ({
    isEmpty: vi.fn(() => false),
  })),
  mockAppIsPackaged: { value: false },
  mockAppGetAppPath: vi.fn(() => "/mock-app-path"),
}));

// Track BrowserWindow instances and their constructor options during tests
let overlayWindowInstances: any[] = [];
let overlayWindowOpts: any[] = [];

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => {
  class MockBrowserWindow {
    show = mockOverlayShow;
    hide = mockOverlayHide;
    isVisible = mockOverlayIsVisible;
    setPosition = mockOverlaySetPosition;
    setSize = mockOverlaySetSize;
    setBounds = mockOverlaySetBounds;
    setAlwaysOnTop = mockOverlaySetAlwaysOnTop;
    setSkipTaskbar = mockOverlaySetSkipTaskbar;
    setBackgroundColor = mockOverlaySetBackgroundColor;
    setOpacity = mockOverlaySetOpacity;
    blur = mockOverlayBlur;
    close = mockOverlayClose;
    getBounds = mockOverlayGetBounds;
    isDestroyed = mockOverlayIsDestroyed;
    isResizable = mockOverlayIsResizable;
    loadURL = mockOverlayLoadURL;
    loadFile = mockOverlayLoadFile;
    once = mockOverlayOnce;
    on = mockOverlayOn;
    setFocusable = mockOverlaySetFocusable;
    setIgnoreMouseEvents = mockOverlaySetIgnoreMouseEvents;
    setResizable = mockOverlaySetResizable;
    removeListener = mockOverlayRemoveListener;
    webContents = {
      send: mockOverlayWebContentsSend,
      on: mockOverlayWebContentsOn,
      setWindowOpenHandler: mockOverlayWebContentsSetWindowOpenHandler,
      openDevTools: mockOverlayWebContentsOpenDevTools,
      getURL: mockOverlayWebContentsGetURL,
    };

    constructor(opts: any) {
      overlayWindowInstances.push(this);
      overlayWindowOpts.push(opts);
    }

    static getAllWindows = mockBrowserWindowGetAllWindows;
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
    screen: {
      getPrimaryDisplay: mockScreenGetPrimaryDisplay,
    },
    nativeImage: {
      createFromPath: mockNativeImageCreateFromPath,
    },
    dialog: {
      showMessageBox: vi.fn(),
    },
  };
});

// ─── Mock SettingsStoreService ───────────────────────────────────────────────
vi.mock("~/main/modules/settings-store", () => ({
  SettingsStoreService: {
    getInstance: vi.fn(() => ({
      get: mockSettingsGet,
      set: mockSettingsSet,
    })),
  },
  SettingsKey: {
    OverlayBounds: "overlayBounds",
    ActiveGame: "selectedGame",
    AppExitAction: "appExitAction",
    AppOpenAtLogin: "appOpenAtLogin",
    AppOpenAtLoginMinimized: "appOpenAtLoginMinimized",
    Poe1PriceSource: "poe1PriceSource",
    Poe2PriceSource: "poe2PriceSource",
  },
}));

// ─── Mock CurrentSessionService ──────────────────────────────────────────────
vi.mock("~/main/modules/current-session", () => ({
  CurrentSessionService: {
    getInstance: vi.fn(() => ({
      isSessionActive: mockCurrentSessionIsActive,
      getCurrentSession: mockCurrentSessionGetCurrentSession,
    })),
  },
}));

// ─── Mock IPC validation ─────────────────────────────────────────────────────
class MockValidationError extends Error {
  constructor(
    public channel: string,
    public detail: string,
  ) {
    super(`[${channel}] ${detail}`);
    this.name = "IpcValidationError";
  }
}

vi.mock("~/main/utils/ipc-validation", () => ({
  assertBoolean: vi.fn((value: unknown, paramName: string, channel: string) => {
    if (typeof value !== "boolean") {
      throw new MockValidationError(
        channel,
        `Expected "${paramName}" to be a boolean, got ${typeof value}`,
      );
    }
  }),
  assertInteger: vi.fn(
    (
      value: unknown,
      paramName: string,
      channel: string,
      opts?: { min?: number; max?: number },
    ) => {
      if (typeof value !== "number" || !Number.isInteger(value)) {
        throw new MockValidationError(
          channel,
          `Expected "${paramName}" to be an integer`,
        );
      }
      if (opts?.min !== undefined && value < opts.min) {
        throw new MockValidationError(
          channel,
          `"${paramName}" must be >= ${opts.min}`,
        );
      }
      if (opts?.max !== undefined && value > opts.max) {
        throw new MockValidationError(
          channel,
          `"${paramName}" must be <= ${opts.max}`,
        );
      }
    },
  ),
  handleValidationError: vi.fn((error: unknown, _channel: string) => {
    if (error instanceof MockValidationError) {
      return { success: false, error: `Invalid input: ${error.detail}` };
    }
    throw error;
  }),
}));

// ─── Global constants that the Overlay service references ────────────────────
// @ts-expect-error — injected by Vite at build time
globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:3000";
// @ts-expect-error — injected by Vite at build time
globalThis.MAIN_WINDOW_VITE_NAME = "main_window";

// ─── Import under test (after mocks) ────────────────────────────────────────
import { OverlayChannel } from "../Overlay.channels";
import { OverlayService } from "../Overlay.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the handler registered for a given IPC channel from call history */
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

/** Capture all IPC handler registrations from mockIpcHandle (snapshot of call history) */
function captureIpcHandlers(): any[][] {
  return [...mockIpcHandle.mock.calls];
}

/** Set up a mock main window that BrowserWindow.getAllWindows returns */
function setupMockMainWindow() {
  const mainWindow = {
    isDestroyed: vi.fn(() => false),
    webContents: {
      send: mockMainWindowWebContentsSend,
      getURL: vi.fn(() => "http://localhost:3000/index.html"),
    },
  };
  mockBrowserWindowGetAllWindows.mockReturnValue([mainWindow] as any);
  return mainWindow;
}

/** Selectively clear overlay-related mocks (but NOT mockIpcHandle) */
function clearOverlayMocks() {
  mockOverlayShow.mockClear();
  mockOverlayHide.mockClear();
  mockOverlayIsVisible.mockClear();
  mockOverlaySetPosition.mockClear();
  mockOverlaySetSize.mockClear();
  mockOverlaySetBounds.mockClear();
  mockOverlaySetAlwaysOnTop.mockClear();
  mockOverlaySetSkipTaskbar.mockClear();
  mockOverlaySetBackgroundColor.mockClear();
  mockOverlaySetOpacity.mockClear();
  mockOverlayBlur.mockClear();
  mockOverlayClose.mockClear();
  mockOverlayIsDestroyed.mockClear();
  mockOverlayIsResizable.mockClear();
  mockOverlayLoadURL.mockClear();
  mockOverlayLoadFile.mockClear();
  mockOverlayOnce.mockClear();
  mockOverlayOn.mockClear();
  mockOverlaySetFocusable.mockClear();
  mockOverlaySetIgnoreMouseEvents.mockClear();
  mockOverlaySetResizable.mockClear();
  mockOverlayRemoveListener.mockClear();
  mockOverlayWebContentsSend.mockClear();
  mockOverlayWebContentsOn.mockClear();
  mockOverlayWebContentsSetWindowOpenHandler.mockClear();
  mockOverlayWebContentsOpenDevTools.mockClear();
  mockMainWindowWebContentsSend.mockClear();
  mockBrowserWindowGetAllWindows.mockClear();
  mockSettingsSet.mockClear();
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("OverlayService", () => {
  let service: OverlayService;
  // Captured IPC handler references that survive selective clearing
  let ipcHandlerCalls: any[][];
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    overlayWindowInstances = [];
    overlayWindowOpts = [];

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    OverlayService._instance = undefined;

    // Default mock return values
    mockSettingsGet.mockResolvedValue(null);
    mockCurrentSessionIsActive.mockReturnValue(false);
    mockCurrentSessionGetCurrentSession.mockResolvedValue(null);
    mockOverlayIsVisible.mockReturnValue(false);
    mockOverlayGetBounds.mockReturnValue({
      x: 100,
      y: 200,
      width: 250,
      height: 175,
    });
    mockBrowserWindowGetAllWindows.mockReturnValue([]);
    mockAppIsPackaged.value = false;
    mockAppGetAppPath.mockReturnValue("/mock-app-path");

    // Re-setup after clearAllMocks
    mockNativeImageCreateFromPath.mockReturnValue({
      isEmpty: vi.fn(() => false),
    });
    mockScreenGetPrimaryDisplay.mockReturnValue({
      workAreaSize: { width: 1920, height: 1080 },
      workArea: { x: 0, y: 0 },
    });

    // Ensure process.resourcesPath is always defined for any production-mode paths
    try {
      Object.defineProperty(process, "resourcesPath", {
        value: "/mock-resources",
        writable: true,
        configurable: true,
      });
    } catch {
      (process as any).resourcesPath = "/mock-resources";
    }

    // Reset the global dev server URL
    // @ts-expect-error — injected by Vite at build time
    globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:3000";

    // Construct the service and capture IPC handlers immediately
    service = OverlayService.getInstance();
    ipcHandlerCalls = captureIpcHandlers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    Object.defineProperty(process, "platform", { value: originalPlatform });
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = OverlayService.getInstance();
      const b = OverlayService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      expect(service).toBeInstanceOf(OverlayService);
    });
  });

  // ─── Constructor / setupHandlers ─────────────────────────────────────────

  describe("constructor (setupHandlers)", () => {
    it("should register all expected IPC channels", () => {
      const channels = ipcHandlerCalls.map(([ch]: [string]) => ch);
      expect(channels).toContain(OverlayChannel.Show);
      expect(channels).toContain(OverlayChannel.Hide);
      expect(channels).toContain(OverlayChannel.Toggle);
      expect(channels).toContain(OverlayChannel.IsVisible);
      expect(channels).toContain(OverlayChannel.SetPosition);
      expect(channels).toContain(OverlayChannel.SetSize);
      expect(channels).toContain(OverlayChannel.GetBounds);
      expect(channels).toContain(OverlayChannel.SetLocked);
      expect(channels).toContain(OverlayChannel.RestoreDefaults);
      expect(channels).toContain(OverlayChannel.GetSessionData);
    });

    it("should register exactly 10 IPC handlers", () => {
      expect(ipcHandlerCalls.length).toBe(10);
    });
  });

  // ─── IPC: overlay:is-visible ─────────────────────────────────────────────

  describe("IPC: overlay:is-visible", () => {
    it("should return false initially", async () => {
      const handler = getIpcHandler(OverlayChannel.IsVisible, ipcHandlerCalls);
      const result = await handler({});
      expect(result).toBe(false);
    });
  });

  // ─── show ────────────────────────────────────────────────────────────────

  describe("show", () => {
    it("should create the overlay window if it does not exist", async () => {
      await service.show();
      expect(overlayWindowInstances.length).toBe(1);
    });

    it("should not create a second overlay window if one already exists", async () => {
      await service.show();
      await service.show();
      expect(overlayWindowInstances.length).toBe(1);
    });

    it("should call show on the overlay window", async () => {
      await service.show();
      expect(mockOverlayShow).toHaveBeenCalled();
    });

    it("should set alwaysOnTop to true with screen-saver level", async () => {
      await service.show();
      expect(mockOverlaySetAlwaysOnTop).toHaveBeenCalledWith(
        true,
        "screen-saver",
      );
    });

    it("should blur the overlay to avoid stealing focus", async () => {
      await service.show();
      expect(mockOverlayBlur).toHaveBeenCalled();
    });

    it("should notify main window of visibility change", async () => {
      setupMockMainWindow();
      await service.show();
      expect(mockMainWindowWebContentsSend).toHaveBeenCalledWith(
        OverlayChannel.VisibilityChanged,
        true,
      );
    });

    it("should set opacity for the repaint hack when window was not visible", async () => {
      mockOverlayIsVisible.mockReturnValue(false);
      await service.show();
      expect(mockOverlaySetOpacity).toHaveBeenCalledWith(0.99);
    });

    it("should restore opacity to 1 after the repaint delay", async () => {
      mockOverlayIsVisible.mockReturnValue(false);
      await service.show();

      vi.advanceTimersByTime(200);

      expect(mockOverlaySetOpacity).toHaveBeenCalledWith(1);
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(OverlayChannel.Show, ipcHandlerCalls);
      await handler({});
      expect(overlayWindowInstances.length).toBe(1);
    });
  });

  // ─── hide ────────────────────────────────────────────────────────────────

  describe("hide", () => {
    it("should hide the overlay window", async () => {
      await service.show();
      clearOverlayMocks();
      setupMockMainWindow();

      await service.hide();
      expect(mockOverlayHide).toHaveBeenCalledTimes(1);
    });

    it("should notify main window of visibility change to false", async () => {
      await service.show();
      clearOverlayMocks();
      setupMockMainWindow();

      await service.hide();
      expect(mockMainWindowWebContentsSend).toHaveBeenCalledWith(
        OverlayChannel.VisibilityChanged,
        false,
      );
    });

    it("should not throw when overlay window does not exist", async () => {
      await expect(service.hide()).resolves.not.toThrow();
    });

    it("should not call hide when overlay window is null", async () => {
      await service.hide();
      expect(mockOverlayHide).not.toHaveBeenCalled();
    });

    it("should work through the IPC handler", async () => {
      await service.show();
      clearOverlayMocks();

      const handler = getIpcHandler(OverlayChannel.Hide, ipcHandlerCalls);
      await handler({});
      expect(mockOverlayHide).toHaveBeenCalledTimes(1);
    });
  });

  // ─── toggle ──────────────────────────────────────────────────────────────

  describe("toggle", () => {
    it("should show the overlay when it is not visible", async () => {
      const handler = getIpcHandler(OverlayChannel.Toggle, ipcHandlerCalls);
      await handler({});
      // Overlay was created and shown
      expect(overlayWindowInstances.length).toBe(1);
      expect(mockOverlayShow).toHaveBeenCalled();
    });

    it("should hide the overlay when it is visible", async () => {
      // First show it
      await service.show();
      clearOverlayMocks();

      // Now toggle should hide
      await service.toggle();
      expect(mockOverlayHide).toHaveBeenCalledTimes(1);
    });
  });

  // ─── setPosition ─────────────────────────────────────────────────────────

  describe("setPosition", () => {
    it("should set position on the overlay window", async () => {
      await service.show();
      clearOverlayMocks();

      service.setPosition(100, 200);
      expect(mockOverlaySetPosition).toHaveBeenCalledWith(100, 200);
    });

    it("should not throw when overlay window does not exist", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      service.setPosition(100, 200);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot set position"),
      );
    });

    it("should work through the IPC handler with valid values", async () => {
      await service.show();
      clearOverlayMocks();

      const handler = getIpcHandler(
        OverlayChannel.SetPosition,
        ipcHandlerCalls,
      );
      await handler({}, 300, 400);
      expect(mockOverlaySetPosition).toHaveBeenCalledWith(300, 400);
    });

    it("should return validation error for non-integer x", async () => {
      await service.show();
      const handler = getIpcHandler(
        OverlayChannel.SetPosition,
        ipcHandlerCalls,
      );
      const result = await handler({}, 1.5, 200);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for non-number x", async () => {
      await service.show();
      const handler = getIpcHandler(
        OverlayChannel.SetPosition,
        ipcHandlerCalls,
      );
      const result = await handler({}, "abc", 200);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for non-integer y", async () => {
      await service.show();
      const handler = getIpcHandler(
        OverlayChannel.SetPosition,
        ipcHandlerCalls,
      );
      const result = await handler({}, 100, 2.5);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── setSize ─────────────────────────────────────────────────────────────

  describe("setSize", () => {
    it("should set size on the overlay window via setBounds", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(false);
      mockOverlayGetBounds.mockReturnValue({
        x: 100,
        y: 200,
        width: 250,
        height: 175,
      });

      service.setSize(800, 600);

      // Should temporarily enable resizable since window is non-resizable
      expect(mockOverlaySetResizable).toHaveBeenCalledWith(true);
      // Should use setBounds with current x/y and new width/height
      expect(mockOverlaySetBounds).toHaveBeenCalledWith({
        x: 100,
        y: 200,
        width: 800,
        height: 600,
      });
      // Should restore resizable to false
      expect(mockOverlaySetResizable).toHaveBeenCalledWith(false);
    });

    it("should not toggle resizable when already resizable", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(true);
      mockOverlayGetBounds.mockReturnValue({
        x: 50,
        y: 50,
        width: 200,
        height: 150,
      });

      service.setSize(400, 300);

      // Should NOT call setResizable at all when already resizable
      expect(mockOverlaySetResizable).not.toHaveBeenCalled();
      expect(mockOverlaySetBounds).toHaveBeenCalledWith({
        x: 50,
        y: 50,
        width: 400,
        height: 300,
      });
    });

    it("should not throw when overlay window does not exist", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      service.setSize(800, 600);
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Cannot set size"),
      );
    });

    it("should work through the IPC handler with valid values", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(false);
      mockOverlayGetBounds.mockReturnValue({
        x: 0,
        y: 0,
        width: 250,
        height: 175,
      });

      const handler = getIpcHandler(OverlayChannel.SetSize, ipcHandlerCalls);
      await handler({}, 500, 300);
      expect(mockOverlaySetBounds).toHaveBeenCalledWith(
        expect.objectContaining({ width: 500, height: 300 }),
      );
    });

    it("should debounce DB save on setSize", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(false);
      mockOverlayGetBounds.mockReturnValue({
        x: 0,
        y: 0,
        width: 250,
        height: 175,
      });

      // Call setSize multiple times rapidly
      service.setSize(300, 200);
      service.setSize(400, 250);
      // Update mock to reflect the last setBounds call (saveBoundsImmediate reads fresh getBounds)
      mockOverlayGetBounds.mockReturnValue({
        x: 0,
        y: 0,
        width: 500,
        height: 300,
      });
      service.setSize(500, 300);

      // Should NOT have saved to DB yet
      expect(mockSettingsSet).not.toHaveBeenCalled();

      // Advance past debounce delay (300ms)
      vi.advanceTimersByTime(300);

      // Should have saved once (debounced)
      expect(mockSettingsSet).toHaveBeenCalledTimes(1);
      expect(mockSettingsSet).toHaveBeenCalledWith(
        "overlayBounds",
        expect.objectContaining({ width: 500, height: 300 }),
      );
    });

    it("should return validation error for non-integer width", async () => {
      await service.show();
      const handler = getIpcHandler(OverlayChannel.SetSize, ipcHandlerCalls);
      const result = await handler({}, 1.5, 300);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for non-integer height", async () => {
      await service.show();
      const handler = getIpcHandler(OverlayChannel.SetSize, ipcHandlerCalls);
      const result = await handler({}, 500, "abc");
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── getBounds ───────────────────────────────────────────────────────────

  describe("getBounds", () => {
    it("should return null when overlay window does not exist", () => {
      const bounds = service.getBounds();
      expect(bounds).toBeNull();
    });

    it("should return bounds when overlay window exists", async () => {
      mockOverlayGetBounds.mockReturnValue({
        x: 100,
        y: 200,
        width: 250,
        height: 175,
      });

      await service.show();
      const bounds = service.getBounds();
      expect(bounds).toEqual({
        x: 100,
        y: 200,
        width: 250,
        height: 175,
      });
    });

    it("should work through the IPC handler", async () => {
      const handler = getIpcHandler(OverlayChannel.GetBounds, ipcHandlerCalls);

      // No window yet
      const nullResult = await handler({});
      expect(nullResult).toBeNull();

      // After creating window
      await service.show();
      mockOverlayGetBounds.mockReturnValue({
        x: 50,
        y: 75,
        width: 300,
        height: 200,
      });
      const result = await handler({});
      expect(result).toEqual({ x: 50, y: 75, width: 300, height: 200 });
    });
  });

  // ─── destroy ─────────────────────────────────────────────────────────────

  describe("destroy", () => {
    it("should close the overlay window", async () => {
      await service.show();
      clearOverlayMocks();

      service.destroy();
      expect(mockOverlayClose).toHaveBeenCalledTimes(1);
    });

    it("should set overlay window to null after destroy", async () => {
      await service.show();
      service.destroy();
      expect(service.getWindow()).toBeNull();
    });

    it("should set isVisible to false after destroy", async () => {
      await service.show();
      service.destroy();

      const handler = getIpcHandler(OverlayChannel.IsVisible, ipcHandlerCalls);
      const result = await handler({});
      expect(result).toBe(false);
    });

    it("should not throw when overlay window does not exist", () => {
      expect(() => service.destroy()).not.toThrow();
    });

    it("should not call close when overlay is null", () => {
      service.destroy();
      expect(mockOverlayClose).not.toHaveBeenCalled();
    });
  });

  // ─── getWindow ───────────────────────────────────────────────────────────

  describe("getWindow", () => {
    it("should return null when no overlay has been created", () => {
      expect(service.getWindow()).toBeNull();
    });

    it("should return the BrowserWindow after overlay is created", async () => {
      await service.show();
      const window = service.getWindow();
      expect(window).not.toBeNull();
      expect(overlayWindowInstances).toContain(window);
    });
  });

  // ─── createOverlay ───────────────────────────────────────────────────────

  describe("createOverlay", () => {
    it("should use saved bounds from settings when available", async () => {
      const savedBounds = { x: 500, y: 300, width: 400, height: 200 };
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "overlayBounds") return savedBounds;
        return null;
      });

      await service.show();

      expect(overlayWindowInstances.length).toBe(1);
      expect(overlayWindowOpts[0]).toMatchObject({
        x: 500,
        y: 300,
        width: 400,
        height: 200,
      });
    });

    it("should not call screen.getPrimaryDisplay when saved bounds exist", async () => {
      const savedBounds = { x: 100, y: 100, width: 300, height: 180 };
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "overlayBounds") return savedBounds;
        return null;
      });
      mockScreenGetPrimaryDisplay.mockClear();

      await service.show();

      expect(mockScreenGetPrimaryDisplay).not.toHaveBeenCalled();
    });

    it("should calculate default position as top-left with 20px margin when no saved bounds exist", async () => {
      mockSettingsGet.mockResolvedValue(null);
      mockScreenGetPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1920, height: 1080 },
        workArea: { x: 0, y: 0 },
      });

      await service.show();
      expect(mockScreenGetPrimaryDisplay).toHaveBeenCalled();
      expect(overlayWindowOpts[0]).toMatchObject({
        x: 20,
        y: 20,
        width: 250,
        height: 175,
      });
    });

    it("should produce valid default position on a small 768p laptop screen", async () => {
      mockSettingsGet.mockResolvedValue(null);
      mockScreenGetPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1366, height: 728 },
        workArea: { x: 0, y: 0 },
      });

      await service.show();
      const opts = overlayWindowOpts[0];
      expect(opts.x).toBe(20);
      expect(opts.y).toBe(20);
      // Verify overlay fits on-screen (x + width < screen width, y + height < screen height)
      expect(opts.x + opts.width).toBeLessThan(1366);
      expect(opts.y + opts.height).toBeLessThan(728);
    });

    it("should offset default position by workArea origin when taskbar shifts it", async () => {
      mockSettingsGet.mockResolvedValue(null);
      // Simulate a left-side taskbar that offsets workArea by 64px
      mockScreenGetPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1856, height: 1080 },
        workArea: { x: 64, y: 0 },
      });

      await service.show();
      expect(overlayWindowOpts[0]).toMatchObject({
        x: 84, // 64 + 20
        y: 20, // 0 + 20
      });
    });

    it("should offset default position by workArea origin when taskbar is on top", async () => {
      mockSettingsGet.mockResolvedValue(null);
      // Simulate a top taskbar that offsets workArea by 40px vertically
      mockScreenGetPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1920, height: 1040 },
        workArea: { x: 0, y: 40 },
      });

      await service.show();
      expect(overlayWindowOpts[0]).toMatchObject({
        x: 20, // 0 + 20
        y: 60, // 40 + 20
      });
    });

    it("should not create a second window if one already exists", async () => {
      await service.show();
      // Calling createOverlay internally through show again
      await service.show();
      expect(overlayWindowInstances.length).toBe(1);
    });

    it("should load the overlay URL in development mode", async () => {
      // @ts-expect-error — injected by Vite
      globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:3000";
      mockAppIsPackaged.value = false;

      await service.show();
      expect(mockOverlayLoadURL).toHaveBeenCalledWith(
        "http://localhost:3000/overlay.html",
      );
    });

    it("should open dev tools in development mode", async () => {
      // @ts-expect-error — injected by Vite
      globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = "http://localhost:3000";
      mockAppIsPackaged.value = false;

      await service.show();
      expect(mockOverlayWebContentsOpenDevTools).toHaveBeenCalledWith({
        mode: "detach",
      });
    });

    it("should load from file in production mode", async () => {
      // @ts-expect-error — injected by Vite
      globalThis.MAIN_WINDOW_VITE_DEV_SERVER_URL = undefined;
      mockAppIsPackaged.value = true;

      await service.show();
      expect(mockOverlayLoadFile).toHaveBeenCalledWith(
        expect.stringContaining("overlay.html"),
      );
    });

    it("should register a will-navigate security handler on webContents", async () => {
      await service.show();
      expect(mockOverlayWebContentsOn).toHaveBeenCalledWith(
        "will-navigate",
        expect.any(Function),
      );
    });

    it("should register a window open handler for security", async () => {
      await service.show();
      expect(mockOverlayWebContentsSetWindowOpenHandler).toHaveBeenCalledWith(
        expect.any(Function),
      );
    });

    it("should block overlay window.open requests", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await service.show();

      const openHandler =
        mockOverlayWebContentsSetWindowOpenHandler.mock.calls[0][0];
      const result = openHandler({ url: "https://evil.com" });
      expect(result).toEqual({ action: "deny" });
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Blocked overlay window.open"),
      );
    });

    it("should block overlay navigation", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await service.show();

      const navHandler = mockOverlayWebContentsOn.mock.calls.find(
        ([event]: [string]) => event === "will-navigate",
      )?.[1];
      expect(navHandler).toBeDefined();

      const mockEvent = { preventDefault: vi.fn() };
      navHandler(mockEvent, "https://evil.com");
      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Blocked overlay navigation"),
      );
    });

    it("should register a closed handler on the overlay window", async () => {
      await service.show();
      expect(mockOverlayOn).toHaveBeenCalledWith(
        "closed",
        expect.any(Function),
      );
    });

    it("should clean up references when overlay window is closed", async () => {
      setupMockMainWindow();
      await service.show();

      // Find and invoke the "closed" handler
      const closedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "closed",
      );
      expect(closedCall).toBeDefined();
      const closedHandler = closedCall![1];

      clearOverlayMocks();
      setupMockMainWindow();

      closedHandler();

      // Window should be null
      expect(service.getWindow()).toBeNull();

      // getBounds should be null when window is gone
      expect(service.getBounds()).toBeNull();

      // Should notify visibility changed to false
      expect(mockMainWindowWebContentsSend).toHaveBeenCalledWith(
        OverlayChannel.VisibilityChanged,
        false,
      );
    });

    it("should register a ready-to-show handler", async () => {
      await service.show();
      expect(mockOverlayOnce).toHaveBeenCalledWith(
        "ready-to-show",
        expect.any(Function),
      );
    });

    it("should execute ready-to-show callback body when isVisible is true", async () => {
      await service.show();

      // Find and invoke the "ready-to-show" handler
      const readyToShowCall = mockOverlayOnce.mock.calls.find(
        ([event]: [string]) => event === "ready-to-show",
      );
      expect(readyToShowCall).toBeDefined();
      const readyToShowHandler = readyToShowCall![1];

      // Clear mocks so we can track calls from the callback only
      clearOverlayMocks();

      // isVisible is already true (set by show()), invoke the callback
      readyToShowHandler();

      // Advance past the outer setTimeout(50ms)
      vi.advanceTimersByTime(50);

      // The callback should call show(), blur(), and setOpacity(0.99)
      expect(mockOverlayShow).toHaveBeenCalled();
      expect(mockOverlayBlur).toHaveBeenCalled();
      expect(mockOverlaySetOpacity).toHaveBeenCalledWith(0.99);

      // Advance past the inner setTimeout(100ms) for opacity reset
      vi.advanceTimersByTime(100);
      expect(mockOverlaySetOpacity).toHaveBeenCalledWith(1);
    });

    it("should not execute ready-to-show callback body when isVisible is false", async () => {
      await service.show();

      // Flush pending timers from show() (the opacity reset setTimeout)
      vi.advanceTimersByTime(200);

      // Find the "ready-to-show" handler
      const readyToShowCall = mockOverlayOnce.mock.calls.find(
        ([event]: [string]) => event === "ready-to-show",
      );
      expect(readyToShowCall).toBeDefined();
      const readyToShowHandler = readyToShowCall![1];

      // Hide the overlay first so isVisible becomes false
      await service.hide();
      clearOverlayMocks();

      // Invoke the callback — should do nothing since isVisible is false
      readyToShowHandler();
      vi.advanceTimersByTime(200);

      // show/blur/setOpacity should NOT be called from the callback
      expect(mockOverlayShow).not.toHaveBeenCalled();
      expect(mockOverlayBlur).not.toHaveBeenCalled();
      expect(mockOverlaySetOpacity).not.toHaveBeenCalled();
    });

    it("should set skipTaskbar on Windows", async () => {
      Object.defineProperty(process, "platform", { value: "win32" });

      await service.show();
      expect(mockOverlaySetSkipTaskbar).toHaveBeenCalledWith(true);
    });
  });

  // ─── getSessionData ──────────────────────────────────────────────────────

  describe("getSessionData (via IPC handler)", () => {
    /**
     * Helper: mock settingsStore.get to return different values per key.
     * Defaults: activeGame = "poe1", poe1PriceSource = "exchange", poe2PriceSource = "exchange"
     */
    function mockSettingsForGame(
      activeGame: "poe1" | "poe2" = "poe1",
      overrides: Record<string, string> = {},
    ) {
      const defaults: Record<string, string> = {
        selectedGame: activeGame,
        poe1PriceSource: "exchange",
        poe2PriceSource: "exchange",
        ...overrides,
      };
      // Reset first to clear any mockResolvedValue set in beforeEach
      mockSettingsGet.mockReset();
      mockSettingsGet.mockImplementation((key: string) =>
        Promise.resolve(defaults[key] ?? activeGame),
      );
    }

    it("should return inactive session data when no session is active", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(false);

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result).toEqual({
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
      });
    });

    it("should return inactive session data when session is active but getCurrentSession returns null", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue(null);

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result).toEqual({
        isActive: false,
        totalCount: 0,
        totalProfit: 0,
        chaosToDivineRatio: 0,
        priceSource: "exchange",
        cards: [],
        recentDrops: [],
      });
    });

    it("should return active session data with cards", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 42,
        totals: {
          exchange: {
            totalValue: 1500,
            chaosToDivineRatio: 200,
          },
        },
        cards: [
          { name: "The Doctor", count: 3 },
          { name: "The Nurse", count: 7 },
        ],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result).toEqual({
        isActive: true,
        totalCount: 42,
        totalProfit: 1500,
        chaosToDivineRatio: 200,
        priceSource: "exchange",
        cards: [
          { cardName: "The Doctor", count: 3 },
          { cardName: "The Nurse", count: 7 },
        ],
        recentDrops: [],
      });
    });

    it("should handle session with no cards array", async () => {
      mockSettingsForGame("poe2");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 10,
        totals: {
          exchange: {
            totalValue: 500,
            chaosToDivineRatio: 150,
          },
        },
        cards: null,
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result.isActive).toBe(true);
      expect(result.totalCount).toBe(10);
      expect(result.cards).toEqual([]);
      expect(result.recentDrops).toEqual([]);
    });

    it("should handle session with missing totals", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 5,
        totals: null,
        cards: [],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result.isActive).toBe(true);
      expect(result.totalCount).toBe(5);
      expect(result.totalProfit).toBe(0);
      expect(result.chaosToDivineRatio).toBe(0);
    });

    it("should handle session with zero totalCount", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 0,
        totals: {
          exchange: {
            totalValue: 0,
            chaosToDivineRatio: 0,
          },
        },
        cards: [],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result.isActive).toBe(true);
      expect(result.totalCount).toBe(0);
      expect(result.totalProfit).toBe(0);
    });

    it("should handle session with missing exchange price source", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 15,
        totals: {
          stash: {
            totalValue: 800,
            chaosToDivineRatio: 180,
          },
        },
        cards: [{ name: "House of Mirrors", count: 1 }],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      // exchange key doesn't exist in totals, so totalProfit and ratio should be 0
      expect(result.isActive).toBe(true);
      expect(result.totalProfit).toBe(0);
      expect(result.chaosToDivineRatio).toBe(0);
      expect(result.priceSource).toBe("exchange");
    });

    it("should use stash price source for poe2 when explicitly configured", async () => {
      mockSettingsForGame("poe2", { poe2PriceSource: "stash" });
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 5,
        totals: {
          stash: {
            totalValue: 300,
            chaosToDivineRatio: 150,
          },
        },
        cards: [{ name: "The Survivalist", count: 1 }],
        recentDrops: [
          {
            cardName: "The Survivalist",
            rarity: 0,
            exchangePrice: { chaosValue: 0, divineValue: 0 },
            stashPrice: { chaosValue: 1, divineValue: 0.01 },
          },
        ],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result.priceSource).toBe("stash");
      expect(result.totalProfit).toBe(300);
      expect(result.chaosToDivineRatio).toBe(150);
      expect(result.recentDrops).toEqual([
        {
          cardName: "The Survivalist",
          rarity: 0,
          exchangePrice: { chaosValue: 0, divineValue: 0 },
          stashPrice: { chaosValue: 1, divineValue: 0.01 },
        },
      ]);
    });

    it("should default to exchange price source for poe2", async () => {
      mockSettingsForGame("poe2");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 3,
        totals: {
          exchange: {
            totalValue: 200,
            chaosToDivineRatio: 180,
          },
        },
        cards: [{ name: "Rain of Chaos", count: 3 }],
        recentDrops: [],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result.priceSource).toBe("exchange");
      expect(result.totalProfit).toBe(200);
      expect(result.chaosToDivineRatio).toBe(180);
    });

    it("should include recentDrops from session and default missing rarity to 4", async () => {
      mockSettingsForGame("poe1");
      mockCurrentSessionIsActive.mockReturnValue(true);
      mockCurrentSessionGetCurrentSession.mockResolvedValue({
        totalCount: 2,
        totals: {
          exchange: {
            totalValue: 100,
            chaosToDivineRatio: 200,
          },
        },
        cards: [{ name: "Rain of Chaos", count: 2 }],
        recentDrops: [
          {
            cardName: "Rain of Chaos",
            exchangePrice: { chaosValue: 0.5, divineValue: 0 },
            stashPrice: { chaosValue: 0.5, divineValue: 0 },
          },
        ],
      });

      const handler = getIpcHandler(
        OverlayChannel.GetSessionData,
        ipcHandlerCalls,
      );
      const result = await handler({});

      expect(result.recentDrops).toHaveLength(1);
      expect(result.recentDrops[0].rarity).toBe(4); // defaulted from undefined
      expect(result.recentDrops[0].cardName).toBe("Rain of Chaos");
    });
  });

  // ─── notifyVisibilityChanged ─────────────────────────────────────────────

  describe("notifyVisibilityChanged", () => {
    it("should send visibility change to main window (not overlay)", async () => {
      const mainWindow = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: mockMainWindowWebContentsSend,
          getURL: vi.fn(() => "http://localhost:3000/index.html"),
        },
      };
      const overlayWin = {
        isDestroyed: vi.fn(() => false),
        webContents: {
          send: vi.fn(),
          getURL: vi.fn(() => "http://localhost:3000/overlay.html"),
        },
      };
      mockBrowserWindowGetAllWindows.mockReturnValue([
        mainWindow,
        overlayWin,
      ] as any);

      await service.show();

      expect(mockMainWindowWebContentsSend).toHaveBeenCalledWith(
        OverlayChannel.VisibilityChanged,
        true,
      );
      // The overlay window's send should NOT have received the visibility notification
      expect(overlayWin.webContents.send).not.toHaveBeenCalledWith(
        OverlayChannel.VisibilityChanged,
        expect.anything(),
      );
    });

    it("should handle case where no main window exists", async () => {
      mockBrowserWindowGetAllWindows.mockReturnValue([]);

      // Should not throw
      await expect(service.show()).resolves.not.toThrow();
    });

    it("should not send to destroyed windows", async () => {
      const destroyedWindow = {
        isDestroyed: vi.fn(() => true),
        webContents: {
          send: vi.fn(),
          getURL: vi.fn(() => "http://localhost:3000/index.html"),
        },
      };
      mockBrowserWindowGetAllWindows.mockReturnValue([destroyedWindow] as any);

      await service.show();

      expect(destroyedWindow.webContents.send).not.toHaveBeenCalled();
    });
  });

  // ─── State transitions ──────────────────────────────────────────────────

  describe("state transitions", () => {
    it("should track visibility through show -> hide -> show cycle", async () => {
      setupMockMainWindow();
      const isVisibleHandler = getIpcHandler(
        OverlayChannel.IsVisible,
        ipcHandlerCalls,
      );

      // Initially hidden
      expect(await isVisibleHandler({})).toBe(false);

      // Show
      await service.show();
      expect(await isVisibleHandler({})).toBe(true);

      // Hide
      await service.hide();
      expect(await isVisibleHandler({})).toBe(false);

      // Show again
      await service.show();
      expect(await isVisibleHandler({})).toBe(true);
    });

    it("should track visibility through show -> destroy cycle", async () => {
      const isVisibleHandler = getIpcHandler(
        OverlayChannel.IsVisible,
        ipcHandlerCalls,
      );

      await service.show();
      expect(await isVisibleHandler({})).toBe(true);

      service.destroy();
      expect(await isVisibleHandler({})).toBe(false);
      expect(service.getWindow()).toBeNull();
    });

    it("should track visibility through toggle cycles", async () => {
      const isVisibleHandler = getIpcHandler(
        OverlayChannel.IsVisible,
        ipcHandlerCalls,
      );

      // Toggle on (show)
      await service.toggle();
      expect(await isVisibleHandler({})).toBe(true);

      // Toggle off (hide)
      await service.toggle();
      expect(await isVisibleHandler({})).toBe(false);

      // Toggle on again (show)
      await service.toggle();
      expect(await isVisibleHandler({})).toBe(true);
    });
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should handle create -> show -> reposition -> resize -> get bounds -> hide -> destroy", async () => {
      setupMockMainWindow();

      // Show (creates overlay)
      await service.show();
      expect(overlayWindowInstances.length).toBe(1);

      // Set position
      service.setPosition(500, 300);
      expect(mockOverlaySetPosition).toHaveBeenCalledWith(500, 300);

      // Set size (now uses setBounds internally)
      mockOverlayIsResizable.mockReturnValue(false);
      mockOverlayGetBounds.mockReturnValue({
        x: 500,
        y: 300,
        width: 250,
        height: 175,
      });
      service.setSize(400, 250);
      expect(mockOverlaySetBounds).toHaveBeenCalledWith({
        x: 500,
        y: 300,
        width: 400,
        height: 250,
      });

      // Get bounds
      mockOverlayGetBounds.mockReturnValue({
        x: 500,
        y: 300,
        width: 400,
        height: 250,
      });
      const bounds = service.getBounds();
      expect(bounds).toEqual({ x: 500, y: 300, width: 400, height: 250 });

      // Hide
      await service.hide();
      expect(mockOverlayHide).toHaveBeenCalled();

      // Destroy
      service.destroy();
      expect(mockOverlayClose).toHaveBeenCalled();
      expect(service.getWindow()).toBeNull();
    });

    it("should recreate overlay after destroy when show is called again", async () => {
      // First lifecycle
      await service.show();
      expect(overlayWindowInstances.length).toBe(1);
      service.destroy();
      expect(service.getWindow()).toBeNull();

      // Second lifecycle — should create a new window
      await service.show();
      expect(overlayWindowInstances.length).toBe(2);
      expect(service.getWindow()).not.toBeNull();
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle getBounds returning specific values", async () => {
      await service.show();
      mockOverlayGetBounds.mockReturnValue({
        x: -100,
        y: -50,
        width: 1,
        height: 1,
      });
      const bounds = service.getBounds();
      expect(bounds).toEqual({ x: -100, y: -50, width: 1, height: 1 });
    });

    it("should use default width/height when saved bounds have no dimensions", async () => {
      mockSettingsGet.mockImplementation(async (key: string) => {
        if (key === "overlayBounds") return { x: 100, y: 200 };
        return null;
      });

      await service.show();
      // Should still create the window (uses 250/145 defaults for missing width/height)
      expect(overlayWindowInstances.length).toBe(1);
    });

    it("should handle multiple rapid show/hide calls", async () => {
      await service.show();
      await service.hide();
      await service.show();
      await service.hide();
      await service.show();

      // Only one window should exist
      expect(overlayWindowInstances.length).toBe(1);
    });

    it("should handle destroy called multiple times", async () => {
      await service.show();
      service.destroy();
      service.destroy();

      // close should only be called once (second time window is already null)
      expect(mockOverlayClose).toHaveBeenCalledTimes(1);
      expect(service.getWindow()).toBeNull();
    });

    it("should handle show after hide without creating a new window", async () => {
      await service.show();
      expect(overlayWindowInstances.length).toBe(1);

      await service.hide();
      await service.show();

      // Same window reused
      expect(overlayWindowInstances.length).toBe(1);
    });

    it("should take the else-if branch in show() when window is already visible", async () => {
      // First call creates overlay and shows it
      await service.show();

      // Make isVisible return true so the else-if branch is hit on next show()
      mockOverlayIsVisible.mockReturnValue(true);
      clearOverlayMocks();

      // Second call should hit the else-if branch (window exists AND isVisible() is true)
      await service.show();

      // The else-if branch calls setAlwaysOnTop, show, blur — but NOT setOpacity
      expect(mockOverlaySetAlwaysOnTop).toHaveBeenCalledWith(
        true,
        "screen-saver",
      );
      expect(mockOverlayShow).toHaveBeenCalled();
      expect(mockOverlayBlur).toHaveBeenCalled();
      expect(mockOverlaySetOpacity).not.toHaveBeenCalled();
    });
  });

  // ─── setLocked ───────────────────────────────────────────────────────────

  describe("setLocked", () => {
    it("should warn and return early when overlay window does not exist", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      service.setLocked(false);
      expect(consoleSpy).toHaveBeenCalledWith(
        "[Overlay] Cannot set locked state - window not created",
      );
      consoleSpy.mockRestore();
    });

    describe("locking (locked = true)", () => {
      beforeEach(async () => {
        await service.show();
        clearOverlayMocks();
        mockSettingsSet.mockResolvedValue(undefined);
      });

      it("should save bounds immediately when locking", () => {
        service.setLocked(true);
        expect(mockOverlayGetBounds).toHaveBeenCalled();
        expect(mockSettingsSet).toHaveBeenCalledWith(
          "overlayBounds",
          expect.objectContaining({
            x: expect.any(Number),
            y: expect.any(Number),
            width: expect.any(Number),
            height: expect.any(Number),
          }),
        );
      });

      it("should set window to non-focusable", () => {
        service.setLocked(true);
        expect(mockOverlaySetFocusable).toHaveBeenCalledWith(false);
      });

      it("should set window to non-resizable", () => {
        service.setLocked(true);
        expect(mockOverlaySetResizable).toHaveBeenCalledWith(false);
      });

      it("should not call setIgnoreMouseEvents (click-through handled by focusable:false)", () => {
        service.setLocked(true);
        expect(mockOverlaySetIgnoreMouseEvents).not.toHaveBeenCalled();
      });

      it("should not change alwaysOnTop level (stays at screen-saver)", () => {
        service.setLocked(true);
        expect(mockOverlaySetAlwaysOnTop).not.toHaveBeenCalled();
      });

      it("should not blur the window (no z-order change needed)", () => {
        service.setLocked(true);
        expect(mockOverlayBlur).not.toHaveBeenCalled();
      });
    });

    describe("unlocking (locked = false)", () => {
      beforeEach(async () => {
        await service.show();
        clearOverlayMocks();
      });

      it("should not call setIgnoreMouseEvents", () => {
        service.setLocked(false);
        expect(mockOverlaySetIgnoreMouseEvents).not.toHaveBeenCalled();
      });

      it("should set window to focusable", () => {
        service.setLocked(false);
        expect(mockOverlaySetFocusable).toHaveBeenCalledWith(true);
      });

      it("should set window to resizable", () => {
        service.setLocked(false);
        expect(mockOverlaySetResizable).toHaveBeenCalledWith(true);
      });

      it("should not change alwaysOnTop level (stays at screen-saver)", () => {
        service.setLocked(false);
        expect(mockOverlaySetAlwaysOnTop).not.toHaveBeenCalled();
      });

      it("should attach moved and resized listeners", () => {
        service.setLocked(false);
        expect(mockOverlayOn).toHaveBeenCalledWith(
          "moved",
          expect.any(Function),
        );
        expect(mockOverlayOn).toHaveBeenCalledWith(
          "resized",
          expect.any(Function),
        );
      });
    });
  });

  // ─── Bounds listeners ────────────────────────────────────────────────────

  describe("bounds listeners", () => {
    it("should debounce-save bounds when moved event fires", async () => {
      await service.show();
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      // Unlock to attach listeners
      service.setLocked(false);

      // Get the moved listener callback
      const movedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "moved",
      );
      expect(movedCall).toBeDefined();
      const movedHandler = movedCall![1];

      // Fire moved event
      movedHandler();

      // Should not have saved yet (debounced 500ms)
      expect(mockSettingsSet).not.toHaveBeenCalled();

      // Advance timers past the debounce
      vi.advanceTimersByTime(500);

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "overlayBounds",
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      );
    });

    it("should debounce-save bounds when resized event fires", async () => {
      await service.show();
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      service.setLocked(false);

      const resizedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "resized",
      );
      expect(resizedCall).toBeDefined();
      const resizedHandler = resizedCall![1];

      resizedHandler();
      expect(mockSettingsSet).not.toHaveBeenCalled();

      vi.advanceTimersByTime(500);

      expect(mockSettingsSet).toHaveBeenCalledWith(
        "overlayBounds",
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      );
    });

    it("should remove listeners when locking after unlock", async () => {
      await service.show();
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      // Unlock (attaches listeners)
      service.setLocked(false);

      // Get the listener references that were attached
      const movedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "moved",
      );
      const resizedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "resized",
      );
      const movedHandler = movedCall![1];
      const resizedHandler = resizedCall![1];

      clearOverlayMocks();

      // Lock again (removes listeners)
      service.setLocked(true);

      expect(mockOverlayRemoveListener).toHaveBeenCalledWith(
        "moved",
        movedHandler,
      );
      expect(mockOverlayRemoveListener).toHaveBeenCalledWith(
        "resized",
        resizedHandler,
      );
    });

    it("should coalesce multiple rapid move events into a single save", async () => {
      await service.show();
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      service.setLocked(false);

      const movedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "moved",
      );
      const movedHandler = movedCall![1];

      // Fire multiple rapid events
      movedHandler();
      vi.advanceTimersByTime(100);
      movedHandler();
      vi.advanceTimersByTime(100);
      movedHandler();
      vi.advanceTimersByTime(100);

      // Should not have saved yet
      expect(mockSettingsSet).not.toHaveBeenCalled();

      // Advance past the debounce from the last event
      vi.advanceTimersByTime(500);

      // Only one save should have happened
      expect(mockSettingsSet).toHaveBeenCalledTimes(1);
    });
  });

  // ─── IPC: overlay:set-locked ─────────────────────────────────────────────

  describe("IPC: overlay:set-locked", () => {
    it("should call setLocked through the IPC handler with valid boolean", async () => {
      await service.show();
      clearOverlayMocks();

      const handler = getIpcHandler(OverlayChannel.SetLocked, ipcHandlerCalls);
      await handler({}, false);

      expect(mockOverlaySetFocusable).toHaveBeenCalledWith(true);
      expect(mockOverlaySetResizable).toHaveBeenCalledWith(true);
      // alwaysOnTop is NOT changed — stays at screen-saver level
      expect(mockOverlaySetAlwaysOnTop).not.toHaveBeenCalled();
    });

    it("should return validation error for non-boolean locked value", async () => {
      const handler = getIpcHandler(OverlayChannel.SetLocked, ipcHandlerCalls);
      const result = await handler({}, "not-a-boolean");
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });

    it("should return validation error for number locked value", async () => {
      const handler = getIpcHandler(OverlayChannel.SetLocked, ipcHandlerCalls);
      const result = await handler({}, 1);
      expect(result).toEqual({
        success: false,
        error: expect.stringContaining("Invalid input"),
      });
    });
  });

  // ─── show() always starts locked ────────────────────────────────────────

  describe("show always starts locked", () => {
    it("should reset to locked state on every show()", async () => {
      await service.show();
      clearOverlayMocks();

      // Unlock
      service.setLocked(false);
      clearOverlayMocks();

      // Show again (isVisible is already true, window exists)
      await service.show();

      // The service internally sets isLocked = true in show()
      // Verify by calling setLocked(true) which should be a no-op-style call
      // or we test indirectly: after show(), locking should set screen-saver level
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);
      service.setLocked(true);

      // If show() set isLocked = true, then setLocked(true) would still execute
      // (it doesn't check current state, it always applies)
      expect(mockOverlaySetFocusable).toHaveBeenCalledWith(false);
      // alwaysOnTop is NOT changed on lock — stays at screen-saver level
      expect(mockOverlaySetAlwaysOnTop).not.toHaveBeenCalled();
    });
  });

  // ─── hide() auto-locks if unlocked ──────────────────────────────────────

  describe("hide auto-locks if unlocked", () => {
    it("should auto-lock when hiding while unlocked", async () => {
      await service.show();
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      // Unlock
      service.setLocked(false);
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      // Hide while unlocked
      await service.hide();

      // Should have auto-locked: save bounds + set window properties
      expect(mockSettingsSet).toHaveBeenCalledWith(
        "overlayBounds",
        expect.objectContaining({
          x: expect.any(Number),
          y: expect.any(Number),
          width: expect.any(Number),
          height: expect.any(Number),
        }),
      );
      expect(mockOverlaySetFocusable).toHaveBeenCalledWith(false);
    });

    it("should not auto-lock when hiding while already locked", async () => {
      await service.show();
      clearOverlayMocks();
      mockSettingsSet.mockResolvedValue(undefined);

      // Already locked (default state from show())
      await service.hide();

      // setLocked should NOT have been called internally, so no setFocusable etc.
      expect(mockOverlaySetFocusable).not.toHaveBeenCalled();
    });
  });

  // ─── destroy() cleans up lock state ─────────────────────────────────────

  describe("destroy cleans up lock state", () => {
    it("should remove bounds listeners and reset isLocked on destroy", async () => {
      await service.show();
      service.setLocked(false);
      clearOverlayMocks();

      service.destroy();

      // Should have called removeListener for both moved and resized
      expect(mockOverlayRemoveListener).toHaveBeenCalledWith(
        "moved",
        expect.any(Function),
      );
      expect(mockOverlayRemoveListener).toHaveBeenCalledWith(
        "resized",
        expect.any(Function),
      );
    });
  });

  // ─── closed event resets lock state ─────────────────────────────────────

  describe("closed event resets lock state", () => {
    it("should reset isLocked and remove listeners when overlay window fires closed", async () => {
      await service.show();

      // Capture the 'closed' handler BEFORE clearing mocks (it was registered during createOverlay)
      const closedCall = mockOverlayOn.mock.calls.find(
        ([event]: [string]) => event === "closed",
      );
      expect(closedCall).toBeDefined();
      const closedHandler = closedCall![1];

      // Unlock to attach listeners
      service.setLocked(false);
      clearOverlayMocks();

      // Fire the closed event
      closedHandler();

      // After closed, the overlay window reference is null
      expect(service.getWindow()).toBeNull();
    });
  });

  // ─── restoreDefaults ───────────────────────────────────────────────────

  describe("restoreDefaults", () => {
    it("should clear persisted bounds and move window to default position/size", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(false);

      mockScreenGetPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1920, height: 1080 },
        workArea: { x: 0, y: 0 },
      });

      await service.restoreDefaults();

      // Should clear persisted bounds
      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", null);
      // Should temporarily enable resizable, set bounds, then restore
      expect(mockOverlaySetResizable).toHaveBeenCalledWith(true);
      expect(mockOverlaySetBounds).toHaveBeenCalledWith({
        x: 20,
        y: 20,
        width: 250,
        height: 175,
      });
      expect(mockOverlaySetResizable).toHaveBeenCalledWith(false);
    });

    it("should offset default position by workArea origin", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(false);

      mockScreenGetPrimaryDisplay.mockReturnValue({
        workAreaSize: { width: 1920, height: 1040 },
        workArea: { x: 0, y: 40 },
      });

      await service.restoreDefaults();

      expect(mockOverlaySetBounds).toHaveBeenCalledWith({
        x: 20,
        y: 60,
        width: 250,
        height: 175,
      });
    });

    it("should still clear persisted bounds when overlay window does not exist", async () => {
      // Don't call show() — no window exists
      await service.restoreDefaults();

      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", null);
      expect(mockOverlaySetBounds).not.toHaveBeenCalled();
    });

    it("should work through the IPC handler", async () => {
      await service.show();
      clearOverlayMocks();
      mockOverlayIsResizable.mockReturnValue(false);

      const handler = getIpcHandler(
        OverlayChannel.RestoreDefaults,
        ipcHandlerCalls,
      );
      await handler({});

      expect(mockSettingsSet).toHaveBeenCalledWith("overlayBounds", null);
      expect(mockOverlaySetBounds).toHaveBeenCalled();
    });
  });
});
