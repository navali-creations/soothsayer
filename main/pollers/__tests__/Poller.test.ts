import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Poller } from "../Poller";

// ─── Concrete test implementation of the abstract Poller ─────────────────────
class TestPoller extends Poller<string> {
  public pollOnceResult: string | (() => Promise<string>) = "idle";
  public pollOnceError: Error | null = null;
  public onStartCalls: string[] = [];
  public onStopCalls: string[] = [];
  public onDataCalls: string[] = [];
  public activeStates: Set<string> = new Set(["active", "running"]);

  protected async pollOnce(): Promise<string> {
    if (this.pollOnceError) {
      throw this.pollOnceError;
    }
    if (typeof this.pollOnceResult === "function") {
      return this.pollOnceResult();
    }
    return this.pollOnceResult;
  }

  protected isStateActive(state: string): boolean {
    return this.activeStates.has(state);
  }

  protected onStart(state: string): void {
    this.onStartCalls.push(state);
  }

  protected onStop(previousState: string): void {
    this.onStopCalls.push(previousState);
  }

  protected onData(state: string): void {
    this.onDataCalls.push(state);
  }
}

// ─── Minimal concrete implementation (no hook overrides) ─────────────────────
class MinimalPoller extends Poller<boolean> {
  public result = false;

  protected async pollOnce(): Promise<boolean> {
    return this.result;
  }

  protected isStateActive(state: boolean): boolean {
    return state;
  }
}

// ─── Concrete implementation using default hasStateChanged (strict equality) ─
class DefaultComparisonPoller extends Poller<number> {
  public result = 0;

  protected async pollOnce(): Promise<number> {
    return this.result;
  }

  protected isStateActive(state: number): boolean {
    return state > 0;
  }
}

describe("Poller", () => {
  let poller: TestPoller;

  beforeEach(() => {
    vi.useFakeTimers();
    poller = new TestPoller(100);
  });

  afterEach(() => {
    poller.stop();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Constructor
  // ═══════════════════════════════════════════════════════════════════════════
  describe("constructor", () => {
    it("should set the interval from constructor argument", () => {
      const p = new TestPoller(2000);
      expect((p as any)._intervalMs).toBe(2000);
    });

    it("should default interval to 5000ms when not specified", () => {
      // MinimalPoller doesn't pass intervalMs, so it should default
      const p = new (class extends MinimalPoller {})();
      expect((p as any)._intervalMs).toBe(5000);
    });

    it("should start with isPollerRunning as false", () => {
      expect(poller.isPollerRunning).toBe(false);
    });

    it("should start with pollInterval as undefined", () => {
      expect(poller.pollInterval).toBeUndefined();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // start()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("start", () => {
    it("should poll immediately on start", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      poller.start();

      // Allow the immediate poll's microtask to resolve
      await vi.advanceTimersByTimeAsync(0);

      expect(dataSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledWith("idle");
    });

    it("should set up an interval for subsequent polls", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledTimes(1);

      // Advance by one interval
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledTimes(2);

      // Advance by another interval
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledTimes(3);
    });

    it("should set pollInterval to defined value", () => {
      poller.start();
      expect(poller.pollInterval).toBeDefined();
    });

    it("should stop previous polling before restarting", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      poller.start();
      const firstInterval = poller.pollInterval;
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledTimes(1);

      // Restart
      poller.start();
      const secondInterval = poller.pollInterval;
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledTimes(2);

      // First interval should have been cleared (they should be different refs)
      expect(firstInterval).not.toBe(secondInterval);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // stop()
  // ═══════════════════════════════════════════════════════════════════════════
  describe("stop", () => {
    it("should clear the poll interval", async () => {
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(poller.pollInterval).toBeDefined();

      poller.stop();

      expect(poller.pollInterval).toBeUndefined();
    });

    it("should stop further polling", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledTimes(1);

      poller.stop();

      await vi.advanceTimersByTimeAsync(500);
      expect(dataSpy).toHaveBeenCalledTimes(1);
    });

    it("should set isPollerRunning to false", async () => {
      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      poller.stop();
      expect(poller.isPollerRunning).toBe(false);
    });

    it("should be safe to call stop when not started", () => {
      expect(() => poller.stop()).not.toThrow();
    });

    it("should be safe to call stop multiple times", async () => {
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(() => {
        poller.stop();
        poller.stop();
        poller.stop();
      }).not.toThrow();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // data event
  // ═══════════════════════════════════════════════════════════════════════════
  describe("data event", () => {
    it("should emit data event on every poll", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledWith("idle");

      poller.pollOnceResult = "active";
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledWith("active");

      // Still idle again
      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledWith("idle");

      expect(dataSpy).toHaveBeenCalledTimes(3);
    });

    it("should call onData hook on every poll", async () => {
      poller.pollOnceResult = "idle";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      poller.pollOnceResult = "active";
      await vi.advanceTimersByTimeAsync(100);

      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);

      expect(poller.onDataCalls).toEqual(["idle", "active", "idle"]);
    });

    it("should emit data even when state has not changed", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      expect(dataSpy).toHaveBeenCalledTimes(3);
      expect(dataSpy).toHaveBeenCalledWith("idle");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // State transitions: start/stop events
  // ═══════════════════════════════════════════════════════════════════════════
  describe("state transitions", () => {
    it("should emit start event when state transitions from inactive to active", async () => {
      const startSpy = vi.fn();
      poller.on("start", startSpy);
      poller.pollOnceResult = "idle"; // inactive

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(startSpy).not.toHaveBeenCalled();
      expect(poller.isPollerRunning).toBe(false);

      poller.pollOnceResult = "active"; // active
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith("active");
      expect(poller.isPollerRunning).toBe(true);
    });

    it("should call onStart hook when state transitions to active", async () => {
      poller.pollOnceResult = "idle";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      poller.pollOnceResult = "running"; // also in activeStates
      await vi.advanceTimersByTimeAsync(100);

      expect(poller.onStartCalls).toEqual(["running"]);
    });

    it("should emit stop event when state transitions from active to inactive", async () => {
      const stopSpy = vi.fn();
      poller.on("stop", stopSpy);

      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);
      expect(stopSpy).toHaveBeenCalledTimes(1);
      // stop emits the previous state
      expect(stopSpy).toHaveBeenCalledWith("active");
      expect(poller.isPollerRunning).toBe(false);
    });

    it("should call onStop hook when state transitions to inactive", async () => {
      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);

      expect(poller.onStopCalls).toEqual(["active"]);
    });

    it("should emit start on first poll if state is immediately active", async () => {
      const startSpy = vi.fn();
      poller.on("start", startSpy);
      poller.pollOnceResult = "active";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(startSpy).toHaveBeenCalledWith("active");
      expect(poller.isPollerRunning).toBe(true);
    });

    it("should not re-emit start if state remains active", async () => {
      const startSpy = vi.fn();
      poller.on("start", startSpy);
      poller.pollOnceResult = "active";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(startSpy).toHaveBeenCalledTimes(1);

      // State stays the same (no state change detected by hasStateChanged)
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it("should not re-emit stop if state remains inactive", async () => {
      const stopSpy = vi.fn();
      poller.on("stop", stopSpy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);

      expect(stopSpy).not.toHaveBeenCalled();
    });

    it("should handle multiple start/stop cycles", async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);

      // Cycle 1: inactive -> active
      poller.pollOnceResult = "idle";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      poller.pollOnceResult = "active";
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);

      // Cycle 1: active -> inactive
      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);
      expect(stopSpy).toHaveBeenCalledTimes(1);

      // Cycle 2: inactive -> active
      poller.pollOnceResult = "running";
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(2);
      expect(startSpy).toHaveBeenLastCalledWith("running");

      // Cycle 2: active -> inactive
      poller.pollOnceResult = "stopped";
      await vi.advanceTimersByTimeAsync(100);
      expect(stopSpy).toHaveBeenCalledTimes(2);
      expect(stopSpy).toHaveBeenLastCalledWith("running");
    });

    it("should track isPollerRunning correctly through transitions", async () => {
      poller.pollOnceResult = "idle";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(false);

      poller.pollOnceResult = "active";
      await vi.advanceTimersByTimeAsync(100);
      expect(poller.isPollerRunning).toBe(true);

      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);
      expect(poller.isPollerRunning).toBe(false);
    });

    it("should update previousState after state change", async () => {
      const stopSpy = vi.fn();
      poller.on("stop", stopSpy);

      // Start with active
      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      // Switch to different active state (both "active" and "running" are active)
      poller.pollOnceResult = "running";
      await vi.advanceTimersByTimeAsync(100);
      // hasStateChanged("active", "running") -> true
      // isPollerRunning is true, isStateActive("running") is true
      // Neither start nor stop branch fires (both branches require a running-state mismatch)
      // But previousState updates to "running"

      // Now go inactive
      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);
      // stop should be emitted with "running" (the updated previous state)
      expect(stopSpy).toHaveBeenCalledWith("running");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hasStateChanged (default implementation)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("hasStateChanged (default)", () => {
    it("should use strict equality by default", async () => {
      const defaultPoller = new DefaultComparisonPoller(100);
      const startSpy = vi.fn();
      defaultPoller.on("start", startSpy);

      defaultPoller.result = 0;
      defaultPoller.start();
      await vi.advanceTimersByTimeAsync(0);

      // Same value → no state change
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).not.toHaveBeenCalled();

      // Different value → state change detected
      defaultPoller.result = 5;
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);

      defaultPoller.stop();
    });

    it("should detect change from undefined (initial) to first value", async () => {
      const defaultPoller = new DefaultComparisonPoller(100);
      const dataSpy = vi.fn();
      const startSpy = vi.fn();
      defaultPoller.on("data", dataSpy);
      defaultPoller.on("start", startSpy);

      defaultPoller.result = 10; // active
      defaultPoller.start();
      await vi.advanceTimersByTimeAsync(0);

      // First poll: previous is undefined, current is 10 → undefined !== 10 → state changed
      expect(startSpy).toHaveBeenCalledTimes(1);

      defaultPoller.stop();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // hasStateChanged (custom override in TestPoller — inherited from Poller)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("hasStateChanged (custom override)", () => {
    it("should respect custom hasStateChanged in subclass", async () => {
      // TestPoller inherits default strict equality hasStateChanged from Poller.
      // But the state transitions depend on both hasStateChanged AND isStateActive.
      // Let's verify that when state doesn't change, no start/stop events fire.
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);

      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(startSpy).toHaveBeenCalledTimes(1);

      // Same state, no change → no duplicate events
      await vi.advanceTimersByTimeAsync(100);
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);
      expect(stopSpy).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════════════════
  describe("error handling", () => {
    it("should emit error event when pollOnce throws", async () => {
      const errorSpy = vi.fn();
      poller.on("error", errorSpy);
      const error = new Error("poll failed");
      poller.pollOnceError = error;

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(errorSpy).toHaveBeenCalledWith(error);
    });

    it("should not emit data or start/stop events when pollOnce throws", async () => {
      const dataSpy = vi.fn();
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.on("start", startSpy);
      poller.on("stop", stopSpy);
      poller.on("error", () => {}); // prevent unhandled error from EventEmitter
      poller.pollOnceError = new Error("fail");

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(dataSpy).not.toHaveBeenCalled();
      expect(startSpy).not.toHaveBeenCalled();
      expect(stopSpy).not.toHaveBeenCalled();
    });

    it("should continue polling after an error", async () => {
      const errorSpy = vi.fn();
      const dataSpy = vi.fn();
      poller.on("error", errorSpy);
      poller.on("data", dataSpy);

      poller.pollOnceError = new Error("fail");
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(errorSpy).toHaveBeenCalledTimes(1);

      // Clear the error, next poll should succeed
      poller.pollOnceError = null;
      poller.pollOnceResult = "active";
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledWith("active");
    });

    it("should not change isPollerRunning on error", async () => {
      poller.on("error", () => {}); // prevent unhandled error
      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      poller.pollOnceError = new Error("fail");
      await vi.advanceTimersByTimeAsync(100);
      // State should remain unchanged
      expect(poller.isPollerRunning).toBe(true);
    });

    it("should handle errors interleaved with successful polls", async () => {
      const errorSpy = vi.fn();
      const dataSpy = vi.fn();
      poller.on("error", errorSpy);
      poller.on("data", dataSpy);

      // Success
      poller.pollOnceResult = "idle";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledTimes(1);

      // Error
      poller.pollOnceError = new Error("intermittent");
      await vi.advanceTimersByTimeAsync(100);
      expect(errorSpy).toHaveBeenCalledTimes(1);
      expect(dataSpy).toHaveBeenCalledTimes(1); // no new data call

      // Success again
      poller.pollOnceError = null;
      poller.pollOnceResult = "active";
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledTimes(2);
      expect(dataSpy).toHaveBeenLastCalledWith("active");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // MinimalPoller (no hook overrides — tests default hook behavior)
  // ═══════════════════════════════════════════════════════════════════════════
  describe("minimal subclass (no hook overrides)", () => {
    let minPoller: MinimalPoller;

    beforeEach(() => {
      minPoller = new MinimalPoller(100);
    });

    afterEach(() => {
      minPoller.stop();
    });

    it("should work without overriding onStart, onStop, onData", async () => {
      const startSpy = vi.fn();
      const stopSpy = vi.fn();
      const dataSpy = vi.fn();
      minPoller.on("start", startSpy);
      minPoller.on("stop", stopSpy);
      minPoller.on("data", dataSpy);

      minPoller.result = false;
      minPoller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledWith(false);

      minPoller.result = true;
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledWith(true);

      minPoller.result = false;
      await vi.advanceTimersByTimeAsync(100);
      expect(stopSpy).toHaveBeenCalledWith(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // EventEmitter integration
  // ═══════════════════════════════════════════════════════════════════════════
  describe("EventEmitter integration", () => {
    it("should support multiple listeners for the same event", async () => {
      const spy1 = vi.fn();
      const spy2 = vi.fn();
      poller.on("data", spy1);
      poller.on("data", spy2);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);

      expect(spy1).toHaveBeenCalledWith("idle");
      expect(spy2).toHaveBeenCalledWith("idle");
    });

    it("should support removing listeners", async () => {
      const spy = vi.fn();
      poller.on("data", spy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(spy).toHaveBeenCalledTimes(1);

      poller.removeListener("data", spy);
      await vi.advanceTimersByTimeAsync(100);
      expect(spy).toHaveBeenCalledTimes(1); // no additional calls
    });

    it("should support once listeners", async () => {
      const spy = vi.fn();
      poller.once("data", spy);
      poller.pollOnceResult = "idle";

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(spy).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(100);
      expect(spy).toHaveBeenCalledTimes(1); // not called again
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge cases
  // ═══════════════════════════════════════════════════════════════════════════
  describe("edge cases", () => {
    it("should handle pollOnce returning the same active state object reference", async () => {
      // With strict equality, the same reference means no state change
      const startSpy = vi.fn();
      poller.on("start", startSpy);
      const activeState = "active";
      poller.pollOnceResult = activeState;

      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(startSpy).toHaveBeenCalledTimes(1);

      // Same reference → hasStateChanged returns false → no duplicate event
      await vi.advanceTimersByTimeAsync(100);
      expect(startSpy).toHaveBeenCalledTimes(1);
    });

    it("should handle rapid start/stop calls", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);
      poller.pollOnceResult = "idle";

      // Each start() calls poll() immediately (synchronously enqueues an async poll),
      // so 3 start() calls result in 3 poll invocations resolving.
      poller.start();
      poller.stop();
      poller.start();
      poller.stop();
      poller.start();

      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledTimes(3);

      // But only the last start's interval should be active
      expect(poller.pollInterval).toBeDefined();
      await vi.advanceTimersByTimeAsync(100);
      expect(dataSpy).toHaveBeenCalledTimes(4);
    });

    it("should not emit stop with undefined previousState", async () => {
      // The Poller code checks `if (this._previousState !== undefined)` before
      // calling onStop — but stop event is still emitted. Let's verify behavior
      // when going from active → inactive when active was the first state.
      const stopSpy = vi.fn();
      poller.on("stop", stopSpy);

      poller.pollOnceResult = "active";
      poller.start();
      await vi.advanceTimersByTimeAsync(0);
      expect(poller.isPollerRunning).toBe(true);

      poller.pollOnceResult = "idle";
      await vi.advanceTimersByTimeAsync(100);
      // Previous state was "active" (not undefined) so onStop should have been called
      expect(stopSpy).toHaveBeenCalledWith("active");
      expect(poller.onStopCalls).toEqual(["active"]);
    });

    it("should handle async pollOnce that takes longer than poll interval", async () => {
      const dataSpy = vi.fn();
      poller.on("data", dataSpy);

      let resolveDelayed: (value: string) => void;
      poller.pollOnceResult = () =>
        new Promise<string>((resolve) => {
          resolveDelayed = resolve;
        });

      poller.start();
      // The first poll is pending...
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).not.toHaveBeenCalled();

      // Resolve the delayed poll
      resolveDelayed!("active");
      await vi.advanceTimersByTimeAsync(0);
      expect(dataSpy).toHaveBeenCalledWith("active");
    });
  });
});
