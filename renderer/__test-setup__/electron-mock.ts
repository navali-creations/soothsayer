import { vi } from "vitest";

// ─── Helper: creates an event listener mock that returns an unsubscribe fn ───

function mockListener() {
  return vi.fn().mockReturnValue(vi.fn());
}

// ─── window.electron mock factory ──────────────────────────────────────────
//
// Every invoke-style method is a vi.fn() that resolves to undefined by default.
// Every event-listener method (on*) returns a cleanup/unsubscribe function.
//
// Tests can override return values per-test:
//   mock.appSetup.getSetupState.mockResolvedValue({ ... });
//

export function createElectronMock() {
  return {
    selectFile: vi.fn().mockResolvedValue(undefined),

    // ── App ────────────────────────────────────────────────────────────
    app: {
      restart: vi.fn().mockResolvedValue(undefined),
      quit: vi.fn().mockResolvedValue(undefined),
      minimizeToTray: vi.fn().mockResolvedValue(undefined),
      getVersion: vi.fn().mockResolvedValue("0.0.0-test"),
    },

    // ── App Setup (wizard) ─────────────────────────────────────────────
    appSetup: {
      getSetupState: vi.fn().mockResolvedValue(null),
      isSetupComplete: vi.fn().mockResolvedValue(false),
      advanceStep: vi.fn().mockResolvedValue({ success: true }),
      goToStep: vi.fn().mockResolvedValue({ success: true }),
      validateCurrentStep: vi
        .fn()
        .mockResolvedValue({ isValid: true, errors: [] }),
      completeSetup: vi.fn().mockResolvedValue({ success: true }),
      resetSetup: vi.fn().mockResolvedValue(undefined),
      skipSetup: vi.fn().mockResolvedValue(undefined),
    },

    // ── Settings Store ─────────────────────────────────────────────────
    settings: {
      getAll: vi.fn().mockResolvedValue({}),
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      getPoe1ClientPath: vi.fn().mockResolvedValue(null),
      setPoe1ClientPath: vi.fn().mockResolvedValue(undefined),
      getPoe2ClientPath: vi.fn().mockResolvedValue(null),
      setPoe2ClientPath: vi.fn().mockResolvedValue(undefined),
      getAppExitBehavior: vi.fn().mockResolvedValue("exit"),
      setAppExitBehavior: vi.fn().mockResolvedValue(undefined),
      getLaunchOnStartup: vi.fn().mockResolvedValue(false),
      setLaunchOnStartup: vi.fn().mockResolvedValue(undefined),
      getStartMinimized: vi.fn().mockResolvedValue(false),
      setStartMinimized: vi.fn().mockResolvedValue(undefined),
      getActiveGame: vi.fn().mockResolvedValue("poe1"),
      setActiveGame: vi.fn().mockResolvedValue(undefined),
      getInstalledGames: vi.fn().mockResolvedValue(["poe1"]),
      setInstalledGames: vi.fn().mockResolvedValue(undefined),
      getSelectedPoe1League: vi.fn().mockResolvedValue(""),
      setSelectedPoe1League: vi.fn().mockResolvedValue(undefined),
      getSelectedPoe2League: vi.fn().mockResolvedValue(""),
      setSelectedPoe2League: vi.fn().mockResolvedValue(undefined),
      getSelectedPoe1PriceSource: vi.fn().mockResolvedValue("exchange"),
      setSelectedPoe1PriceSource: vi.fn().mockResolvedValue(undefined),
      getSelectedPoe2PriceSource: vi.fn().mockResolvedValue("exchange"),
      setSelectedPoe2PriceSource: vi.fn().mockResolvedValue(undefined),
      scanCustomSounds: vi.fn().mockResolvedValue([]),
      getCustomSoundData: vi.fn().mockResolvedValue(null),
      openCustomSoundsFolder: vi
        .fn()
        .mockResolvedValue({ success: true, path: "" }),
      resetDatabase: vi.fn().mockResolvedValue({ success: true }),
    },

    // ── Current Session ────────────────────────────────────────────────
    session: {
      start: vi.fn().mockResolvedValue({ success: true }),
      stop: vi.fn().mockResolvedValue({ success: true }),
      isActive: vi.fn().mockResolvedValue(false),
      getCurrent: vi.fn().mockResolvedValue(null),
      getInfo: vi.fn().mockResolvedValue(null),
      onStateChanged: mockListener(),
      onDataUpdated: mockListener(),
      onTimelineDelta: mockListener(),
      onCardDelta: mockListener(),
      getTimeline: vi.fn().mockResolvedValue(null),
      updateCardPriceVisibility: vi.fn().mockResolvedValue({ success: true }),
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
    },

    // ── Sessions (history) ─────────────────────────────────────────────
    sessions: {
      getAll: vi.fn().mockResolvedValue({
        sessions: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      }),
      getById: vi.fn().mockResolvedValue(null),
      searchByCard: vi.fn().mockResolvedValue({
        sessions: [],
        total: 0,
        page: 1,
        pageSize: 10,
        totalPages: 0,
      }),
      getMostProfitable: vi.fn().mockResolvedValue(null),
      getLongestSession: vi.fn().mockResolvedValue(null),
      getMostDecksOpened: vi.fn().mockResolvedValue(null),
      getBiggestLetdown: vi.fn().mockResolvedValue(null),
      getTotalDecksOpened: vi.fn().mockResolvedValue(0),
      getLuckyBreak: vi.fn().mockResolvedValue(null),
      getSessionAverages: vi.fn().mockResolvedValue(null),
      getTotalNetProfit: vi.fn().mockResolvedValue(null),
      getTotalTimeSpent: vi.fn().mockResolvedValue(null),
      getWinRate: vi.fn().mockResolvedValue(null),
      getStackedDeckCardCount: vi.fn().mockResolvedValue(0),
      getStackedDeckCardNames: vi.fn().mockResolvedValue([]),
      getUncollectedCardNames: vi.fn().mockResolvedValue([]),
      getChartData: vi.fn().mockResolvedValue([]),
      getSparklines: vi.fn().mockResolvedValue({}),
    },

    // ── Snapshots (poe.ninja prices) ───────────────────────────────────
    snapshots: {
      getLatestSnapshot: vi.fn().mockResolvedValue(null),
      refreshPrices: vi.fn().mockResolvedValue({
        snapshotId: "",
        fetchedAt: "",
        refreshableAt: "",
      }),
      getRefreshStatus: vi.fn().mockResolvedValue({
        fetchedAt: null,
        refreshableAt: null,
      }),
      onSnapshotCreated: mockListener(),
      onSnapshotReused: mockListener(),
      onAutoRefreshStarted: mockListener(),
      onAutoRefreshStopped: mockListener(),
    },

    // ── Main Window ────────────────────────────────────────────────────
    mainWindow: {
      minimize: vi.fn().mockResolvedValue(undefined),
      maximize: vi.fn().mockResolvedValue(undefined),
      unmaximize: vi.fn().mockResolvedValue(undefined),
      isMaximized: vi.fn().mockResolvedValue(false),
      close: vi.fn().mockResolvedValue(undefined),
    },

    // ── Overlay ────────────────────────────────────────────────────────
    overlay: {
      show: vi.fn().mockResolvedValue(undefined),
      hide: vi.fn().mockResolvedValue(undefined),
      toggle: vi.fn().mockResolvedValue(undefined),
      isVisible: vi.fn().mockResolvedValue(false),
      setLocked: vi.fn().mockResolvedValue(undefined),
      setPosition: vi.fn().mockResolvedValue(undefined),
      setSize: vi.fn().mockResolvedValue(undefined),
      getBounds: vi.fn().mockResolvedValue(null),
      restoreDefaults: vi.fn().mockResolvedValue(undefined),
      getSessionData: vi.fn().mockResolvedValue(null),
      onVisibilityChanged: mockListener(),
      onSettingsChanged: mockListener(),
    },

    // ── PoE Leagues ────────────────────────────────────────────────────
    poeLeagues: {
      fetchLeagues: vi.fn().mockResolvedValue([]),
      getSelected: vi.fn().mockResolvedValue(null),
      setSelected: vi.fn().mockResolvedValue(undefined),
    },

    // ── PoE Process ────────────────────────────────────────────────────
    poeProcess: {
      getState: vi.fn().mockResolvedValue(null),
      onStart: mockListener(),
      onStop: mockListener(),
      onState: mockListener(),
      onError: mockListener(),
    },

    // ── Data Store ─────────────────────────────────────────────────────
    dataStore: {
      getAllTime: vi.fn().mockResolvedValue(null),
      getLeague: vi.fn().mockResolvedValue(null),
      getLeagues: vi.fn().mockResolvedValue([]),
      getGlobal: vi.fn().mockResolvedValue(null),
    },

    // ── Divination Cards ───────────────────────────────────────────────
    divinationCards: {
      getAll: vi.fn().mockResolvedValue([]),
      getById: vi.fn().mockResolvedValue(null),
      getByName: vi.fn().mockResolvedValue(null),
      searchByName: vi.fn().mockResolvedValue({ results: [], total: 0 }),
      getCount: vi.fn().mockResolvedValue(0),
      getStats: vi.fn().mockResolvedValue(null),
      forceSync: vi.fn().mockResolvedValue({ success: true }),
      updateRarity: vi.fn().mockResolvedValue({ success: true }),
    },

    // ── Analytics ──────────────────────────────────────────────────────
    analytics: {
      getMostCommonCards: vi.fn().mockResolvedValue([]),
      getHighestValueCards: vi.fn().mockResolvedValue([]),
      getCardPriceHistory: vi.fn().mockResolvedValue(null),
      getLeagueAnalytics: vi.fn().mockResolvedValue(null),
      compareSessions: vi.fn().mockResolvedValue(null),
      getOccurrenceRatios: vi.fn().mockResolvedValue(null),
    },

    // ── Diag Log ───────────────────────────────────────────────────────
    diagLog: {
      revealLogFile: vi.fn().mockResolvedValue({ success: true, path: "" }),
    },

    // ── CSV Export ─────────────────────────────────────────────────────
    csv: {
      exportAll: vi.fn().mockResolvedValue({ success: true }),
      exportIncremental: vi.fn().mockResolvedValue({ success: true }),
      exportSession: vi.fn().mockResolvedValue({ success: true }),
      getSnapshotMeta: vi.fn().mockResolvedValue({
        exists: false,
        exportedAt: null,
        totalCount: 0,
        newCardCount: 0,
        newTotalDrops: 0,
      }),
    },

    // ── Updater ────────────────────────────────────────────────────────
    updater: {
      checkForUpdates: vi.fn().mockResolvedValue(null),
      getUpdateInfo: vi.fn().mockResolvedValue(null),
      downloadUpdate: vi.fn().mockResolvedValue({ success: true }),
      installUpdate: vi.fn().mockResolvedValue({ success: true }),
      getLatestRelease: vi.fn().mockResolvedValue(null),
      getChangelog: vi.fn().mockResolvedValue({ success: true, releases: [] }),
      onUpdateAvailable: mockListener(),
      onDownloadProgress: mockListener(),
    },

    // ── Rarity Insights ────────────────────────────────────────────────
    rarityInsights: {
      scan: vi
        .fn()
        .mockResolvedValue({ filters: [], totalFilters: 0, errors: [] }),
      getAll: vi.fn().mockResolvedValue([]),
      get: vi.fn().mockResolvedValue(null),
      parse: vi.fn().mockResolvedValue({ cards: [], totalCards: 0 }),
      select: vi.fn().mockResolvedValue(undefined),
      getSelected: vi.fn().mockResolvedValue(null),
      getRaritySource: vi.fn().mockResolvedValue("poe.ninja"),
      setRaritySource: vi.fn().mockResolvedValue(undefined),
      updateCardRarity: vi.fn().mockResolvedValue({ success: true }),
      applyRarities: vi
        .fn()
        .mockResolvedValue({ success: true, totalCards: 0, filterName: "" }),
      onFilterRaritiesApplied: mockListener(),
    },

    // ── Prohibited Library ─────────────────────────────────────────────
    prohibitedLibrary: {
      reload: vi
        .fn()
        .mockResolvedValue({ success: true, totalCards: 0, game: "poe1" }),
      getStatus: vi.fn().mockResolvedValue(null),
      getCardWeights: vi.fn().mockResolvedValue([]),
      getFromBossCards: vi.fn().mockResolvedValue([]),
      onDataRefreshed: mockListener(),
      onLoadError: mockListener(),
    },

    // ── Profit Forecast ────────────────────────────────────────────────
    profitForecast: {
      getData: vi.fn().mockResolvedValue({
        rows: [],
        totalWeight: 0,
        evPerDeck: 0,
        snapshotFetchedAt: null,
        chaosToDivineRatio: 0,
        stackedDeckChaosCost: 0,
        baseRate: 0,
        baseRateSource: "none",
      }),
      compute: vi.fn().mockResolvedValue({
        rowFields: {},
        totalCost: 0,
        pnlCurve: [],
        confidenceInterval: { estimated: 0, optimistic: 0 },
        batchPnL: {
          revenue: 0,
          cost: 0,
          netPnL: 0,
          confidence: { estimated: 0, optimistic: 0 },
        },
      }),
    },

    // ── Storage ────────────────────────────────────────────────────────
    storage: {
      getInfo: vi.fn().mockResolvedValue(null),
      getLeagueUsage: vi.fn().mockResolvedValue([]),
      deleteLeagueData: vi.fn().mockResolvedValue({ success: true }),
      checkDiskSpace: vi
        .fn()
        .mockResolvedValue({ isDiskLow: false, freeBytes: 0, totalBytes: 0 }),
      revealPaths: vi.fn().mockResolvedValue({ appDataPath: "" }),
    },

    // ── Card Details ───────────────────────────────────────────────────
    cardDetails: {
      getPriceHistory: vi.fn().mockResolvedValue(null),
      getPersonalAnalytics: vi.fn().mockResolvedValue(null),
      getRelatedCards: vi
        .fn()
        .mockResolvedValue({ relatedCards: [], total: 0 }),
      resolveCardBySlug: vi.fn().mockResolvedValue(null),
      openCardInMainWindow: vi.fn().mockResolvedValue(undefined),
      onNavigateToCard: mockListener(),
    },
  };
}

// ─── Type helper ───────────────────────────────────────────────────────────

export type ElectronMock = ReturnType<typeof createElectronMock>;

// ─── Install / reset helpers ───────────────────────────────────────────────

/**
 * Install a fresh `window.electron` mock and return it for assertions.
 * Call this in `beforeEach` to get a clean mock per test.
 */
export function installElectronMock(): ElectronMock {
  const mock = createElectronMock();
  (window as any).electron = mock;
  return mock;
}

/**
 * Remove `window.electron` — useful in `afterEach` cleanup.
 */
export function removeElectronMock(): void {
  delete (window as any).electron;
}
