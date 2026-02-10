import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock for isProcessRunning ───────────────────────────────────────
const { mockIsProcessRunning } = vi.hoisted(() => ({
  mockIsProcessRunning: vi.fn<(processName: string) => Promise<boolean>>(),
}));

vi.mock("../isProcessRunning", () => ({
  isProcessRunning: mockIsProcessRunning,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { PoeProcessPoller } from "../PoeProcessPoller";

describe("PoeProcessPoller", () => {
  let poller: PoeProcessPoller;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockIsProcessRunning.mockResolvedValue(false);
  });

  afterEach(() => {
    poller?.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor / Configuration
  // ═══════════════════════════════════════════════════════════════════════════
  describe("constructor", () => {
    it("should use 5000ms poll interval", () => {
      poller = new PoeProcessPoller();
      expect((poller as any)._intervalMs).toBe(5000);
    });

    it("should include all expected PoE process names", () => {
      poller = new PoeProcessPoller();
      const processNames = (poller as any).processNames;

      expect(processNames).toContain("PathOfExileSteam.exe");
      expect(processNames).toContain("PathOfExile.exe");
      expect(processNames).toContain("PathOfExile2Steam.exe");
      expect(processNames).toContain("PathOfExile2.exe");
      expect(processNames).toContain("PathOfExile_x64Steam.exe");
      expect(processNames).toContain("PathOfExile_x64.exe");
    });

    it("should include PoE 1 process names", () => {
      poller = new PoeProcessPoller();
      const processNames = (poller as any).processNames;

      expect(processNames).toContain("PathOfExileSteam.exe");
      expect(processNames).toContain("PathOfExile.exe");
    });

    it("should include PoE 2 process names", () => {
      poller = new PoeProcessPoller();
      const processNames = (poller as any).processNames;

      expect(processNames).toContain("PathOfExile2Steam.exe");
      expect(processNames).toContain("PathOfExile2.exe");
      expect(processNames).toContain("PathOfExile_x64Steam.exe");
      expect(processNames).toContain("PathOfExile_x64.exe");
    });

    it("should have exactly 6 process names", () => {
      poller = new PoeProcessPoller();
      expect((poller as any).processNames).toHaveLength(6);
    });

    it("should start with isPollerRunning as false", () => {
      poller = new PoeProcessPoller();
      expect(poller.isPollerRunning).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onStart hook
  // ═══════════════════════════════════════════════════════════════════════════
  describe("onStart", () => {
    it("should log when Path of Exile starts", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile started: PathOfExile.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should log the correct process name for Steam version", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExileSteam.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile started: PathOfExileSteam.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should log the correct process name for PoE 2", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      // Make PoE 1 names not running but PoE 2 running
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile2.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile started: PathOfExile2.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should log the correct process name for PoE 2 Steam", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile2Steam.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile started: PathOfExile2Steam.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should emit start event alongside the onStart hook", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();
      const startSpy = vi.fn();
      poller.on("start", startSpy);

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // onStop hook
  // ═══════════════════════════════════════════════════════════════════════════
  describe("onStop", () => {
    it("should log when Path of Exile stops", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      // Start with PoE running
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      consoleSpy.mockClear();

      // PoE stops
      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(5000);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile stopped: PathOfExile.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should log the correct process name on stop (Steam version)", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExileSteam.exe";
      });
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      consoleSpy.mockClear();

      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(5000);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile stopped: PathOfExileSteam.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should emit stop event alongside the onStop hook", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();
      const stopSpy = vi.fn();
      poller.on("stop", stopSpy);

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(5000);

      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "PathOfExile.exe",
      });

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Full lifecycle
  // ═══════════════════════════════════════════════════════════════════════════
  describe("full lifecycle", () => {
    it("should handle not running -> running -> not running", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      const dataSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);
      poller.on("data", dataSpy);

      // Not running
      mockIsProcessRunning.mockResolvedValue(false);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(false);
      expect(startSpy).not.toHaveBeenCalled();
      expect(dataSpy).toHaveBeenCalledTimes(1);

      // Starts running
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });
      await vi.advanceTimersByTimeAsync(5000);
      expect(poller.isPollerRunning).toBe(true);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledTimes(2);

      // Still running
      await vi.advanceTimersByTimeAsync(5000);
      expect(startSpy).toHaveBeenCalledTimes(1); // no duplicate
      expect(dataSpy).toHaveBeenCalledTimes(3);

      // Stops running
      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(5000);
      expect(poller.isPollerRunning).toBe(false);
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledTimes(4);

      consoleSpy.mockRestore();
    });

    it("should handle switching from PoE 1 to PoE 2", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);

      // PoE 1 starts
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      // Switch to PoE 2 (PoE 1 stops, PoE 2 starts simultaneously)
      // Since hasStateChanged only compares isRunning, this looks the same
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile2.exe";
      });
      await vi.advanceTimersByTimeAsync(5000);

      // isRunning stays true, so no stop/start events fire
      expect(stopSpy).not.toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(poller.isPollerRunning).toBe(true);

      consoleSpy.mockRestore();
    });

    it("should handle PoE 1 stops then PoE 2 starts with gap", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);

      // PoE 1 starts
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);
      expect(startSpy).toHaveBeenCalledTimes(1);

      // PoE 1 stops
      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(5000);
      expect(poller.isPollerRunning).toBe(false);
      expect(stopSpy).toHaveBeenCalledTimes(1);

      // PoE 2 starts
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile2.exe";
      });
      await vi.advanceTimersByTimeAsync(5000);
      expect(poller.isPollerRunning).toBe(true);
      expect(startSpy).toHaveBeenCalledTimes(2);
      expect(startSpy).toHaveBeenLastCalledWith({
        isRunning: true,
        processName: "PathOfExile2.exe",
      });

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Priority order
  // ═══════════════════════════════════════════════════════════════════════════
  describe("process priority", () => {
    it("should detect PoE 1 Steam first if it is listed first and running", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      // Both PoE 1 Steam and standalone are running
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExileSteam.exe" || name === "PathOfExile.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      // Should report the first match in the list
      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile started: PathOfExileSteam.exe",
      );

      consoleSpy.mockRestore();
    });

    it("should detect standalone PoE 1 when Steam version is not running", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(consoleSpy).toHaveBeenCalledWith(
        "Path of Exile started: PathOfExile.exe",
      );

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════════════════
  describe("error handling", () => {
    it("should emit error event when isProcessRunning throws", async () => {
      poller = new PoeProcessPoller();
      const errorSpy = vi.fn();
      poller.on("error", errorSpy);

      const error = new Error("tasklist failed");
      mockIsProcessRunning.mockRejectedValue(error);

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it("should continue polling after error", async () => {
      poller = new PoeProcessPoller();
      const errorSpy = vi.fn();
      const dataSpy = vi.fn();
      poller.on("error", errorSpy);
      poller.on("data", dataSpy);

      // First poll: error
      mockIsProcessRunning.mockRejectedValueOnce(new Error("fail"));
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).not.toHaveBeenCalled();

      // Second poll: success
      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(5000);
      expect(dataSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stop / Cleanup
  // ═══════════════════════════════════════════════════════════════════════════
  describe("stop", () => {
    it("should stop polling when stop is called", async () => {
      poller = new PoeProcessPoller();
      mockIsProcessRunning.mockResolvedValue(false);

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockIsProcessRunning).toHaveBeenCalled();

      const callCount = mockIsProcessRunning.mock.calls.length;
      poller.stop();

      await vi.advanceTimersByTimeAsync(15000);
      expect(mockIsProcessRunning.mock.calls.length).toBe(callCount);
    });

    it("should set isPollerRunning to false when stopped", async () => {
      const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      poller = new PoeProcessPoller();

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "PathOfExile.exe";
      });

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      poller.stop();
      expect(poller.isPollerRunning).toBe(false);

      consoleSpy.mockRestore();
    });

    it("should be safe to call stop without start", () => {
      poller = new PoeProcessPoller();
      expect(() => poller.stop()).not.toThrow();
    });

    it("should be safe to call stop multiple times", () => {
      poller = new PoeProcessPoller();
      poller.start();
      expect(() => {
        poller.stop();
        poller.stop();
        poller.stop();
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Inheritance verification
  // ═══════════════════════════════════════════════════════════════════════════
  describe("inheritance", () => {
    it("should be an instance of PoeProcessPoller", () => {
      poller = new PoeProcessPoller();
      expect(poller).toBeInstanceOf(PoeProcessPoller);
    });

    it("should support EventEmitter methods", () => {
      poller = new PoeProcessPoller();
      const spy = vi.fn();

      poller.on("data", spy);
      poller.emit("data", { isRunning: false, processName: "test" });
      expect(spy).toHaveBeenCalledTimes(1);

      poller.removeListener("data", spy);
      poller.emit("data", { isRunning: false, processName: "test" });
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });
});
