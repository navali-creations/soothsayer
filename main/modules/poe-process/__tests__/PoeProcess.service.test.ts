import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockIpcHandle,
  mockPollerOn,
  mockPollerStart,
  mockPollerStop,
  mockPowerMonitorOn,
  mockWebContentsSend,
} = vi.hoisted(() => ({
  mockIpcHandle: vi.fn(),
  mockPollerOn: vi.fn(),
  mockPollerStart: vi.fn(),
  mockPollerStop: vi.fn(),
  mockPowerMonitorOn: vi.fn(),
  mockWebContentsSend: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
    getFocusedWindow: vi.fn(() => null),
  },
  app: {
    isPackaged: false,
    getAppPath: vi.fn(() => "/mock-app-path"),
    getPath: vi.fn(() => "/mock-path"),
  },
  powerMonitor: {
    on: mockPowerMonitorOn,
  },
  dialog: {
    showMessageBox: vi.fn(),
    showSaveDialog: vi.fn(),
  },
}));

// ─── Mock PoeProcessPoller ───────────────────────────────────────────────────
// The service imports from "../../pollers/PoeProcessPoller" which resolves to
// main/pollers/PoeProcessPoller via the ~/main alias.
vi.mock("~/main/pollers/PoeProcessPoller", () => {
  class MockPoeProcessPoller {
    on = mockPollerOn;
    start = mockPollerStart;
    stop = mockPollerStop;
    emit = vi.fn();
    removeAllListeners = vi.fn();
  }
  return { PoeProcessPoller: MockPoeProcessPoller };
});

// ─── Mock barrel imports that PoeProcessService uses from ~/main/modules ─────
vi.mock("~/main/modules", () => ({
  PoeProcessChannel: {
    Start: "poe-process:start",
    Stop: "poe-process:stop",
    IsRunning: "poe-process:is-running",
    GetState: "poe-process:get-state",
    GetError: "poe-process:get-error",
  },
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { PoeProcessService } from "../PoeProcess.service";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Extract the handler registered for a given IPC channel */
function getIpcHandler(channel: string): (...args: any[]) => any {
  const call = mockIpcHandle.mock.calls.find(
    ([ch]: [string]) => ch === channel,
  );
  if (!call) {
    throw new Error(`ipcMain.handle was not called with "${channel}"`);
  }
  return call[1];
}

/** Get the callback registered on the poller for a given event */
function getPollerListener(event: string): (...args: any[]) => void {
  const call = mockPollerOn.mock.calls.find(([ev]: [string]) => ev === event);
  if (!call) {
    throw new Error(`poller.on was not called with "${event}"`);
  }
  return call[1];
}

/** Get the callback registered on powerMonitor for a given event */
function getPowerMonitorListener(event: string): (...args: any[]) => void {
  const call = mockPowerMonitorOn.mock.calls.find(
    ([ev]: [string]) => ev === event,
  );
  if (!call) {
    throw new Error(`powerMonitor.on was not called with "${event}"`);
  }
  return call[1];
}

/** Create a mock MainWindowService */
function createMockMainWindow(
  overrides: Partial<{
    isDestroyed: boolean;
    webContentsSend: ReturnType<typeof vi.fn>;
  }> = {},
) {
  const send = overrides.webContentsSend ?? mockWebContentsSend;
  return {
    getWebContents: vi.fn(() => ({
      send,
      isDestroyed: vi.fn(() => overrides.isDestroyed ?? false),
    })),
  };
}

// ─── Types for captured listeners ────────────────────────────────────────────
interface PollerListeners {
  start: (...args: any[]) => void;
  stop: (...args: any[]) => void;
  data: (...args: any[]) => void;
  error: (...args: any[]) => void;
}

interface PowerListeners {
  suspend: (...args: any[]) => void;
  resume: (...args: any[]) => void;
  lockScreen: (...args: any[]) => void;
  unlockScreen: (...args: any[]) => void;
}

/**
 * Capture all poller listeners from mockPollerOn's call history.
 * Must be called BEFORE vi.clearAllMocks().
 */
function capturePollerListeners(): PollerListeners {
  return {
    start: getPollerListener("start"),
    stop: getPollerListener("stop"),
    data: getPollerListener("data"),
    error: getPollerListener("error"),
  };
}

/**
 * Capture all powerMonitor listeners from mockPowerMonitorOn's call history.
 * Must be called BEFORE vi.clearAllMocks().
 */
function capturePowerListeners(): PowerListeners {
  return {
    suspend: getPowerMonitorListener("suspend"),
    resume: getPowerMonitorListener("resume"),
    lockScreen: getPowerMonitorListener("lock-screen"),
    unlockScreen: getPowerMonitorListener("unlock-screen"),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PoeProcessService", () => {
  let service: PoeProcessService;
  // Captured references survive vi.clearAllMocks()
  let pollerListeners: PollerListeners;
  let powerListeners: PowerListeners;

  beforeEach(() => {
    vi.clearAllMocks();

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    PoeProcessService._instance = undefined;

    service = PoeProcessService.getInstance();

    // Capture listener references immediately after construction
    // so they survive any subsequent clearAllMocks calls in nested beforeEach
    pollerListeners = capturePollerListeners();
    powerListeners = capturePowerListeners();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = PoeProcessService.getInstance();
      const b = PoeProcessService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─── Constructor setup ───────────────────────────────────────────────────

  describe("constructor", () => {
    it("should set up poller listeners for start, stop, data, and error", () => {
      const registeredEvents = mockPollerOn.mock.calls.map(
        ([ev]: [string]) => ev,
      );
      expect(registeredEvents).toContain("start");
      expect(registeredEvents).toContain("stop");
      expect(registeredEvents).toContain("data");
      expect(registeredEvents).toContain("error");
    });

    it("should register the poe-process:is-running IPC handler", () => {
      const channels = mockIpcHandle.mock.calls.map(([ch]: [string]) => ch);
      expect(channels).toContain("poe-process:is-running");
    });

    it("should set up powerMonitor listeners for suspend and resume", () => {
      const events = mockPowerMonitorOn.mock.calls.map(([ev]: [string]) => ev);
      expect(events).toContain("suspend");
      expect(events).toContain("resume");
    });

    it("should set up powerMonitor listeners for lock-screen and unlock-screen", () => {
      const events = mockPowerMonitorOn.mock.calls.map(([ev]: [string]) => ev);
      expect(events).toContain("lock-screen");
      expect(events).toContain("unlock-screen");
    });
  });

  // ─── IPC Handler: IsRunning ──────────────────────────────────────────────

  describe("IPC: poe-process:is-running", () => {
    it("should return default state when no events have occurred", () => {
      const handler = getIpcHandler("poe-process:is-running");
      const result = handler();
      expect(result).toEqual({ isRunning: false, processName: "" });
    });

    it("should return current state after a start event", () => {
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      const handler = getIpcHandler("poe-process:is-running");
      const result = handler();
      expect(result).toEqual({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
    });

    it("should return updated state after a stop event", () => {
      // First start
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      // Then stop
      pollerListeners.stop({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      const handler = getIpcHandler("poe-process:is-running");
      const result = handler();
      expect(result).toEqual({ isRunning: false, processName: "" });
    });

    it("should return updated state after a data event", () => {
      pollerListeners.data({
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      });

      const handler = getIpcHandler("poe-process:is-running");
      const result = handler();
      expect(result).toEqual({
        isRunning: true,
        processName: "PathOfExileSteam.exe",
      });
    });
  });

  // ─── initialize ──────────────────────────────────────────────────────────

  describe("initialize", () => {
    it("should start the poller", () => {
      vi.clearAllMocks();
      const mainWindow = createMockMainWindow();
      service.initialize(mainWindow as any);
      expect(mockPollerStart).toHaveBeenCalledTimes(1);
    });

    it("should not start the poller if the system is suspended", () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});

      // Trigger system suspend before initializing
      powerListeners.suspend();

      vi.clearAllMocks();

      const mainWindow = createMockMainWindow();
      service.initialize(mainWindow as any);

      // The poller should NOT have been started
      expect(mockPollerStart).not.toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  // ─── stop ────────────────────────────────────────────────────────────────

  describe("stop", () => {
    it("should stop the poller", () => {
      vi.clearAllMocks();
      service.stop();
      expect(mockPollerStop).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Poller event listeners ──────────────────────────────────────────────

  describe("poller event listeners", () => {
    let mainWindow: ReturnType<typeof createMockMainWindow>;

    beforeEach(() => {
      mainWindow = createMockMainWindow();
      service.initialize(mainWindow as any);
      // Only clear specific mocks — do NOT clear mockPollerOn (listeners captured above)
      mockWebContentsSend.mockClear();
      mockPollerStart.mockClear();
      mockPollerStop.mockClear();
    });

    describe("start event", () => {
      it("should update current state on start", () => {
        pollerListeners.start({
          isRunning: true,
          processName: "PathOfExile.exe",
        });

        const handler = getIpcHandler("poe-process:is-running");
        const result = handler();
        expect(result.isRunning).toBe(true);
        expect(result.processName).toBe("PathOfExile.exe");
      });

      it("should send start event to renderer", () => {
        const state = {
          isRunning: true,
          processName: "PathOfExile.exe",
        };
        pollerListeners.start(state);

        expect(mockWebContentsSend).toHaveBeenCalledWith(
          "poe-process:start",
          state,
        );
      });
    });

    describe("stop event", () => {
      it("should reset current state on stop", () => {
        // First set a running state
        pollerListeners.start({
          isRunning: true,
          processName: "PathOfExile.exe",
        });

        // Then stop
        pollerListeners.stop({
          isRunning: true,
          processName: "PathOfExile.exe",
        });

        const handler = getIpcHandler("poe-process:is-running");
        const result = handler();
        expect(result.isRunning).toBe(false);
        expect(result.processName).toBe("");
      });

      it("should send stop event to renderer with previous state", () => {
        const previousState = {
          isRunning: true,
          processName: "PathOfExile.exe",
        };
        pollerListeners.stop(previousState);

        expect(mockWebContentsSend).toHaveBeenCalledWith(
          "poe-process:stop",
          previousState,
        );
      });
    });

    describe("data event", () => {
      it("should update current state on data", () => {
        pollerListeners.data({
          isRunning: true,
          processName: "PathOfExile2Steam.exe",
        });

        const handler = getIpcHandler("poe-process:is-running");
        const result = handler();
        expect(result.isRunning).toBe(true);
        expect(result.processName).toBe("PathOfExile2Steam.exe");
      });

      it("should send data event to renderer", () => {
        const state = {
          isRunning: false,
          processName: "PathOfExile.exe",
        };
        pollerListeners.data(state);

        expect(mockWebContentsSend).toHaveBeenCalledWith(
          "poe-process:get-state",
          state,
        );
      });
    });

    describe("error event", () => {
      it("should send error to renderer", () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const error = new Error("Process detection failed");
        pollerListeners.error(error);

        expect(mockWebContentsSend).toHaveBeenCalledWith(
          "poe-process:get-error",
          { error: "Process detection failed" },
        );
        consoleSpy.mockRestore();
      });

      it("should log the error to console", () => {
        const consoleSpy = vi
          .spyOn(console, "error")
          .mockImplementation(() => {});

        const error = new Error("Process detection failed");
        pollerListeners.error(error);

        expect(consoleSpy).toHaveBeenCalledWith(
          "PoE process poller error:",
          error,
        );
        consoleSpy.mockRestore();
      });
    });
  });

  // ─── sendToRenderer edge cases ───────────────────────────────────────────

  describe("sendToRenderer", () => {
    it("should not throw when mainWindow is null (not initialized)", () => {
      // Service is not initialized — mainWindow is null
      expect(() => {
        pollerListeners.start({
          isRunning: true,
          processName: "PathOfExile.exe",
        });
      }).not.toThrow();

      // No send should have been called
      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("should not send when webContents is destroyed", () => {
      const mainWindow = createMockMainWindow({ isDestroyed: true });
      service.initialize(mainWindow as any);
      mockWebContentsSend.mockClear();

      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("should not send when getWebContents returns null", () => {
      const mainWindow = {
        getWebContents: vi.fn(() => null),
      };
      service.initialize(mainWindow as any);
      mockWebContentsSend.mockClear();

      expect(() => {
        pollerListeners.start({
          isRunning: true,
          processName: "PathOfExile.exe",
        });
      }).not.toThrow();

      expect(mockWebContentsSend).not.toHaveBeenCalled();
    });

    it("should handle getWebContents throwing an error gracefully", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mainWindow = {
        getWebContents: vi.fn(() => {
          throw new Error("Window was closed");
        }),
      };
      service.initialize(mainWindow as any);
      mockWebContentsSend.mockClear();

      expect(() => {
        pollerListeners.start({
          isRunning: true,
          processName: "PathOfExile.exe",
        });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[PoeProcess] Failed to send to renderer"),
        expect.stringContaining("Window was closed"),
      );
      consoleSpy.mockRestore();
    });

    it("should handle non-Error exceptions in sendToRenderer", () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const mainWindow = {
        getWebContents: vi.fn(() => {
          throw "string error";
        }),
      };
      service.initialize(mainWindow as any);
      mockWebContentsSend.mockClear();

      expect(() => {
        pollerListeners.start({
          isRunning: true,
          processName: "PathOfExile.exe",
        });
      }).not.toThrow();

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("[PoeProcess] Failed to send to renderer"),
        "string error",
      );
      consoleSpy.mockRestore();
    });
  });

  // ─── Power Monitor ──────────────────────────────────────────────────────

  describe("power monitor", () => {
    describe("suspend", () => {
      it("should stop the poller on suspend", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        const mainWindow = createMockMainWindow();
        service.initialize(mainWindow as any);
        mockPollerStop.mockClear();

        powerListeners.suspend();

        expect(mockPollerStop).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
      });

      it("should mark system as suspended", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        const mainWindow = createMockMainWindow();
        service.initialize(mainWindow as any);
        mockPollerStart.mockClear();
        mockPollerStop.mockClear();

        powerListeners.suspend();

        // After suspend, resume should restart the poller
        // (we verify the isSystemSuspended flag indirectly via resume behavior)
        mockPollerStart.mockClear();

        powerListeners.resume();

        // Since mainWindow is set, poller should restart
        expect(mockPollerStart).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
      });
    });

    describe("resume", () => {
      it("should restart the poller on resume if mainWindow is set", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        const mainWindow = createMockMainWindow();
        service.initialize(mainWindow as any);

        // Simulate suspend
        powerListeners.suspend();
        mockPollerStart.mockClear();

        // Simulate resume
        powerListeners.resume();

        expect(mockPollerStart).toHaveBeenCalledTimes(1);
        consoleSpy.mockRestore();
      });

      it("should NOT restart the poller on resume if service was never initialized", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        // Don't initialize (no mainWindow set)
        powerListeners.suspend();
        mockPollerStart.mockClear();

        powerListeners.resume();

        // poller.start should NOT have been called since mainWindow is null
        expect(mockPollerStart).not.toHaveBeenCalled();
        consoleSpy.mockRestore();
      });

      it("should clear the suspended flag on resume", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        // Suspend without mainWindow
        powerListeners.suspend();

        // Resume
        powerListeners.resume();

        // Now initialize — should start poller since system is no longer suspended
        mockPollerStart.mockClear();
        const mainWindow = createMockMainWindow();
        service.initialize(mainWindow as any);
        expect(mockPollerStart).toHaveBeenCalledTimes(1);

        consoleSpy.mockRestore();
      });
    });

    describe("lock-screen and unlock-screen", () => {
      it("should handle lock-screen event without errors", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        expect(() => powerListeners.lockScreen()).not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith("[PoeProcess] Screen locked");
        consoleSpy.mockRestore();
      });

      it("should handle unlock-screen event without errors", () => {
        const consoleSpy = vi
          .spyOn(console, "log")
          .mockImplementation(() => {});

        expect(() => powerListeners.unlockScreen()).not.toThrow();

        expect(consoleSpy).toHaveBeenCalledWith("[PoeProcess] Screen unlocked");
        consoleSpy.mockRestore();
      });
    });
  });

  // ─── State transitions ──────────────────────────────────────────────────

  describe("state transitions", () => {
    beforeEach(() => {
      const mainWindow = createMockMainWindow();
      service.initialize(mainWindow as any);
      mockWebContentsSend.mockClear();
      mockPollerStart.mockClear();
    });

    it("should track state through start -> data -> stop cycle", () => {
      const handler = getIpcHandler("poe-process:is-running");

      // Initial state
      expect(handler()).toEqual({ isRunning: false, processName: "" });

      // Process starts
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(handler()).toEqual({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      // Data events update state
      pollerListeners.data({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(handler()).toEqual({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      // Process stops
      pollerListeners.stop({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(handler()).toEqual({
        isRunning: false,
        processName: "",
      });
    });

    it("should handle switching between PoE1 and PoE2 processes", () => {
      const handler = getIpcHandler("poe-process:is-running");

      // PoE1 starts
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(handler().processName).toBe("PathOfExile.exe");

      // PoE1 stops
      pollerListeners.stop({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(handler().isRunning).toBe(false);

      // PoE2 starts
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile2Steam.exe",
      });
      expect(handler().processName).toBe("PathOfExile2Steam.exe");
    });

    it("should send correct channels for each event type", () => {
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "poe-process:start",
        expect.any(Object),
      );

      mockWebContentsSend.mockClear();

      pollerListeners.data({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "poe-process:get-state",
        expect.any(Object),
      );

      mockWebContentsSend.mockClear();

      pollerListeners.stop({
        isRunning: true,
        processName: "PathOfExile.exe",
      });
      expect(mockWebContentsSend).toHaveBeenCalledWith(
        "poe-process:stop",
        expect.any(Object),
      );
    });
  });

  // ─── Multiple initialize/stop cycles ─────────────────────────────────────

  describe("lifecycle", () => {
    it("should allow multiple initialize calls", () => {
      mockPollerStart.mockClear();

      const mainWindow1 = createMockMainWindow();
      const mainWindow2 = createMockMainWindow();

      service.initialize(mainWindow1 as any);
      service.initialize(mainWindow2 as any);

      expect(mockPollerStart).toHaveBeenCalledTimes(2);
    });

    it("should allow stop to be called even without initialize", () => {
      mockPollerStop.mockClear();
      expect(() => service.stop()).not.toThrow();
      expect(mockPollerStop).toHaveBeenCalledTimes(1);
    });

    it("should use the latest mainWindow for renderer communication", () => {
      const send1 = vi.fn();
      const send2 = vi.fn();

      const mainWindow1 = {
        getWebContents: vi.fn(() => ({
          send: send1,
          isDestroyed: vi.fn(() => false),
        })),
      };
      const mainWindow2 = {
        getWebContents: vi.fn(() => ({
          send: send2,
          isDestroyed: vi.fn(() => false),
        })),
      };

      service.initialize(mainWindow1 as any);
      service.initialize(mainWindow2 as any);

      // Trigger an event
      pollerListeners.start({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      // Only the second window's send should be called
      expect(send1).not.toHaveBeenCalled();
      expect(send2).toHaveBeenCalled();
    });
  });
});
