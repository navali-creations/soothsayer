import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// No Electron mocks needed — PerformanceLoggerService is a pure utility

describe("PerformanceLoggerService", () => {
  let PerformanceLoggerService: any;

  // We need to freshly import the module for each test group since
  // the constructor reads process.env.PERF_DEBUG at instantiation time.

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
    delete process.env.PERF_DEBUG;
  });

  // ─── Helper to get a fresh instance ──────────────────────────────────────

  async function createService(perfDebug?: string) {
    if (perfDebug !== undefined) {
      process.env.PERF_DEBUG = perfDebug;
    } else {
      delete process.env.PERF_DEBUG;
    }

    // Reset module cache so the constructor re-reads the env var
    vi.resetModules();
    const mod = await import("../PerformanceLogger.service");
    PerformanceLoggerService = mod.PerformanceLoggerService;

    // Reset the singleton so we get a fresh instance
    PerformanceLoggerService._instance = undefined;

    return PerformanceLoggerService.getInstance();
  }

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", async () => {
      await createService();
      const a = PerformanceLoggerService.getInstance();
      const b = PerformanceLoggerService.getInstance();
      expect(a).toBe(b);
    });
  });

  // ─── Disabled (default) ──────────────────────────────────────────────────

  describe("when PERF_DEBUG is not set (disabled)", () => {
    let service: any;

    beforeEach(async () => {
      service = await createService();
    });

    it("should not log anything from log()", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      service.log("test message");
      expect(spy).not.toHaveBeenCalled();
    });

    it("should not log anything from log() with context", () => {
      const spy = vi.spyOn(console, "log").mockImplementation(() => {});
      service.log("test message", { duration: 42 });
      expect(spy).not.toHaveBeenCalled();
    });

    it("startTimer should return null", () => {
      const result = service.startTimer("some-label");
      expect(result).toBeNull();
    });

    it("startTimers should return null", () => {
      const result = service.startTimers();
      expect(result).toBeNull();
    });

    it("time() should return undefined without executing the function body's result", async () => {
      const fn = vi.fn(() => 42);
      const result = await service.time("label", fn);
      expect(result).toBeUndefined();
      // The function should NOT be called when disabled
      expect(fn).not.toHaveBeenCalled();
    });
  });

  // ─── Enabled ─────────────────────────────────────────────────────────────

  describe("when PERF_DEBUG is 'true' (enabled)", () => {
    let service: any;
    let consoleSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(async () => {
      consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
      service = await createService("true");
    });

    it("should log an initialization message", () => {
      // The constructor logs "[PERF LOGGER] Performance logging enabled"
      expect(consoleSpy).toHaveBeenCalledWith(
        "[PERF LOGGER] Performance logging enabled",
      );
    });

    // ─── log() ─────────────────────────────────────────────────────────

    describe("log()", () => {
      it("should log a simple message", () => {
        service.log("hello world");
        expect(consoleSpy).toHaveBeenCalledWith("[PERF] hello world");
      });

      it("should log a message with numeric context formatted as ms", () => {
        service.log("query", { duration: 123.456 });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("duration: 123.46ms"),
        );
      });

      it("should log a message with string context", () => {
        service.log("query", { table: "sessions" });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("table: sessions"),
        );
      });

      it("should log a message with boolean context", () => {
        service.log("cache", { hit: true });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("hit: true"),
        );
      });

      it("should log a message with undefined context values", () => {
        service.log("test", { value: undefined });
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining("value: undefined"),
        );
      });

      it("should join multiple context entries with ' | '", () => {
        service.log("multi", { a: "x", b: 1.5 });
        const lastCall =
          consoleSpy.mock.calls[consoleSpy.mock.calls.length - 1][0];
        expect(lastCall).toContain(" | ");
        expect(lastCall).toContain("a: x");
        expect(lastCall).toContain("b: 1.50ms");
      });
    });

    // ─── startTimer() ──────────────────────────────────────────────────

    describe("startTimer()", () => {
      it("should return a function (not null) when enabled", () => {
        const endFn = service.startTimer("my-timer");
        expect(endFn).toBeTypeOf("function");
      });

      it("should log the elapsed duration when the returned function is called", () => {
        const endFn = service.startTimer("my-timer");
        // Call immediately — duration should be very small
        endFn();

        const logCalls = consoleSpy.mock.calls.filter((c: any[]) =>
          String(c[0]).includes("my-timer"),
        );
        expect(logCalls.length).toBe(1);
        expect(logCalls[0][0]).toContain("[PERF] my-timer");
        expect(logCalls[0][0]).toContain("duration:");
      });

      it("should include extra context when provided to the end function", () => {
        const endFn = service.startTimer("ctx-timer");
        endFn({ rows: 10 });

        const logCalls = consoleSpy.mock.calls.filter((c: any[]) =>
          String(c[0]).includes("ctx-timer"),
        );
        expect(logCalls.length).toBe(1);
        expect(logCalls[0][0]).toContain("rows: 10.00ms");
      });
    });

    // ─── startTimers() ─────────────────────────────────────────────────

    describe("startTimers()", () => {
      it("should return an object with start, end, and log functions", () => {
        const timers = service.startTimers();
        expect(timers).toBeDefined();
        expect(timers.start).toBeTypeOf("function");
        expect(timers.end).toBeTypeOf("function");
        expect(timers.log).toBeTypeOf("function");
      });

      it("should track multiple named timers independently", () => {
        const timers = service.startTimers();
        timers.start("query");
        timers.start("render");

        const queryElapsed = timers.end("query");
        const renderElapsed = timers.end("render");

        expect(queryElapsed).toBeTypeOf("number");
        expect(renderElapsed).toBeTypeOf("number");
        expect(queryElapsed).toBeGreaterThanOrEqual(0);
        expect(renderElapsed).toBeGreaterThanOrEqual(0);
      });

      it("end() should return 0 for an unknown timer name", () => {
        const timers = service.startTimers();
        const elapsed = timers.end("nonexistent");
        expect(elapsed).toBe(0);
      });

      it("log() should delegate to service.log()", () => {
        const timers = service.startTimers();
        timers.log("batch complete", { db: 5, render: 10 });

        const logCalls = consoleSpy.mock.calls.filter((c: any[]) =>
          String(c[0]).includes("batch complete"),
        );
        expect(logCalls.length).toBe(1);
      });
    });

    // ─── time() ────────────────────────────────────────────────────────

    describe("time()", () => {
      it("should execute the function and return its result", async () => {
        const result = await service.time("sync-fn", () => 42);
        expect(result).toBe(42);
      });

      it("should handle async functions", async () => {
        const result = await service.time("async-fn", () =>
          Promise.resolve("hello"),
        );
        expect(result).toBe("hello");
      });

      it("should log the label with duration", async () => {
        await service.time("timed-op", () => "ok");

        const logCalls = consoleSpy.mock.calls.filter((c: any[]) =>
          String(c[0]).includes("timed-op"),
        );
        expect(logCalls.length).toBe(1);
        expect(logCalls[0][0]).toContain("duration:");
      });

      it("should include extra context in the log", async () => {
        await service.time("ctx-op", () => "ok", { table: "cards" });

        const logCalls = consoleSpy.mock.calls.filter((c: any[]) =>
          String(c[0]).includes("ctx-op"),
        );
        expect(logCalls.length).toBe(1);
        expect(logCalls[0][0]).toContain("table: cards");
      });

      it("should propagate errors thrown by the function", async () => {
        await expect(
          service.time("err-op", () => {
            throw new Error("boom");
          }),
        ).rejects.toThrow("boom");
      });

      it("should propagate rejections from async functions", async () => {
        await expect(
          service.time("reject-op", () =>
            Promise.reject(new Error("async boom")),
          ),
        ).rejects.toThrow("async boom");
      });
    });
  });

  // ─── Edge: PERF_DEBUG with non-"true" values ─────────────────────────────

  describe("when PERF_DEBUG is set to a non-'true' value", () => {
    it("should remain disabled when PERF_DEBUG is 'false'", async () => {
      const service = await createService("false");
      expect(service.startTimer("x")).toBeNull();
    });

    it("should remain disabled when PERF_DEBUG is '1'", async () => {
      const service = await createService("1");
      expect(service.startTimer("x")).toBeNull();
    });

    it("should remain disabled when PERF_DEBUG is empty string", async () => {
      const service = await createService("");
      expect(service.startTimer("x")).toBeNull();
    });
  });
});
