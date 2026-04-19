import { vi } from "vitest";

// ─── Types ───────────────────────────────────────────────────────────────────

type MockFn = ReturnType<typeof vi.fn>;

// ─── Electron ────────────────────────────────────────────────────────────────

export interface ElectronMockOverrides {
  /** ipcMain.handle — usually the most important mock to capture IPC registrations */
  mockIpcHandle?: MockFn;
  /** ipcMain.on */
  mockIpcOn?: MockFn;
  /** ipcMain.removeHandler */
  mockRemoveHandler?: MockFn;
  /** BrowserWindow.getAllWindows */
  mockGetAllWindows?: MockFn;
  /** BrowserWindow.getFocusedWindow */
  mockGetFocusedWindow?: MockFn;
  /** A pre-created mock for webContents.send on BrowserWindow instances */
  mockWebContentsSend?: MockFn;
  /** dialog.showMessageBox */
  mockShowMessageBox?: MockFn;
  /** dialog.showSaveDialog */
  mockShowSaveDialog?: MockFn;
  /** shell.openPath */
  mockShellOpenPath?: MockFn;
  /**
   * Override the entire `app` object.
   * When provided, this replaces the default app mock entirely.
   */
  mockApp?: Record<string, unknown>;
}

/**
 * Creates a mock `electron` module object.
 *
 * Use inside `vi.mock("electron", () => createElectronMock({ ... }))`.
 *
 * The returned shape matches the subset of Electron APIs used across all
 * main-process tests: `ipcMain`, `BrowserWindow`, `app`, `dialog`, `shell`.
 *
 * @example
 * ```ts
 * const { mockIpcHandle } = vi.hoisted(() => ({ mockIpcHandle: vi.fn() }));
 * vi.mock("electron", () => createElectronMock({ mockIpcHandle }));
 * ```
 */
export function createElectronMock(overrides: ElectronMockOverrides = {}) {
  const mockWebContentsSend = overrides.mockWebContentsSend ?? vi.fn();

  return {
    ipcMain: {
      handle: overrides.mockIpcHandle ?? vi.fn(),
      on: overrides.mockIpcOn ?? vi.fn(),
      removeHandler: overrides.mockRemoveHandler ?? vi.fn(),
    },
    BrowserWindow: {
      getAllWindows:
        overrides.mockGetAllWindows ??
        vi.fn(() => [
          {
            isDestroyed: (): boolean => false,
            webContents: { send: mockWebContentsSend },
          },
        ]),
      getFocusedWindow: overrides.mockGetFocusedWindow ?? vi.fn(() => null),
    },
    app: overrides.mockApp ?? {
      isPackaged: false,
      getAppPath: vi.fn(() => "/mock-app-path"),
      getPath: vi.fn(() => "/mock-path"),
    },
    dialog: {
      showMessageBox: overrides.mockShowMessageBox ?? vi.fn(),
      showSaveDialog: overrides.mockShowSaveDialog ?? vi.fn(),
    },
    shell: {
      openPath: overrides.mockShellOpenPath ?? vi.fn(),
    },
  };
}

// ─── DatabaseService ─────────────────────────────────────────────────────────

export interface DatabaseServiceMockOverrides {
  mockGetKysely?: MockFn;
  mockGetDb?: MockFn;
  mockReset?: MockFn;
}

/**
 * Creates a mock `~/main/modules/database` module object.
 *
 * @example
 * ```ts
 * const { mockGetKysely } = vi.hoisted(() => ({ mockGetKysely: vi.fn() }));
 * vi.mock("~/main/modules/database", () => createDatabaseServiceMock({ mockGetKysely }));
 * ```
 */
export function createDatabaseServiceMock(
  overrides: DatabaseServiceMockOverrides = {},
) {
  return {
    DatabaseService: {
      getInstance: vi.fn(() => ({
        getKysely: overrides.mockGetKysely ?? vi.fn(),
        getDb: overrides.mockGetDb ?? vi.fn(),
        reset: overrides.mockReset ?? vi.fn(),
      })),
    },
  };
}

// ─── PerformanceLoggerService ────────────────────────────────────────────────

export interface PerformanceLoggerMockOverrides {
  mockLog?: MockFn;
  mockStartTimer?: MockFn;
  mockStartTimers?: MockFn;
  mockTime?: MockFn;
}

/**
 * Creates a mock `~/main/modules/performance-logger` module object.
 *
 * @example
 * ```ts
 * vi.mock("~/main/modules/performance-logger", () => createPerformanceLoggerMock());
 * ```
 */
export function createPerformanceLoggerMock(
  overrides: PerformanceLoggerMockOverrides = {},
) {
  return {
    PerformanceLoggerService: {
      getInstance: vi.fn(() => ({
        log: overrides.mockLog ?? vi.fn(),
        startTimer: overrides.mockStartTimer ?? vi.fn(() => null),
        startTimers: overrides.mockStartTimers ?? vi.fn(() => null),
        time: overrides.mockTime ?? vi.fn(),
      })),
    },
  };
}

// ─── SettingsStoreService ────────────────────────────────────────────────────

export interface SettingsStoreMockOverrides {
  mockGet?: MockFn;
  mockSet?: MockFn;
  mockGetAllSettings?: MockFn;
  /**
   * Additional or override entries for the `SettingsKey` enum object.
   * Merged on top of the defaults.
   */
  settingsKeys?: Record<string, string>;
}

/**
 * Creates a mock `~/main/modules/settings-store` module object.
 *
 * Includes both the `SettingsStoreService` singleton and the `SettingsKey` enum
 * (plain object) that most tests also import.
 *
 * @example
 * ```ts
 * const { mockSettingsGet } = vi.hoisted(() => ({ mockSettingsGet: vi.fn() }));
 * vi.mock("~/main/modules/settings-store", () =>
 *   createSettingsStoreMock({ mockGet: mockSettingsGet }),
 * );
 * ```
 */
export function createSettingsStoreMock(
  overrides: SettingsStoreMockOverrides = {},
) {
  return {
    SettingsStoreService: {
      getInstance: vi.fn(() => ({
        get: overrides.mockGet ?? vi.fn(),
        set: overrides.mockSet ?? vi.fn(),
        getAllSettings: overrides.mockGetAllSettings ?? vi.fn(),
      })),
    },
    SettingsKey: {
      AppExitAction: "appExitAction",
      AppOpenAtLogin: "appOpenAtLogin",
      AppOpenAtLoginMinimized: "appOpenAtLoginMinimized",
      OnboardingDismissedBeacons: "onboardingDismissedBeacons",
      OverlayBounds: "overlayBounds",
      Poe1ClientTxtPath: "poe1ClientTxtPath",
      SelectedPoe1League: "poe1SelectedLeague",
      Poe1PriceSource: "poe1PriceSource",
      Poe2ClientTxtPath: "poe2ClientTxtPath",
      SelectedPoe2League: "poe2SelectedLeague",
      Poe2PriceSource: "poe2PriceSource",
      ActiveGame: "selectedGame",
      InstalledGames: "installedGames",
      SetupCompleted: "setupCompleted",
      SetupStep: "setupStep",
      SetupVersion: "setupVersion",
      AudioEnabled: "audioEnabled",
      AudioVolume: "audioVolume",
      AudioRarity1Path: "audioRarity1Path",
      AudioRarity2Path: "audioRarity2Path",
      AudioRarity3Path: "audioRarity3Path",
      RaritySource: "raritySource",
      SelectedFilterId: "selectedFilterId",
      LastSeenAppVersion: "lastSeenAppVersion",
      OverlayFontSize: "overlayFontSize",
      OverlayToolbarFontSize: "overlayToolbarFontSize",
      MainWindowBounds: "mainWindowBounds",
      TelemetryCrashReporting: "telemetryCrashReporting",
      TelemetryUsageAnalytics: "telemetryUsageAnalytics",
      CsvExportPath: "csvExportPath",
      CommunityUploadsEnabled: "communityUploadsEnabled",
      ...(overrides.settingsKeys ?? {}),
    },
  };
}

// ─── DataStoreService ────────────────────────────────────────────────────────

export interface DataStoreServiceMockOverrides {
  mockAddCard?: MockFn;
  mockGetAllTimeStats?: MockFn;
  mockGetLeagueStats?: MockFn;
  mockGetGlobalStats?: MockFn;
}

/**
 * Creates a mock `~/main/modules/data-store` module object.
 *
 * @example
 * ```ts
 * const { mockGetAllTimeStats } = vi.hoisted(() => ({ mockGetAllTimeStats: vi.fn() }));
 * vi.mock("~/main/modules/data-store", () =>
 *   createDataStoreServiceMock({ mockGetAllTimeStats }),
 * );
 * ```
 */
export function createDataStoreServiceMock(
  overrides: DataStoreServiceMockOverrides = {},
) {
  return {
    DataStoreService: {
      getInstance: vi.fn(() => ({
        addCard: overrides.mockAddCard ?? vi.fn(),
        getAllTimeStats: overrides.mockGetAllTimeStats ?? vi.fn(),
        getLeagueStats: overrides.mockGetLeagueStats ?? vi.fn(),
        getGlobalStats: overrides.mockGetGlobalStats ?? vi.fn(),
      })),
    },
  };
}

// ─── SnapshotService ─────────────────────────────────────────────────────────

export interface SnapshotServiceMockOverrides {
  mockGetSnapshotForSession?: MockFn;
  mockLoadSnapshot?: MockFn;
  mockStartAutoRefresh?: MockFn;
  mockStopAutoRefresh?: MockFn;
  mockStopAllAutoRefresh?: MockFn;
  mockEnsureLeague?: MockFn;
}

/**
 * Creates a mock `~/main/modules/snapshots` module object.
 *
 * @example
 * ```ts
 * vi.mock("~/main/modules/snapshots", () => createSnapshotServiceMock());
 * ```
 */
export function createSnapshotServiceMock(
  overrides: SnapshotServiceMockOverrides = {},
) {
  return {
    SnapshotService: {
      getInstance: vi.fn(() => ({
        getSnapshotForSession: overrides.mockGetSnapshotForSession ?? vi.fn(),
        loadSnapshot: overrides.mockLoadSnapshot ?? vi.fn(),
        startAutoRefresh: overrides.mockStartAutoRefresh ?? vi.fn(),
        stopAutoRefresh: overrides.mockStopAutoRefresh ?? vi.fn(),
        stopAllAutoRefresh: overrides.mockStopAllAutoRefresh ?? vi.fn(),
        ensureLeague: overrides.mockEnsureLeague ?? vi.fn(),
      })),
    },
  };
}

// ─── IPC Validation Utils ────────────────────────────────────────────────────

export interface IpcValidationMockOverrides {
  mockAssertTrustedSender?: MockFn;
  mockRegisterTrustedWebContents?: MockFn;
  mockAssertGameType?: MockFn;
  mockAssertString?: MockFn;
  mockAssertBoundedString?: MockFn;
  mockAssertBoolean?: MockFn;
  mockAssertNumber?: MockFn;
  mockAssertInteger?: MockFn;
  mockAssertEnum?: MockFn;
  mockAssertOptionalEnum?: MockFn;
  mockAssertOptionalString?: MockFn;
  mockAssertOptionalNumber?: MockFn;
  mockAssertOptionalInteger?: MockFn;
  mockAssertLimit?: MockFn;
  mockAssertPage?: MockFn;
  mockAssertPageSize?: MockFn;
  mockAssertPriceSource?: MockFn;
  mockAssertCardName?: MockFn;
  mockAssertSessionId?: MockFn;
  mockAssertLeagueId?: MockFn;
  mockAssertFilePath?: MockFn;
  mockAssertExitBehavior?: MockFn;
  mockAssertSetupStep?: MockFn;
  mockAssertInstalledGames?: MockFn;
  mockAssertArray?: MockFn;
  mockAssertStringArray?: MockFn;
  mockAssertEnumArray?: MockFn;
  mockHandleValidationError?: MockFn;
  /** A custom IpcValidationError class to include in the mock module */
  MockIpcValidationError?: new (
    channel: string,
    detail: string,
  ) => Error;
}

/**
 * Creates a mock `~/main/utils/ipc-validation` module object.
 *
 * Every validator defaults to a no-op `vi.fn()`. The `handleValidationError`
 * default returns the handler argument unchanged (matching the common
 * "pass-through" pattern used in tests).
 *
 * @example
 * ```ts
 * const { mockAssertGameType, mockHandleValidationError } = vi.hoisted(() => ({
 *   mockAssertGameType: vi.fn(),
 *   mockHandleValidationError: vi.fn(),
 * }));
 * vi.mock("~/main/utils/ipc-validation", () =>
 *   createIpcValidationMock({ mockAssertGameType, mockHandleValidationError }),
 * );
 * ```
 */
export function createIpcValidationMock(
  overrides: IpcValidationMockOverrides = {},
) {
  return {
    assertTrustedSender: overrides.mockAssertTrustedSender ?? vi.fn(),
    registerTrustedWebContents:
      overrides.mockRegisterTrustedWebContents ?? vi.fn(),
    assertGameType: overrides.mockAssertGameType ?? vi.fn(),
    assertString: overrides.mockAssertString ?? vi.fn(),
    assertBoundedString: overrides.mockAssertBoundedString ?? vi.fn(),
    assertBoolean: overrides.mockAssertBoolean ?? vi.fn(),
    assertNumber: overrides.mockAssertNumber ?? vi.fn(),
    assertInteger: overrides.mockAssertInteger ?? vi.fn(),
    assertEnum: overrides.mockAssertEnum ?? vi.fn(),
    assertOptionalEnum: overrides.mockAssertOptionalEnum ?? vi.fn(),
    assertOptionalString: overrides.mockAssertOptionalString ?? vi.fn(),
    assertOptionalNumber: overrides.mockAssertOptionalNumber ?? vi.fn(),
    assertOptionalInteger: overrides.mockAssertOptionalInteger ?? vi.fn(),
    assertLimit: overrides.mockAssertLimit ?? vi.fn(),
    assertPage: overrides.mockAssertPage ?? vi.fn(),
    assertPageSize: overrides.mockAssertPageSize ?? vi.fn(),
    assertPriceSource: overrides.mockAssertPriceSource ?? vi.fn(),
    assertCardName: overrides.mockAssertCardName ?? vi.fn(),
    assertSessionId: overrides.mockAssertSessionId ?? vi.fn(),
    assertLeagueId: overrides.mockAssertLeagueId ?? vi.fn(),
    assertFilePath: overrides.mockAssertFilePath ?? vi.fn(),
    assertExitBehavior: overrides.mockAssertExitBehavior ?? vi.fn(),
    assertSetupStep: overrides.mockAssertSetupStep ?? vi.fn(),
    assertInstalledGames: overrides.mockAssertInstalledGames ?? vi.fn(),
    assertArray: overrides.mockAssertArray ?? vi.fn(),
    assertStringArray: overrides.mockAssertStringArray ?? vi.fn(),
    assertEnumArray: overrides.mockAssertEnumArray ?? vi.fn(),
    handleValidationError: overrides.mockHandleValidationError ?? vi.fn(),
    IpcValidationError:
      overrides.MockIpcValidationError ??
      class MockIpcValidationError extends Error {
        detail: string;
        constructor(channel: string, detail: string) {
          super(`[IPC Validation] ${channel}: ${detail}`);
          this.name = "IpcValidationError";
          this.detail = detail;
        }
      },
    validateFileDialogOptions: vi.fn((raw: unknown) => raw),
  };
}

// ─── LoggerService ───────────────────────────────────────────────────────────

/**
 * Creates a mock `~/main/modules/logger` module object.
 *
 * Returns a `LoggerService.createLogger()` that produces a no-op logger
 * with `log`, `info`, `warn`, `error`, and `debug` stubs.
 *
 * @example
 * ```ts
 * vi.mock("~/main/modules/logger", () => createLoggerServiceMock());
 * ```
 */
export function createLoggerServiceMock() {
  return {
    LoggerService: {
      createLogger: vi.fn(() => ({
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
  };
}

// ─── SupabaseClientService ───────────────────────────────────────────────────

export interface SupabaseClientMockOverrides {
  mockIsConfigured?: MockFn;
  mockCallEdgeFunction?: MockFn;
  mockGetLatestSnapshot?: MockFn;
}

/**
 * Creates a mock `~/main/modules/supabase` module object.
 *
 * @example
 * ```ts
 * vi.mock("~/main/modules/supabase", () => createSupabaseClientMock());
 * ```
 */
// ─── GGG Auth Service Mock ───────────────────────────────────────────────────

interface GggAuthServiceMockOverrides {
  mockGetAccessToken?: MockFn;
  mockAuthenticate?: MockFn;
  mockHandleCallback?: MockFn;
  mockLogout?: MockFn;
}

/**
 * Creates a mock for `~/main/modules/ggg-auth`.
 *
 * Usage:
 * ```ts
 * const { mockGetAccessToken } = vi.hoisted(() => ({
 *   mockGetAccessToken: vi.fn(),
 * }));
 * vi.mock("~/main/modules/ggg-auth", () =>
 *   createGggAuthServiceMock({ mockGetAccessToken }),
 * );
 * ```
 */
export function createGggAuthServiceMock(
  overrides: GggAuthServiceMockOverrides = {},
): Record<string, unknown> {
  const {
    mockGetAccessToken = vi.fn().mockResolvedValue(null),
    mockAuthenticate = vi.fn(),
    mockHandleCallback = vi.fn(),
    mockLogout = vi.fn(),
  } = overrides;

  return {
    GggAuthService: {
      getInstance: vi.fn(() => ({
        getAccessToken: mockGetAccessToken,
        authenticate: mockAuthenticate,
        handleCallback: mockHandleCallback,
        logout: mockLogout,
      })),
    },
    GggAuthChannel: {
      GetAuthStatus: "ggg-auth:get-status",
      Authenticate: "ggg-auth:authenticate",
      Logout: "ggg-auth:logout",
    },
  };
}

// ─── Supabase Client Mock ────────────────────────────────────────────────────

export function createSupabaseClientMock(
  overrides: SupabaseClientMockOverrides = {},
) {
  return {
    SupabaseClientService: {
      getInstance: vi.fn(() => ({
        isConfigured: overrides.mockIsConfigured ?? vi.fn(),
        callEdgeFunction: overrides.mockCallEdgeFunction ?? vi.fn(),
        getLatestSnapshot: overrides.mockGetLatestSnapshot ?? vi.fn(),
      })),
    },
  };
}

// ─── IPC Handler Helper ──────────────────────────────────────────────────────

/**
 * Retrieves a registered IPC handler from a `mockIpcHandle` mock.
 *
 * This is the most commonly duplicated helper across IPC test files.
 * It inspects `mockIpcHandle.mock.calls` to find the handler registered
 * for the given channel and returns the callback function.
 *
 * @param mockIpcHandle - The `vi.fn()` used as `ipcMain.handle`.
 * @param channel       - The IPC channel name to look up.
 * @returns The handler function registered for that channel.
 * @throws If no handler was registered for the channel.
 *
 * @example
 * ```ts
 * const handler = getIpcHandler(mockIpcHandle, "analytics:get-most-common-cards");
 * const result = await handler({}, "poe1", "Settlers", 10);
 * ```
 */
export function getIpcHandler(
  mockIpcHandle: MockFn,
  channel: string,
): (...args: any[]) => any {
  const calls = mockIpcHandle.mock.calls as [string, (...args: any[]) => any][];
  const call = calls.find(([ch]) => ch === channel);
  if (!call) {
    const registered = calls.map(([ch]) => ch).join(", ");
    throw new Error(
      `ipcMain.handle was not called with "${channel}". Registered: ${registered}`,
    );
  }
  return call[1];
}

// ─── Barrel Mock ("~/main/modules") ──────────────────────────────────────────

/**
 * Default no-op service mock: `{ getInstance: vi.fn(() => ({})) }`.
 * Used for every Service export that the test doesn't care about.
 */
function stubService() {
  return { getInstance: vi.fn(() => ({})) };
}

/**
 * Creates a complete mock for the `~/main/modules` barrel export.
 *
 * Every Service is stubbed with `{ getInstance: vi.fn(() => ({})) }` by
 * default, every Channel enum gets its real string values, and `SettingsKey`
 * mirrors the real enum. Tests supply **only** the overrides they care about.
 *
 * Adding a new module to the app? Add one line here — zero changes in test
 * files.
 *
 * @example
 * ```ts
 * // Minimal — everything is a no-op stub:
 * vi.mock("~/main/modules", () => createBarrelMock());
 *
 * // With overrides for the things you actually test:
 * const { mockSettingsGet } = vi.hoisted(() => ({ mockSettingsGet: vi.fn() }));
 * vi.mock("~/main/modules", () =>
 *   createBarrelMock({
 *     SettingsStoreService: {
 *       getInstance: vi.fn(() => ({ get: mockSettingsGet })),
 *     },
 *   }),
 * );
 * ```
 */
export function createBarrelMock(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  const defaults: Record<string, unknown> = {
    // ── Services ───────────────────────────────────────────────────────
    AnalyticsService: stubService(),
    AppService: stubService(),
    AppSetupService: stubService(),
    BannersService: stubService(),
    CardDetailsService: stubService(),
    ClientLogReaderService: stubService(),
    CommunityUploadService: {
      getInstance: vi.fn(() => ({
        backfillIfNeeded: vi.fn().mockResolvedValue(undefined),
        getBackfillLeagues: vi.fn().mockResolvedValue([]),
      })),
    },
    CsvService: stubService(),
    GggAuthService: {
      getInstance: vi.fn(() => ({
        getAccessToken: vi.fn().mockResolvedValue(null),
        handleCallback: vi.fn(),
        authenticate: vi.fn(),
        logout: vi.fn(),
      })),
    },
    CurrentSessionService: stubService(),
    DatabaseService: stubService(),
    DataStoreService: stubService(),
    DiagLogService: stubService(),
    DivinationCardsService: stubService(),
    LoggerService: {
      createLogger: vi.fn(() => ({
        log: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
      })),
    },
    MainWindowService: stubService(),
    OverlayService: stubService(),
    PerformanceLoggerService: {
      getInstance: vi.fn(() => ({
        log: vi.fn(),
        startTimer: vi.fn(() => null),
        startTimers: vi.fn(() => null),
        time: vi.fn(),
      })),
    },
    PoeLeaguesService: stubService(),
    PoeProcessService: stubService(),
    ProfitForecastService: stubService(),
    RarityInsightsService: stubService(),
    SentryService: stubService(),
    SessionsService: stubService(),
    SettingsStoreService: {
      getInstance: vi.fn(() => ({
        get: vi.fn(),
        set: vi.fn(),
        getAllSettings: vi.fn(),
      })),
    },
    SnapshotService: stubService(),
    StorageService: stubService(),
    SupabaseClientService: {
      getInstance: vi.fn(() => ({
        isConfigured: vi.fn(),
        configure: vi.fn(),
        callEdgeFunction: vi.fn(),
        getLatestSnapshot: vi.fn(),
      })),
    },
    TrayService: stubService(),
    UpdaterService: stubService(),

    // ── Channel enums ──────────────────────────────────────────────────
    // Only channels that tests reference as values (not just types) need
    // to appear here. Add more as needed.
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
    PoeProcessChannel: {
      Start: "poe-process:start",
      Stop: "poe-process:stop",
      IsRunning: "poe-process:is-running",
      GetState: "poe-process:get-state",
      GetError: "poe-process:get-error",
    },

    // ── SettingsKey (mirrors real values) ──────────────────────────────
    SettingsKey: {
      AppExitAction: "appExitAction",
      AppOpenAtLogin: "appOpenAtLogin",
      AppOpenAtLoginMinimized: "appOpenAtLoginMinimized",
      OnboardingDismissedBeacons: "onboardingDismissedBeacons",
      OverlayBounds: "overlayBounds",
      Poe1ClientTxtPath: "poe1ClientTxtPath",
      SelectedPoe1League: "poe1SelectedLeague",
      Poe1PriceSource: "poe1PriceSource",
      Poe2ClientTxtPath: "poe2ClientTxtPath",
      SelectedPoe2League: "poe2SelectedLeague",
      Poe2PriceSource: "poe2PriceSource",
      ActiveGame: "selectedGame",
      InstalledGames: "installedGames",
      SetupCompleted: "setupCompleted",
      SetupStep: "setupStep",
      SetupVersion: "setupVersion",
      AudioEnabled: "audioEnabled",
      AudioVolume: "audioVolume",
      AudioRarity1Path: "audioRarity1Path",
      AudioRarity2Path: "audioRarity2Path",
      AudioRarity3Path: "audioRarity3Path",
      RaritySource: "raritySource",
      SelectedFilterId: "selectedFilterId",
      LastSeenAppVersion: "lastSeenAppVersion",
      OverlayFontSize: "overlayFontSize",
      OverlayToolbarFontSize: "overlayToolbarFontSize",
      MainWindowBounds: "mainWindowBounds",
      TelemetryCrashReporting: "telemetryCrashReporting",
      TelemetryUsageAnalytics: "telemetryUsageAnalytics",
      CsvExportPath: "csvExportPath",
      CommunityUploadsEnabled: "communityUploadsEnabled",
    },
  };

  return { ...defaults, ...overrides };
}
