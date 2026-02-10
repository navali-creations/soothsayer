import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock for isProcessRunning ───────────────────────────────────────
const { mockIsProcessRunning } = vi.hoisted(() => ({
  mockIsProcessRunning: vi.fn<(processName: string) => Promise<boolean>>(),
}));

vi.mock("../isProcessRunning", () => ({
  isProcessRunning: mockIsProcessRunning,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { ProcessPoller } from "../ProcessPoller";

describe("ProcessPoller", () => {
  let poller: ProcessPoller;

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
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════
  describe("constructor", () => {
    it("should accept a single process name as a string", () => {
      poller = new ProcessPoller("myprocess.exe");
      expect((poller as any).processNames).toEqual(["myprocess.exe"]);
    });

    it("should accept an array of process names", () => {
      poller = new ProcessPoller(["proc1.exe", "proc2.exe", "proc3.exe"]);
      expect((poller as any).processNames).toEqual([
        "proc1.exe",
        "proc2.exe",
        "proc3.exe",
      ]);
    });

    it("should default interval to 5000ms", () => {
      poller = new ProcessPoller("test.exe");
      expect((poller as any)._intervalMs).toBe(5000);
    });

    it("should accept a custom interval", () => {
      poller = new ProcessPoller("test.exe", 2000);
      expect((poller as any)._intervalMs).toBe(2000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // pollOnce
  // ═══════════════════════════════════════════════════════════════════════════
  describe("pollOnce (via start)", () => {
    it("should check each process name until one is found running", async () => {
      poller = new ProcessPoller(["proc1.exe", "proc2.exe", "proc3.exe"], 100);

      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "proc2.exe";
      });

      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockIsProcessRunning).toHaveBeenCalledWith("proc1.exe");
      expect(mockIsProcessRunning).toHaveBeenCalledWith("proc2.exe");
      // Should stop checking after finding proc2
      expect(mockIsProcessRunning).not.toHaveBeenCalledWith("proc3.exe");

      expect(dataSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "proc2.exe",
      });
    });

    it("should return first process name with isRunning false when none are running", async () => {
      poller = new ProcessPoller(["proc1.exe", "proc2.exe", "proc3.exe"], 100);

      mockIsProcessRunning.mockResolvedValue(false);

      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockIsProcessRunning).toHaveBeenCalledWith("proc1.exe");
      expect(mockIsProcessRunning).toHaveBeenCalledWith("proc2.exe");
      expect(mockIsProcessRunning).toHaveBeenCalledWith("proc3.exe");

      expect(dataSpy).toHaveBeenCalledWith({
        isRunning: false,
        processName: "proc1.exe",
      });
    });

    it("should return first running process when multiple are running", async () => {
      poller = new ProcessPoller(["proc1.exe", "proc2.exe", "proc3.exe"], 100);

      // All processes are running, should return the first one found
      mockIsProcessRunning.mockResolvedValue(true);

      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(dataSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "proc1.exe",
      });

      // Should stop checking after the first match
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);
    });

    it("should handle a single process name correctly", async () => {
      poller = new ProcessPoller("single.exe", 100);

      mockIsProcessRunning.mockResolvedValue(true);

      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(mockIsProcessRunning).toHaveBeenCalledWith("single.exe");
      expect(dataSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "single.exe",
      });
    });

    it("should handle a single process name not running", async () => {
      poller = new ProcessPoller("single.exe", 100);

      mockIsProcessRunning.mockResolvedValue(false);

      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(dataSpy).toHaveBeenCalledWith({
        isRunning: false,
        processName: "single.exe",
      });
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // isStateActive
  // ═══════════════════════════════════════════════════════════════════════════
  describe("isStateActive", () => {
    it("should return true when state.isRunning is true", () => {
      poller = new ProcessPoller("test.exe", 100);
      const result = (poller as any).isStateActive({
        isRunning: true,
        processName: "test.exe",
      });
      expect(result).toBe(true);
    });

    it("should return false when state.isRunning is false", () => {
      poller = new ProcessPoller("test.exe", 100);
      const result = (poller as any).isStateActive({
        isRunning: false,
        processName: "test.exe",
      });
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hasStateChanged
  // ═══════════════════════════════════════════════════════════════════════════
  describe("hasStateChanged", () => {
    beforeEach(() => {
      poller = new ProcessPoller("test.exe", 100);
    });

    it("should detect change when isRunning changes from false to true", () => {
      const result = (poller as any).hasStateChanged(
        { isRunning: false, processName: "test.exe" },
        { isRunning: true, processName: "test.exe" },
      );
      expect(result).toBe(true);
    });

    it("should detect change when isRunning changes from true to false", () => {
      const result = (poller as any).hasStateChanged(
        { isRunning: true, processName: "test.exe" },
        { isRunning: false, processName: "test.exe" },
      );
      expect(result).toBe(true);
    });

    it("should not detect change when isRunning stays true", () => {
      const result = (poller as any).hasStateChanged(
        { isRunning: true, processName: "test.exe" },
        { isRunning: true, processName: "test.exe" },
      );
      expect(result).toBe(false);
    });

    it("should not detect change when isRunning stays false", () => {
      const result = (poller as any).hasStateChanged(
        { isRunning: false, processName: "test.exe" },
        { isRunning: false, processName: "test.exe" },
      );
      expect(result).toBe(false);
    });

    it("should not detect change when process name changes but isRunning stays the same", () => {
      const result = (poller as any).hasStateChanged(
        { isRunning: true, processName: "proc1.exe" },
        { isRunning: true, processName: "proc2.exe" },
      );
      // hasStateChanged only compares isRunning, not processName
      expect(result).toBe(false);
    });

    it("should detect change from undefined (initial state)", () => {
      const result = (poller as any).hasStateChanged(undefined, {
        isRunning: true,
        processName: "test.exe",
      });
      // undefined?.isRunning is undefined, which !== true
      expect(result).toBe(true);
    });

    it("should not detect change from undefined when isRunning is false", () => {
      const result = (poller as any).hasStateChanged(undefined, {
        isRunning: false,
        processName: "test.exe",
      });
      // undefined?.isRunning is undefined, which !== false
      expect(result).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // State transition events (integration with Poller base)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("state transition events", () => {
    it("should emit start when process begins running", async () => {
      poller = new ProcessPoller("game.exe", 100);
      const startSpy = vi.fn();
      poller.on("start", startSpy);

      mockIsProcessRunning.mockResolvedValue(false);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(startSpy).not.toHaveBeenCalled();

      mockIsProcessRunning.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "game.exe",
      });
    });

    it("should emit stop when process stops running", async () => {
      poller = new ProcessPoller("game.exe", 100);
      const stopSpy = vi.fn();
      poller.on("stop", stopSpy);

      mockIsProcessRunning.mockResolvedValue(true);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "game.exe",
      });
      expect(poller.isPollerRunning).toBe(false);
    });

    it("should handle full lifecycle: not running -> running -> not running", async () => {
      poller = new ProcessPoller("game.exe", 100);
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      const dataSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);
      poller.on("data", dataSpy);

      // Initially not running
      mockIsProcessRunning.mockResolvedValue(false);
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(false);
      expect(dataSpy).toHaveBeenCalledTimes(1);

      // Process starts
      mockIsProcessRunning.mockResolvedValue(true);
      await vi.advanceTimersByTimeAsync(100);
      expect(poller.isPollerRunning).toBe(true);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledTimes(2);

      // Process still running (no state change)
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledTimes(3);

      // Process stops
      mockIsProcessRunning.mockResolvedValue(false);
      await vi.advanceTimersByTimeAsync(100);
      expect(poller.isPollerRunning).toBe(false);
      expect(stopSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledTimes(4);
    });

    it("should handle process switching between names in the list", async () => {
      poller = new ProcessPoller(["proc1.exe", "proc2.exe"], 100);
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);

      // proc1 is running
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "proc1.exe";
      });
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);
      expect(startSpy).toHaveBeenCalledWith({
        isRunning: true,
        processName: "proc1.exe",
      });

      // Switch to proc2 running (proc1 stops, proc2 starts)
      mockIsProcessRunning.mockImplementation(async (name: string) => {
        return name === "proc2.exe";
      });
      await vi.advanceTimersByTimeAsync(100);

      // isRunning stays true in both states, so hasStateChanged returns false
      // This means no start/stop events fire — the poller sees it as still active
      expect(stopSpy).not.toHaveBeenCalled();
      expect(startSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error propagation from isProcessRunning
  // ═══════════════════════════════════════════════════════════════════════════
  describe("error handling", () => {
    it("should emit error event when isProcessRunning throws", async () => {
      poller = new ProcessPoller("test.exe", 100);
      const errorSpy = vi.fn();
      poller.on("error", errorSpy);

      const error = new Error("Command execution failed");
      mockIsProcessRunning.mockRejectedValue(error);

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it("should continue polling after error", async () => {
      poller = new ProcessPoller("test.exe", 100);
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
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Polling intervals
  // ═══════════════════════════════════════════════════════════════════════════
  describe("polling intervals", () => {
    it("should poll at the configured interval", async () => {
      poller = new ProcessPoller("test.exe", 250);
      mockIsProcessRunning.mockResolvedValue(false);

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(250);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(250);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(3);
    });

    it("should not poll before interval elapses", async () => {
      poller = new ProcessPoller("test.exe", 1000);
      mockIsProcessRunning.mockResolvedValue(false);

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(500);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(2);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Stop behavior
  // ═══════════════════════════════════════════════════════════════════════════
  describe("stop", () => {
    it("should stop polling when stop is called", async () => {
      poller = new ProcessPoller("test.exe", 100);
      mockIsProcessRunning.mockResolvedValue(false);

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);

      poller.stop();

      await vi.advanceTimersByTimeAsync(500);
      expect(mockIsProcessRunning).toHaveBeenCalledTimes(1);
    });

    it("should be safe to call stop without start", () => {
      poller = new ProcessPoller("test.exe", 100);
      expect(() => poller.stop()).not.toThrow();
    });
  });
});
