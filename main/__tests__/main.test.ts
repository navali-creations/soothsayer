import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockSquirrelStartup,
  mockSentryInitialize,
  mockSentryGetInstance,
  mockAppGetInstance,
  mockAppQuit,
  mockAppEmitSecondInstance,
  mockAppEmitRestart,
  mockAppEmitActivate,
  mockAppQuitOnAllWindowsClosed,
  mockAppBeforeQuitCloseWindowsAndDestroyElements,
  mockAppIsQuitting,
  mockMainWindowGetInstance,
  mockMainWindowCreateMainWindow,
  mockOverlayGetInstance,
  mockAppSetupGetInstance,
  mockRarityModelServiceGetInstance,
  mockSupabaseGetInstance,
  mockSupabaseConfigure,
  mockRequestSingleInstanceLock,
  mockWhenReady,
  mockIsPackaged,
  mockInstallExtension,
  mockREDUX_DEVTOOLS,
} = vi.hoisted(() => ({
  mockSquirrelStartup: { value: false },
  mockSentryInitialize: vi.fn(),
  mockSentryGetInstance: vi.fn(),
  mockAppGetInstance: vi.fn(),
  mockAppQuit: vi.fn(),
  mockAppEmitSecondInstance: vi.fn(),
  mockAppEmitRestart: vi.fn(),
  mockAppEmitActivate: vi.fn(),
  mockAppQuitOnAllWindowsClosed: vi.fn(),
  mockAppBeforeQuitCloseWindowsAndDestroyElements: vi.fn(),
  mockAppIsQuitting: { value: true },
  mockMainWindowGetInstance: vi.fn(),
  mockMainWindowCreateMainWindow: vi.fn(),
  mockOverlayGetInstance: vi.fn(),
  mockAppSetupGetInstance: vi.fn(),
  mockRarityModelServiceGetInstance: vi.fn(),
  mockSupabaseGetInstance: vi.fn(),
  mockSupabaseConfigure: vi.fn(),
  mockRequestSingleInstanceLock: vi.fn(() => true),
  mockWhenReady: vi.fn(() => Promise.resolve()),
  mockIsPackaged: { value: false },
  mockInstallExtension: vi.fn(() =>
    Promise.resolve({ name: "Redux DevTools" }),
  ),
  mockREDUX_DEVTOOLS: "REDUX_DEVTOOLS_ID",
}));

// ─── Hoisted env vars holder ─────────────────────────────────────────────────
const mockEnv = vi.hoisted(() => ({
  VITE_SUPABASE_URL: "https://test.supabase.co",
  VITE_SUPABASE_ANON_KEY: "test-anon-key",
  SENTRY_DSN: "https://sentry.example.com/123",
}));

// ─── Mock electron-squirrel-startup ──────────────────────────────────────────
vi.mock("electron-squirrel-startup", () => ({
  default: mockSquirrelStartup.value,
}));

// ─── Mock SentryService (must be first — imported at top of main.ts) ────────
vi.mock("~/main/modules/sentry", () => {
  const sentryInstance = {
    initialize: mockSentryInitialize,
  };
  mockSentryGetInstance.mockReturnValue(sentryInstance);
  return {
    SentryService: {
      getInstance: mockSentryGetInstance,
    },
  };
});

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  app: {
    requestSingleInstanceLock: mockRequestSingleInstanceLock,
    whenReady: mockWhenReady,
    get isPackaged() {
      return mockIsPackaged.value;
    },
  },
}));

// ─── Mock electron-devtools-installer ────────────────────────────────────────
vi.mock("electron-devtools-installer", () => ({
  installExtension: mockInstallExtension,
  REDUX_DEVTOOLS: mockREDUX_DEVTOOLS,
}));

// ─── Mock ~/main/modules barrel ──────────────────────────────────────────────
vi.mock("~/main/modules", () => {
  const mockMainWindowInstance = {
    createMainWindow: mockMainWindowCreateMainWindow,
  };
  mockMainWindowGetInstance.mockReturnValue(mockMainWindowInstance);

  const mockOverlayInstance = {};
  mockOverlayGetInstance.mockReturnValue(mockOverlayInstance);

  const mockAppSetupInstance = {};
  mockAppSetupGetInstance.mockReturnValue(mockAppSetupInstance);

  const mockRarityModelServiceInstance = {};
  mockRarityModelServiceGetInstance.mockReturnValue(
    mockRarityModelServiceInstance,
  );

  const mockSupabaseInstance = {
    configure: mockSupabaseConfigure,
  };
  mockSupabaseGetInstance.mockReturnValue(mockSupabaseInstance);

  const mockAppInstance = {
    quit: mockAppQuit,
    emitSecondInstance: mockAppEmitSecondInstance,
    emitRestart: mockAppEmitRestart,
    emitActivate: mockAppEmitActivate,
    quitOnAllWindowsClosed: mockAppQuitOnAllWindowsClosed,
    beforeQuitCloseWindowsAndDestroyElements:
      mockAppBeforeQuitCloseWindowsAndDestroyElements,
    get isQuitting() {
      return mockAppIsQuitting.value;
    },
  };
  mockAppGetInstance.mockReturnValue(mockAppInstance);

  return {
    AppService: { getInstance: mockAppGetInstance },
    MainWindowService: { getInstance: mockMainWindowGetInstance },
    OverlayService: { getInstance: mockOverlayGetInstance },
    AppSetupService: { getInstance: mockAppSetupGetInstance },
    RarityModelService: { getInstance: mockRarityModelServiceGetInstance },
    SupabaseClientService: { getInstance: mockSupabaseGetInstance },
  };
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Dynamically import main.ts. Because main.ts executes code at module-level,
 * we need to re-import it fresh for each test (after resetting module registry).
 */
async function importMain() {
  await import("../main");
}

/**
 * Captures and invokes the `whenReady().then(...)` callback so we can test
 * what happens inside it.
 */
function setupWhenReadyCapture(): { invoke: () => Promise<void> } {
  let thenCallback: (() => Promise<void>) | undefined;
  const thenablePromise = {
    // biome-ignore lint/suspicious/noThenProperty: intentionally creating a thenable to mock app.whenReady()
    then: vi.fn((cb: () => Promise<void>) => {
      thenCallback = cb;
      return thenablePromise; // allow chaining
    }),
  };
  mockWhenReady.mockReturnValue(thenablePromise as any);

  return {
    async invoke() {
      if (!thenCallback) {
        throw new Error("whenReady().then() was not called");
      }
      await thenCallback();
    },
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

// Mutable reference to import.meta.env for test mutations
const env = import.meta.env as unknown as Record<string, string | undefined>;

describe("main.ts", () => {
  const originalEnv = { ...import.meta.env };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset module registry so main.ts can be re-imported fresh
    vi.resetModules();

    // Default env with Supabase credentials present
    env.VITE_SUPABASE_URL = mockEnv.VITE_SUPABASE_URL;
    env.VITE_SUPABASE_ANON_KEY = mockEnv.VITE_SUPABASE_ANON_KEY;

    // Default: single instance lock acquired, not packaged
    mockRequestSingleInstanceLock.mockReturnValue(true);
    mockIsPackaged.value = false;

    // Default: createMainWindow resolves
    mockMainWindowCreateMainWindow.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore env
    env.VITE_SUPABASE_URL = originalEnv.VITE_SUPABASE_URL;
    env.VITE_SUPABASE_ANON_KEY = originalEnv.VITE_SUPABASE_ANON_KEY;
  });

  // ─── Sentry Initialization ──────────────────────────────────────────────

  describe("Sentry initialization", () => {
    it("should get the SentryService singleton and call initialize at module load", async () => {
      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(mockSentryGetInstance).toHaveBeenCalledTimes(1);
      expect(mockSentryInitialize).toHaveBeenCalledTimes(1);
    });

    it("should initialize Sentry before obtaining other service instances", async () => {
      const callOrder: string[] = [];
      mockSentryGetInstance.mockImplementation(() => {
        callOrder.push("sentry");
        return { initialize: mockSentryInitialize };
      });
      mockAppGetInstance.mockImplementation(() => {
        callOrder.push("app");
        return {
          quit: mockAppQuit,
          emitSecondInstance: mockAppEmitSecondInstance,
          emitRestart: mockAppEmitRestart,
          emitActivate: mockAppEmitActivate,
          quitOnAllWindowsClosed: mockAppQuitOnAllWindowsClosed,
          beforeQuitCloseWindowsAndDestroyElements:
            mockAppBeforeQuitCloseWindowsAndDestroyElements,
          get isQuitting() {
            return mockAppIsQuitting.value;
          },
        };
      });

      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(callOrder[0]).toBe("sentry");
    });
  });

  // ─── Service Instantiation ──────────────────────────────────────────────

  describe("service instantiation", () => {
    it("should get singleton instances of all required services", async () => {
      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(mockAppGetInstance).toHaveBeenCalled();
      expect(mockMainWindowGetInstance).toHaveBeenCalled();
      expect(mockOverlayGetInstance).toHaveBeenCalled();
      expect(mockAppSetupGetInstance).toHaveBeenCalled();
      expect(mockSupabaseGetInstance).toHaveBeenCalled();
    });
  });

  // ─── Single Instance Lock ──────────────────────────────────────────────

  describe("single instance lock", () => {
    it("should request a single instance lock", async () => {
      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(mockRequestSingleInstanceLock).toHaveBeenCalledTimes(1);
    });

    it("should quit the app when the single instance lock is NOT acquired", async () => {
      mockRequestSingleInstanceLock.mockReturnValue(false);

      await importMain();

      expect(mockAppQuit).toHaveBeenCalledTimes(1);
      // Should NOT call whenReady since we're quitting
      expect(mockWhenReady).not.toHaveBeenCalled();
    });

    it("should NOT quit when the single instance lock IS acquired", async () => {
      mockRequestSingleInstanceLock.mockReturnValue(true);
      const _capture = setupWhenReadyCapture();

      await importMain();

      expect(mockAppQuit).not.toHaveBeenCalled();
    });

    it("should register whenReady handler when lock is acquired", async () => {
      mockRequestSingleInstanceLock.mockReturnValue(true);
      const _capture = setupWhenReadyCapture();

      await importMain();

      expect(mockWhenReady).toHaveBeenCalledTimes(1);
    });
  });

  // ─── initializeSupabase ─────────────────────────────────────────────────

  describe("initializeSupabase", () => {
    it("should configure Supabase when both env vars are present", async () => {
      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockSupabaseConfigure).toHaveBeenCalledTimes(1);
      expect(mockSupabaseConfigure).toHaveBeenCalledWith(
        mockEnv.VITE_SUPABASE_URL,
        mockEnv.VITE_SUPABASE_ANON_KEY,
      );
    });

    it("should NOT configure Supabase when VITE_SUPABASE_URL is missing", async () => {
      env.VITE_SUPABASE_URL = "";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockSupabaseConfigure).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Supabase credentials not found"),
      );
    });

    it("should NOT configure Supabase when VITE_SUPABASE_ANON_KEY is missing", async () => {
      env.VITE_SUPABASE_ANON_KEY = "";

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockSupabaseConfigure).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Supabase credentials not found"),
      );
    });

    it("should NOT configure Supabase when both env vars are missing", async () => {
      env.VITE_SUPABASE_URL = "";
      env.VITE_SUPABASE_ANON_KEY = "";

      const _consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockSupabaseConfigure).not.toHaveBeenCalled();
    });

    it("should NOT configure Supabase when env vars are deleted", async () => {
      delete env.VITE_SUPABASE_URL;
      delete env.VITE_SUPABASE_ANON_KEY;

      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockSupabaseConfigure).not.toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Supabase credentials not found"),
      );
    });

    it("should log a message when configuring Supabase from env vars", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          "Configuring Supabase from environment variables",
        ),
      );
    });
  });

  // ─── whenReady Lifecycle ────────────────────────────────────────────────

  describe("whenReady lifecycle", () => {
    it("should create the main window after whenReady resolves", async () => {
      const capture = setupWhenReadyCapture();
      await importMain();

      // Before invoking whenReady callback, window should not be created
      expect(mockMainWindowCreateMainWindow).not.toHaveBeenCalled();

      await capture.invoke();

      expect(mockMainWindowCreateMainWindow).toHaveBeenCalledTimes(1);
    });

    it("should call createMainWindow without arguments", async () => {
      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockMainWindowCreateMainWindow).toHaveBeenCalledWith();
    });

    it("should call emitSecondInstance with mainWindow after window creation", async () => {
      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockAppEmitSecondInstance).toHaveBeenCalledTimes(1);
      // It receives the mainWindow service instance
      expect(mockAppEmitSecondInstance).toHaveBeenCalledWith(
        mockMainWindowGetInstance(),
      );
    });

    it("should call emitRestart after window creation", async () => {
      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockAppEmitRestart).toHaveBeenCalledTimes(1);
    });

    it("should initialize Supabase before creating the main window", async () => {
      const callOrder: string[] = [];
      mockSupabaseConfigure.mockImplementation(() => {
        callOrder.push("supabase");
      });
      mockMainWindowCreateMainWindow.mockImplementation(async () => {
        callOrder.push("createMainWindow");
      });

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(callOrder).toEqual(["supabase", "createMainWindow"]);
    });

    it("should call emitSecondInstance and emitRestart after createMainWindow resolves", async () => {
      const callOrder: string[] = [];
      mockMainWindowCreateMainWindow.mockImplementation(async () => {
        callOrder.push("createMainWindow");
      });
      mockAppEmitSecondInstance.mockImplementation(() => {
        callOrder.push("emitSecondInstance");
      });
      mockAppEmitRestart.mockImplementation(() => {
        callOrder.push("emitRestart");
      });

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(callOrder).toEqual([
        "createMainWindow",
        "emitSecondInstance",
        "emitRestart",
      ]);
    });
  });

  // ─── DevTools Installation (Development Mode) ──────────────────────────

  describe("DevTools installation", () => {
    it("should install Redux DevTools extension when app is NOT packaged", async () => {
      mockIsPackaged.value = false;

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockInstallExtension).toHaveBeenCalledTimes(1);
      expect(mockInstallExtension).toHaveBeenCalledWith(mockREDUX_DEVTOOLS);
    });

    it("should NOT install DevTools extension when app IS packaged", async () => {
      mockIsPackaged.value = true;

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      expect(mockInstallExtension).not.toHaveBeenCalled();
    });

    it("should log the extension name on successful install", async () => {
      mockIsPackaged.value = false;
      mockInstallExtension.mockResolvedValue({ name: "Redux DevTools" });

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      // Wait for the installExtension promise to settle
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("Added Extension"),
        );
      });
    });

    it("should log an error if DevTools installation fails", async () => {
      mockIsPackaged.value = false;
      const testError = new Error("DevTools install failed");
      mockInstallExtension.mockRejectedValue(testError);

      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      // Wait for the installExtension promise rejection to be handled
      await vi.waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("An error occurred"),
          expect.any(Error),
        );
      });
    });

    it("should not block main window creation if DevTools install fails", async () => {
      mockIsPackaged.value = false;
      mockInstallExtension.mockRejectedValue(new Error("install error"));

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      // createMainWindow should still be called regardless of devtools failure
      expect(mockMainWindowCreateMainWindow).toHaveBeenCalledTimes(1);
    });
  });

  // ─── App Event Wiring (always runs) ────────────────────────────────────

  describe("app event wiring (always executed)", () => {
    it("should call emitActivate with the mainWindow instance", async () => {
      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(mockAppEmitActivate).toHaveBeenCalledTimes(1);
      expect(mockAppEmitActivate).toHaveBeenCalledWith(
        mockMainWindowGetInstance(),
      );
    });

    it("should call quitOnAllWindowsClosed with mainWindow and overlay", async () => {
      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(mockAppQuitOnAllWindowsClosed).toHaveBeenCalledTimes(1);
      expect(mockAppQuitOnAllWindowsClosed).toHaveBeenCalledWith([
        mockMainWindowGetInstance(),
        mockOverlayGetInstance(),
      ]);
    });

    it("should call beforeQuitCloseWindowsAndDestroyElements", async () => {
      const _capture = setupWhenReadyCapture();
      await importMain();

      expect(
        mockAppBeforeQuitCloseWindowsAndDestroyElements,
      ).toHaveBeenCalledTimes(1);
    });

    it("should wire app events even when single instance lock is NOT acquired", async () => {
      mockRequestSingleInstanceLock.mockReturnValue(false);

      await importMain();

      // These are always called regardless of lock status
      expect(mockAppEmitActivate).toHaveBeenCalledTimes(1);
      expect(mockAppQuitOnAllWindowsClosed).toHaveBeenCalledTimes(1);
      expect(
        mockAppBeforeQuitCloseWindowsAndDestroyElements,
      ).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Full Lifecycle Integration ────────────────────────────────────────

  describe("full lifecycle integration", () => {
    it("should execute the complete startup sequence in correct order", async () => {
      mockIsPackaged.value = true; // skip devtools to simplify
      const callOrder: string[] = [];

      mockSentryInitialize.mockImplementation(() => {
        callOrder.push("sentry:initialize");
      });
      mockSupabaseConfigure.mockImplementation(() => {
        callOrder.push("supabase:configure");
      });
      mockMainWindowCreateMainWindow.mockImplementation(async () => {
        callOrder.push("mainWindow:create");
      });
      mockAppEmitSecondInstance.mockImplementation(() => {
        callOrder.push("app:emitSecondInstance");
      });
      mockAppEmitRestart.mockImplementation(() => {
        callOrder.push("app:emitRestart");
      });
      mockAppEmitActivate.mockImplementation(() => {
        callOrder.push("app:emitActivate");
      });
      mockAppQuitOnAllWindowsClosed.mockImplementation(() => {
        callOrder.push("app:quitOnAllWindowsClosed");
      });
      mockAppBeforeQuitCloseWindowsAndDestroyElements.mockImplementation(() => {
        callOrder.push("app:beforeQuit");
      });

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      // Module-level calls happen first (sentry init, event wiring)
      expect(callOrder).toContain("sentry:initialize");

      // After whenReady: supabase -> window -> second instance -> restart
      const supabaseIdx = callOrder.indexOf("supabase:configure");
      const windowIdx = callOrder.indexOf("mainWindow:create");
      const secondInstanceIdx = callOrder.indexOf("app:emitSecondInstance");
      const restartIdx = callOrder.indexOf("app:emitRestart");

      expect(supabaseIdx).toBeLessThan(windowIdx);
      expect(windowIdx).toBeLessThan(secondInstanceIdx);
      expect(secondInstanceIdx).toBeLessThan(restartIdx);
    });

    it("should handle the duplicate-instance case: quit and still wire events", async () => {
      mockRequestSingleInstanceLock.mockReturnValue(false);

      await importMain();

      // Should quit
      expect(mockAppQuit).toHaveBeenCalledTimes(1);

      // But event wiring still happens (outside the if/else block)
      expect(mockAppEmitActivate).toHaveBeenCalled();
      expect(mockAppQuitOnAllWindowsClosed).toHaveBeenCalled();
      expect(
        mockAppBeforeQuitCloseWindowsAndDestroyElements,
      ).toHaveBeenCalled();

      // No window creation
      expect(mockMainWindowCreateMainWindow).not.toHaveBeenCalled();
      expect(mockSupabaseConfigure).not.toHaveBeenCalled();
    });

    it("should handle missing Supabase env vars gracefully during full startup", async () => {
      env.VITE_SUPABASE_URL = "";
      env.VITE_SUPABASE_ANON_KEY = "";

      const _consoleSpy = vi
        .spyOn(console, "warn")
        .mockImplementation(() => {});

      const capture = setupWhenReadyCapture();
      await importMain();
      await capture.invoke();

      // Supabase NOT configured, but everything else proceeds
      expect(mockSupabaseConfigure).not.toHaveBeenCalled();
      expect(mockMainWindowCreateMainWindow).toHaveBeenCalledTimes(1);
      expect(mockAppEmitSecondInstance).toHaveBeenCalledTimes(1);
      expect(mockAppEmitRestart).toHaveBeenCalledTimes(1);
    });
  });
});
