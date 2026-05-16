import { describe, expect, it, vi } from "vitest";

import {
  createBarrelMock,
  createDatabaseServiceMock,
  createDataStoreServiceMock,
  createElectronMock,
  createGggAuthServiceMock,
  createIpcValidationMock,
  createLoggerServiceMock,
  createPerformanceLoggerMock,
  createSettingsStoreMock,
  createSnapshotServiceMock,
  createSupabaseClientMock,
  getIpcHandler,
} from "./mock-factories";

describe("mock factories", () => {
  it("creates electron mocks with defaults and overrides", () => {
    const mockIpcHandle = vi.fn();
    const mockWebContentsSend = vi.fn();
    const mockApp = { isPackaged: true };
    const electron = createElectronMock({
      mockIpcHandle,
      mockWebContentsSend,
      mockApp,
    }) as any;

    expect(electron.ipcMain.handle).toBe(mockIpcHandle);
    expect(electron.app).toBe(mockApp);
    expect(electron.BrowserWindow.getFocusedWindow()).toBeNull();
    expect(electron.BrowserWindow.getAllWindows()[0].webContents.send).toBe(
      mockWebContentsSend,
    );
    expect(electron.dialog.showMessageBox).toBeTypeOf("function");
    expect(electron.shell.openPath).toBeTypeOf("function");

    const defaultElectron = createElectronMock() as any;
    expect(defaultElectron.BrowserWindow.getAllWindows()[0].isDestroyed()).toBe(
      false,
    );
    expect(defaultElectron.app.getAppPath()).toBe("/mock-app-path");
    expect(defaultElectron.app.getPath()).toBe("/mock-path");
  });

  it("creates service singleton mocks with supplied methods", async () => {
    const mockGetKysely = vi.fn(() => "kysely");
    const mockLog = vi.fn();
    const mockGet = vi.fn(() => "setting");
    const mockAddCard = vi.fn();
    const mockLoadSnapshot = vi.fn();
    const mockCallEdgeFunction = vi.fn().mockResolvedValue({ ok: true });
    const mockAuthenticate = vi.fn();

    expect(
      (
        createDatabaseServiceMock({
          mockGetKysely,
        }) as any
      ).DatabaseService.getInstance().getKysely(),
    ).toBe("kysely");
    expect(
      (
        createPerformanceLoggerMock() as any
      ).PerformanceLoggerService.getInstance().startTimer(),
    ).toBeNull();
    expect(
      (
        createPerformanceLoggerMock() as any
      ).PerformanceLoggerService.getInstance().startTimers(),
    ).toBeNull();
    (
      createPerformanceLoggerMock({
        mockLog,
      }) as any
    ).PerformanceLoggerService.getInstance().log("event");
    expect(mockLog).toHaveBeenCalledWith("event");
    expect(
      (
        createSettingsStoreMock({
          mockGet,
          settingsKeys: { CustomKey: "customKey" },
        }) as any
      ).SettingsStoreService.getInstance().get("customKey"),
    ).toBe("setting");
    expect(
      (
        createSettingsStoreMock({
          settingsKeys: { CustomKey: "customKey" },
        }) as any
      ).SettingsKey.CustomKey,
    ).toBe("customKey");
    (
      createDataStoreServiceMock({
        mockAddCard,
      }) as any
    ).DataStoreService.getInstance().addCard("card");
    (
      createSnapshotServiceMock({
        mockLoadSnapshot,
      }) as any
    ).SnapshotService.getInstance().loadSnapshot("league");
    await (
      createSupabaseClientMock({
        mockCallEdgeFunction,
      }) as any
    ).SupabaseClientService.getInstance().callEdgeFunction("fn");
    (
      createGggAuthServiceMock({
        mockAuthenticate,
      }) as any
    ).GggAuthService.getInstance().authenticate();

    expect(mockAddCard).toHaveBeenCalledWith("card");
    expect(mockLoadSnapshot).toHaveBeenCalledWith("league");
    expect(mockCallEdgeFunction).toHaveBeenCalledWith("fn");
    expect(mockAuthenticate).toHaveBeenCalledTimes(1);
  });

  it("creates IPC validation mocks and exposes the fallback error class", () => {
    const validation = createIpcValidationMock() as any;
    const handler = vi.fn();
    const wrapped = validation.handleValidationError(handler);
    const error = new validation.IpcValidationError("channel", "bad input");

    validation.assertString("value");

    expect(validation.assertString).toHaveBeenCalledWith("value");
    expect(
      validation.validateFileDialogOptions({ title: "Pick file" }),
    ).toEqual({
      title: "Pick file",
    });
    expect(wrapped).toBeUndefined();
    expect(error.name).toBe("IpcValidationError");
    expect(error.detail).toBe("bad input");
  });

  it("creates logger and barrel mocks for common module imports", async () => {
    const logger = (
      createLoggerServiceMock() as any
    ).LoggerService.createLogger();
    logger.info("hello");
    logger.debug("debug");

    const customSettings = { getInstance: vi.fn(() => ({ get: vi.fn() })) };
    const barrel = createBarrelMock({
      SettingsStoreService: customSettings,
    }) as Record<string, any>;

    expect(barrel.SettingsStoreService).toBe(customSettings);
    expect(barrel.MainWindowChannel.Close).toBe("main-window:close");
    expect(barrel.SettingsKey.AppPerformanceRetention).toBe(
      "appPerformanceRetention",
    );
    expect(barrel.AnalyticsService.getInstance()).toEqual({});
    await expect(
      barrel.CommunityUploadService.getInstance().getBackfillLeagues(),
    ).resolves.toEqual([]);
    await expect(
      barrel.GggAuthService.getInstance().getAccessToken(),
    ).resolves.toBe(null);
    expect(barrel.LoggerService.createLogger().warn).toBeTypeOf("function");
    expect(
      barrel.PerformanceLoggerService.getInstance().startTimer(),
    ).toBeNull();
    expect(barrel.SupabaseClientService.getInstance().configure).toBeTypeOf(
      "function",
    );

    const defaultBarrel = createBarrelMock() as Record<string, any>;
    expect(
      defaultBarrel.PerformanceLoggerService.getInstance().startTimers(),
    ).toBeNull();
    expect(defaultBarrel.SettingsStoreService.getInstance().get).toBeTypeOf(
      "function",
    );
  });

  it("returns IPC handlers and reports registered channels on misses", () => {
    const handler = vi.fn();
    const mockIpcHandle = vi.fn();
    (mockIpcHandle as any)("settings:get", handler);

    expect(getIpcHandler(mockIpcHandle, "settings:get")).toBe(handler);
    expect(() => getIpcHandler(mockIpcHandle, "settings:set")).toThrow(
      'ipcMain.handle was not called with "settings:set". Registered: settings:get',
    );
  });
});
