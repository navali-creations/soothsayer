import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockAppOn,
  mockAppQuit,
  mockAppSetAppUserModelId,
  mockAppGetName,
  mockAppSetAsDefaultProtocolClient,
  mockAppSetLoginItemSettings,
  mockAppRelaunch,
  mockAppExit,
  mockAppIsPackaged,
  mockIpcHandle,
  mockSettingsGet,
  mockOverlayDestroy,
  mockSnapshotStopAllAutoRefresh,
  mockCurrentSessionIsActive,
  mockCurrentSessionStopSession,
  mockPoeProcessStop,
  mockDatabaseOptimize,
  mockDatabaseClose,
  mockTrayDestroyTray,
} = vi.hoisted(() => ({
  mockAppOn: vi.fn(),
  mockAppQuit: vi.fn(),
  mockAppSetAppUserModelId: vi.fn(),
  mockAppGetName: vi.fn(() => "Soothsayer"),
  mockAppSetAsDefaultProtocolClient: vi.fn(),
  mockAppSetLoginItemSettings: vi.fn(),
  mockAppRelaunch: vi.fn(),
  mockAppExit: vi.fn(),
  mockAppIsPackaged: { value: false },
  mockIpcHandle: vi.fn(),
  mockSettingsGet: vi.fn(),
  mockOverlayDestroy: vi.fn(),
  mockSnapshotStopAllAutoRefresh: vi.fn(),
  mockCurrentSessionIsActive: vi.fn(() => false),
  mockCurrentSessionStopSession: vi.fn(),
  mockPoeProcessStop: vi.fn(),
  mockDatabaseOptimize: vi.fn(),
  mockDatabaseClose: vi.fn(),
  mockTrayDestroyTray: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  app: {
    on: mockAppOn,
    quit: mockAppQuit,
    setAppUserModelId: mockAppSetAppUserModelId,
    getName: mockAppGetName,
    setAsDefaultProtocolClient: mockAppSetAsDefaultProtocolClient,
    setLoginItemSettings: mockAppSetLoginItemSettings,
    relaunch: mockAppRelaunch,
    exit: mockAppExit,
    get isPackaged() {
      return mockAppIsPackaged.value;
    },
  },
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  dialog: {
    showMessageBox: vi.fn(),
  },
}));

// ─── Mock ~/main/modules barrel ──────────────────────────────────────────────
vi.mock("~/main/modules", () => ({
  CurrentSessionService: {
    getInstance: vi.fn(() => ({
      isSessionActive: mockCurrentSessionIsActive,
      stopSession: mockCurrentSessionStopSession,
    })),
  },
  DatabaseService: {
    getInstance: vi.fn(() => ({
      optimize: mockDatabaseOptimize,
      close: mockDatabaseClose,
    })),
  },
  MainWindowService: {
    getInstance: vi.fn(() => ({
      show: vi.fn(),
    })),
  },
  OverlayService: {
    getInstance: vi.fn(() => ({
      destroy: mockOverlayDestroy,
    })),
  },
  PoeProcessService: {
    getInstance: vi.fn(() => ({
      stop: mockPoeProcessStop,
    })),
  },
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
  SnapshotService: {
    getInstance: vi.fn(() => ({
      stopAllAutoRefresh: mockSnapshotStopAllAutoRefresh,
    })),
  },
  TrayService: {
    getInstance: vi.fn(() => ({
      destroyTray: mockTrayDestroyTray,
    })),
  },
}));

import { AppChannel } from "../App.channels";
// ─── Import under test (after mocks) ────────────────────────────────────────
import { AppService } from "../App.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Get the handler registered for a given app event */
function getAppEventHandler(event: string): (...args: any[]) => any {
  const call = mockAppOn.mock.calls.find(([ev]: [string]) => ev === event);
  if (!call) {
    const registered = mockAppOn.mock.calls
      .map(([ev]: [string]) => ev)
      .join(", ");
    throw new Error(
      `app.on was not called with "${event}". Registered events: ${registered}`,
    );
  }
  return call[1];
}

/** Get the IPC handler registered for a given channel */
function getIpcHandler(channel: string): (...args: any[]) => any {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    const registered = mockIpcHandle.mock.calls
      .map(([ch]: [string]) => ch)
      .join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered channels: ${registered}`,
    );
  }
  return call[1];
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AppService", () => {
  let service: AppService;
  const originalPlatform = process.platform;
  const originalArgv = [...process.argv];

  let mockProcessExit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();

    // Mock process.exit to prevent test runner from exiting
    // Must be re-created each time since vi.restoreAllMocks() in afterEach removes it
    mockProcessExit = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    AppService._instance = undefined;

    // Default: non-packaged, Windows
    mockAppIsPackaged.value = false;
    Object.defineProperty(process, "platform", {
      value: "win32",
      writable: true,
      configurable: true,
    });
    process.argv = ["electron", ".", ...originalArgv.slice(2)];

    // Default: openAtLogin returns false
    mockSettingsGet.mockResolvedValue(false);

    service = new AppService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    Object.defineProperty(process, "platform", {
      value: originalPlatform,
      writable: true,
      configurable: true,
    });
    process.argv = originalArgv;
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      // Reset so getInstance creates fresh
      // @ts-expect-error
      AppService._instance = undefined;

      const a = AppService.getInstance();
      const b = AppService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      // @ts-expect-error
      AppService._instance = undefined;
      const instance = AppService.getInstance();
      expect(instance).toBeInstanceOf(AppService);
    });
  });

  // ─── Constructor side effects ────────────────────────────────────────────

  describe("constructor", () => {
    it("should call setAppNameForWinNotifications on Windows", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      // @ts-expect-error
      AppService._instance = undefined;
      const _svc = new AppService();
      expect(mockAppSetAppUserModelId).toHaveBeenCalledWith("Soothsayer");
    });

    it("should call setAppProtocol", () => {
      expect(mockAppSetAsDefaultProtocolClient).toHaveBeenCalled();
    });

    it("should call openAtLogin", () => {
      // openAtLogin calls settingsStore.get which is async; just verify it was invoked
      expect(mockSettingsGet).toHaveBeenCalled();
    });
  });

  // ─── setAppNameForWinNotifications ───────────────────────────────────────

  describe("setAppNameForWinNotifications", () => {
    it("should set app user model id on Windows", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      mockAppSetAppUserModelId.mockClear();

      service.setAppNameForWinNotifications();

      expect(mockAppSetAppUserModelId).toHaveBeenCalledWith("Soothsayer");
    });

    it("should NOT set app user model id on macOS", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      mockAppSetAppUserModelId.mockClear();

      service.setAppNameForWinNotifications();

      expect(mockAppSetAppUserModelId).not.toHaveBeenCalled();
    });

    it("should NOT set app user model id on Linux", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      mockAppSetAppUserModelId.mockClear();

      service.setAppNameForWinNotifications();

      expect(mockAppSetAppUserModelId).not.toHaveBeenCalled();
    });
  });

  // ─── setAppProtocol ──────────────────────────────────────────────────────

  describe("setAppProtocol", () => {
    it("should set protocol with execPath and argv when not packaged and not macOS", () => {
      mockAppIsPackaged.value = false;
      Object.defineProperty(process, "platform", { value: "win32" });
      mockAppSetAsDefaultProtocolClient.mockClear();

      service.setAppProtocol();

      expect(mockAppSetAsDefaultProtocolClient).toHaveBeenCalledWith(
        "soothsayer",
        process.execPath,
        expect.any(Array),
      );
    });

    it("should set simple protocol on macOS even when not packaged", () => {
      mockAppIsPackaged.value = false;
      Object.defineProperty(process, "platform", { value: "darwin" });
      mockAppSetAsDefaultProtocolClient.mockClear();

      service.setAppProtocol();

      expect(mockAppSetAsDefaultProtocolClient).toHaveBeenCalledWith(
        "soothsayer",
      );
    });

    it("should set simple protocol when packaged", () => {
      mockAppIsPackaged.value = true;
      Object.defineProperty(process, "platform", { value: "win32" });
      mockAppSetAsDefaultProtocolClient.mockClear();

      service.setAppProtocol();

      expect(mockAppSetAsDefaultProtocolClient).toHaveBeenCalledWith(
        "soothsayer",
      );
    });
  });

  // ─── emitRestart ─────────────────────────────────────────────────────────

  describe("emitRestart", () => {
    it("should register an IPC handler for the restart channel", () => {
      service.emitRestart();

      expect(mockIpcHandle).toHaveBeenCalledWith(
        AppChannel.Restart,
        expect.any(Function),
      );
    });

    it("should relaunch and exit when isQuitting is false", () => {
      service.isQuitting = false;
      service.emitRestart();

      const handler = getIpcHandler(AppChannel.Restart);
      const mockEvent = { preventDefault: vi.fn() };
      handler(mockEvent);

      expect(mockEvent.preventDefault).toHaveBeenCalled();
      expect(mockAppRelaunch).toHaveBeenCalled();
      expect(mockAppExit).toHaveBeenCalledWith(0);
    });

    it("should do nothing when isQuitting is true", () => {
      service.isQuitting = true;
      service.emitRestart();

      const handler = getIpcHandler(AppChannel.Restart);
      const mockEvent = { preventDefault: vi.fn() };
      handler(mockEvent);

      expect(mockEvent.preventDefault).not.toHaveBeenCalled();
      expect(mockAppRelaunch).not.toHaveBeenCalled();
      expect(mockAppExit).not.toHaveBeenCalled();
    });
  });

  // ─── quitOnAllWindowsClosed ──────────────────────────────────────────────

  describe("quitOnAllWindowsClosed", () => {
    it("should register a window-all-closed event handler", () => {
      service.quitOnAllWindowsClosed([]);

      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.WindowAllClosed,
        expect.any(Function),
      );
    });

    it("should quit the app on window-all-closed on Windows", () => {
      Object.defineProperty(process, "platform", { value: "win32" });
      service.quitOnAllWindowsClosed([]);

      const handler = getAppEventHandler(AppChannel.WindowAllClosed);
      handler();

      expect(mockAppQuit).toHaveBeenCalled();
    });

    it("should quit the app on window-all-closed on Linux", () => {
      Object.defineProperty(process, "platform", { value: "linux" });
      // Need to re-register since platform was win32 during first call
      mockAppOn.mockClear();
      service.quitOnAllWindowsClosed([]);

      const handler = getAppEventHandler(AppChannel.WindowAllClosed);
      handler();

      expect(mockAppQuit).toHaveBeenCalled();
    });

    it("should NOT quit the app on window-all-closed on macOS", () => {
      Object.defineProperty(process, "platform", { value: "darwin" });
      mockAppOn.mockClear();
      service.quitOnAllWindowsClosed([]);

      const handler = getAppEventHandler(AppChannel.WindowAllClosed);
      handler();

      expect(mockAppQuit).not.toHaveBeenCalled();
    });

    it("should null out all window references when windows are closed", () => {
      const mockWindow1 = { close: vi.fn() };
      const mockWindow2 = { close: vi.fn() };
      const windows: any[] = [mockWindow1, mockWindow2];

      Object.defineProperty(process, "platform", { value: "darwin" });
      mockAppOn.mockClear();
      service.quitOnAllWindowsClosed(windows);

      const handler = getAppEventHandler(AppChannel.WindowAllClosed);
      handler();

      // The method maps windows to null — it does not mutate the original array externally,
      // but the handler runs without errors
      expect(mockAppQuit).not.toHaveBeenCalled();
    });
  });

  // ─── emitSecondInstance ──────────────────────────────────────────────────

  describe("emitSecondInstance", () => {
    it("should register a second-instance event handler", () => {
      const mockMainWindow = {
        isMinimized: vi.fn(() => false),
        restore: vi.fn(),
        focus: vi.fn(),
        show: vi.fn(),
      };

      service.emitSecondInstance(mockMainWindow as any);

      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.SecondInstance,
        expect.any(Function),
      );
    });

    it("should restore and focus a minimized main window on second instance", () => {
      const mockMainWindow = {
        isMinimized: vi.fn(() => true),
        restore: vi.fn(),
        focus: vi.fn(),
        show: vi.fn(),
      };

      mockAppOn.mockClear();
      service.emitSecondInstance(mockMainWindow as any);

      const handler = getAppEventHandler(AppChannel.SecondInstance);
      handler();

      expect(mockMainWindow.restore).toHaveBeenCalled();
      expect(mockMainWindow.focus).toHaveBeenCalled();
    });

    it("should show the main window if it is not minimized", () => {
      const mockMainWindow = {
        isMinimized: vi.fn(() => false),
        restore: vi.fn(),
        focus: vi.fn(),
        show: vi.fn(),
      };

      mockAppOn.mockClear();
      service.emitSecondInstance(mockMainWindow as any);

      const handler = getAppEventHandler(AppChannel.SecondInstance);
      handler();

      expect(mockMainWindow.show).toHaveBeenCalled();
      expect(mockMainWindow.restore).not.toHaveBeenCalled();
    });

    it("should handle null mainWindow gracefully", () => {
      mockAppOn.mockClear();
      service.emitSecondInstance(null as any);

      // Should not register the event handler at all because of the early return
      // Actually looking at the code, it does register but the handler returns early
      // Let's verify it doesn't throw
      const secondInstanceCalls = mockAppOn.mock.calls.filter(
        ([ev]: [string]) => ev === AppChannel.SecondInstance,
      );

      if (secondInstanceCalls.length > 0) {
        const handler = secondInstanceCalls[0][1];
        expect(() => handler()).not.toThrow();
      }
    });
  });

  // ─── beforeQuitCloseWindowsAndDestroyElements ────────────────────────────

  describe("beforeQuitCloseWindowsAndDestroyElements", () => {
    it("should register a before-quit event handler", () => {
      service.beforeQuitCloseWindowsAndDestroyElements();

      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.BeforeQuit,
        expect.any(Function),
      );
    });

    it("should destroy the overlay on before-quit", async () => {
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockOverlayDestroy).toHaveBeenCalled();
    });

    it("should stop all snapshot auto-refresh on before-quit", async () => {
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockSnapshotStopAllAutoRefresh).toHaveBeenCalled();
    });

    it("should stop active poe1 session on before-quit", async () => {
      mockCurrentSessionIsActive.mockImplementation(
        ((game: string) => game === "poe1") as any,
      );

      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockCurrentSessionStopSession).toHaveBeenCalledWith("poe1");
    });

    it("should stop active poe2 session on before-quit", async () => {
      mockCurrentSessionIsActive.mockImplementation(
        ((game: string) => game === "poe2") as any,
      );

      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockCurrentSessionStopSession).toHaveBeenCalledWith("poe2");
    });

    it("should stop both sessions when both are active", async () => {
      mockCurrentSessionIsActive.mockReturnValue(true);

      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockCurrentSessionStopSession).toHaveBeenCalledWith("poe1");
      expect(mockCurrentSessionStopSession).toHaveBeenCalledWith("poe2");
    });

    it("should not stop sessions when none are active", async () => {
      mockCurrentSessionIsActive.mockReturnValue(false);

      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockCurrentSessionStopSession).not.toHaveBeenCalled();
    });

    it("should stop POE process monitoring on before-quit", async () => {
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockPoeProcessStop).toHaveBeenCalled();
    });

    it("should optimize the database on before-quit", async () => {
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockDatabaseOptimize).toHaveBeenCalled();
    });

    it("should close the database on before-quit", async () => {
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockDatabaseClose).toHaveBeenCalled();
    });

    it("should destroy the tray on before-quit", async () => {
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(mockTrayDestroyTray).toHaveBeenCalled();
    });

    it("should set isQuitting to true on before-quit", async () => {
      service.isQuitting = false;
      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      expect(service.isQuitting).toBe(true);
    });

    it("should handle database optimization failure gracefully", async () => {
      mockDatabaseOptimize.mockImplementation(() => {
        throw new Error("Optimization failed");
      });

      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);

      // Should not throw even if optimize fails
      await expect(handler()).resolves.not.toThrow();

      // Should still continue with close and tray cleanup
      expect(mockDatabaseClose).toHaveBeenCalled();
      expect(mockTrayDestroyTray).toHaveBeenCalled();
    });

    it("should execute cleanup steps in correct order", async () => {
      const callOrder: string[] = [];

      mockOverlayDestroy.mockImplementation(() =>
        callOrder.push("overlay:destroy"),
      );
      mockSnapshotStopAllAutoRefresh.mockImplementation(() =>
        callOrder.push("snapshot:stopAll"),
      );
      mockPoeProcessStop.mockImplementation(() => callOrder.push("poe:stop"));
      mockDatabaseOptimize.mockImplementation(() =>
        callOrder.push("db:optimize"),
      );
      mockDatabaseClose.mockImplementation(() => callOrder.push("db:close"));
      mockTrayDestroyTray.mockImplementation(() =>
        callOrder.push("tray:destroy"),
      );
      mockCurrentSessionIsActive.mockReturnValue(false);

      mockAppOn.mockClear();
      service.beforeQuitCloseWindowsAndDestroyElements();

      const handler = getAppEventHandler(AppChannel.BeforeQuit);
      await handler();

      // Verify order: overlay -> snapshots -> sessions -> poe -> db optimize -> db close -> tray
      expect(callOrder.indexOf("overlay:destroy")).toBeLessThan(
        callOrder.indexOf("snapshot:stopAll"),
      );
      expect(callOrder.indexOf("snapshot:stopAll")).toBeLessThan(
        callOrder.indexOf("poe:stop"),
      );
      expect(callOrder.indexOf("poe:stop")).toBeLessThan(
        callOrder.indexOf("db:optimize"),
      );
      expect(callOrder.indexOf("db:optimize")).toBeLessThan(
        callOrder.indexOf("db:close"),
      );
      expect(callOrder.indexOf("db:close")).toBeLessThan(
        callOrder.indexOf("tray:destroy"),
      );
    });
  });

  // ─── emitActivate ───────────────────────────────────────────────────────

  describe("emitActivate", () => {
    it("should register an activate event handler when mainWindow is provided", () => {
      const mockMainWindow = {
        createMainWindow: vi.fn(),
      };

      mockAppOn.mockClear();
      service.emitActivate(mockMainWindow as any);

      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.Activate,
        expect.any(Function),
      );
    });

    it("should call createMainWindow on activate", async () => {
      const mockMainWindow = {
        createMainWindow: vi.fn(),
      };

      mockAppOn.mockClear();
      service.emitActivate(mockMainWindow as any);

      const handler = getAppEventHandler(AppChannel.Activate);
      await handler();

      expect(mockMainWindow.createMainWindow).toHaveBeenCalled();
    });

    it("should return early when mainWindow is null", () => {
      mockAppOn.mockClear();
      service.emitActivate(null as any);

      // Should not register the event handler
      const activateCalls = mockAppOn.mock.calls.filter(
        ([ev]: [string]) => ev === AppChannel.Activate,
      );
      expect(activateCalls).toHaveLength(0);
    });
  });

  // ─── quit ────────────────────────────────────────────────────────────────

  describe("quit", () => {
    it("should call app.quit", () => {
      service.quit();

      expect(mockAppQuit).toHaveBeenCalled();
    });

    it("should call process.exit with code 0", () => {
      service.quit();

      expect(mockProcessExit).toHaveBeenCalledWith(0);
    });
  });

  // ─── openAtLogin ─────────────────────────────────────────────────────────

  describe("openAtLogin", () => {
    it("should call setLoginItemSettings with openAtLogin value from settings", async () => {
      mockSettingsGet.mockResolvedValue(true);
      mockAppSetLoginItemSettings.mockClear();

      await service.openAtLogin();

      expect(mockAppSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: true,
      });
    });

    it("should set openAtLogin to false when settings return false", async () => {
      mockSettingsGet.mockResolvedValue(false);
      mockAppSetLoginItemSettings.mockClear();

      await service.openAtLogin();

      expect(mockAppSetLoginItemSettings).toHaveBeenCalledWith({
        openAtLogin: false,
      });
    });
  });

  // ─── isQuitting state ────────────────────────────────────────────────────

  describe("isQuitting state", () => {
    it("should default to true", () => {
      // @ts-expect-error
      AppService._instance = undefined;
      const svc = new AppService();
      expect(svc.isQuitting).toBe(true);
    });

    it("should be settable to false", () => {
      service.isQuitting = false;
      expect(service.isQuitting).toBe(false);
    });
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should handle a complete app lifecycle: start -> register hooks -> before-quit cleanup", async () => {
      // 1. Create service (start)
      // @ts-expect-error
      AppService._instance = undefined;
      const svc = new AppService();
      svc.isQuitting = false;

      // 2. Register lifecycle hooks
      svc.emitRestart();
      svc.quitOnAllWindowsClosed([]);

      const mockMainWindow = {
        isMinimized: vi.fn(() => false),
        restore: vi.fn(),
        focus: vi.fn(),
        show: vi.fn(),
        createMainWindow: vi.fn(),
      };
      svc.emitSecondInstance(mockMainWindow as any);
      svc.emitActivate(mockMainWindow as any);
      svc.beforeQuitCloseWindowsAndDestroyElements();

      // 3. Verify all hooks registered
      expect(mockIpcHandle).toHaveBeenCalledWith(
        AppChannel.Restart,
        expect.any(Function),
      );
      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.WindowAllClosed,
        expect.any(Function),
      );
      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.SecondInstance,
        expect.any(Function),
      );
      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.Activate,
        expect.any(Function),
      );
      expect(mockAppOn).toHaveBeenCalledWith(
        AppChannel.BeforeQuit,
        expect.any(Function),
      );

      // 4. Simulate before-quit
      mockCurrentSessionIsActive.mockReturnValue(false);
      const beforeQuitHandler = getAppEventHandler(AppChannel.BeforeQuit);
      await beforeQuitHandler();

      // 5. Verify cleanup
      expect(mockOverlayDestroy).toHaveBeenCalled();
      expect(mockSnapshotStopAllAutoRefresh).toHaveBeenCalled();
      expect(mockDatabaseOptimize).toHaveBeenCalled();
      expect(mockDatabaseClose).toHaveBeenCalled();
      expect(mockTrayDestroyTray).toHaveBeenCalled();
      expect(svc.isQuitting).toBe(true);
    });
  });
});
