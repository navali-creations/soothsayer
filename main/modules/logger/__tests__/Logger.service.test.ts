import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ────────────────────────────────────────────────────

const { mockIsPackaged, mockStyleText } = vi.hoisted(() => ({
  mockIsPackaged: { value: false },
  mockStyleText: vi.fn((_format: string, text: string) => `[styled:${text}]`),
}));

// ─── Mock Electron ─────────────────────────────────────────────────────────────

vi.mock("electron", () => ({
  app: {
    get isPackaged() {
      return mockIsPackaged.value;
    },
  },
}));

// ─── Mock node:util ────────────────────────────────────────────────────────────

vi.mock("node:util", () => ({
  styleText: mockStyleText,
}));

// ─── Import under test (after mocks) ───────────────────────────────────────────

import { Logger, LoggerService } from "../Logger.service";

// ─── Tests ─────────────────────────────────────────────────────────────────────

describe("Logger", () => {
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    info: ReturnType<typeof vi.spyOn>;
    warn: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
    debug: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    mockIsPackaged.value = false;
    mockStyleText.mockClear();

    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      info: vi.spyOn(console, "info").mockImplementation(() => {}),
      warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
      debug: vi.spyOn(console, "debug").mockImplementation(() => {}),
    };
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Development mode (app.isPackaged = false) ─────────────────────────────

  describe("when app is NOT packaged (development mode)", () => {
    beforeEach(() => {
      mockIsPackaged.value = false;
    });

    it("log() should call console.log with formatted tag and arguments", () => {
      const logger = new Logger("TestTag");
      logger.log("hello", 42);

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.any(String),
        "hello",
        42,
      );
    });

    it("info() should call console.info with formatted tag and arguments", () => {
      const logger = new Logger("TestTag");
      logger.info("info message");

      expect(consoleSpy.info).toHaveBeenCalledTimes(1);
      expect(consoleSpy.info).toHaveBeenCalledWith(
        expect.any(String),
        "info message",
      );
    });

    it("warn() should call console.warn with formatted tag and arguments", () => {
      const logger = new Logger("TestTag");
      logger.warn("warning message");

      expect(consoleSpy.warn).toHaveBeenCalledTimes(1);
      expect(consoleSpy.warn).toHaveBeenCalledWith(
        expect.any(String),
        "warning message",
      );
    });

    it("error() should call console.error with formatted tag and arguments", () => {
      const logger = new Logger("TestTag");
      const err = new Error("something broke");
      logger.error("failed:", err);

      expect(consoleSpy.error).toHaveBeenCalledTimes(1);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.any(String),
        "failed:",
        err,
      );
    });

    it("debug() should call console.debug with formatted tag and arguments", () => {
      const logger = new Logger("TestTag");
      logger.debug("debug detail", { key: "value" });

      expect(consoleSpy.debug).toHaveBeenCalledTimes(1);
      expect(consoleSpy.debug).toHaveBeenCalledWith(
        expect.any(String),
        "debug detail",
        { key: "value" },
      );
    });

    it("should handle multiple arguments of different types", () => {
      const logger = new Logger("Multi");
      logger.log("count:", 5, true, null, undefined, [1, 2]);

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.any(String),
        "count:",
        5,
        true,
        null,
        undefined,
        [1, 2],
      );
    });

    it("should handle no arguments beyond the tag", () => {
      const logger = new Logger("Empty");
      logger.log();

      expect(consoleSpy.log).toHaveBeenCalledTimes(1);
      expect(consoleSpy.log).toHaveBeenCalledWith(expect.any(String));
    });
  });

  // ─── Production mode (app.isPackaged = true) ───────────────────────────────

  describe("when app IS packaged (production mode)", () => {
    beforeEach(() => {
      mockIsPackaged.value = true;
    });

    it("log() should NOT call console.log", () => {
      const logger = new Logger("Prod");
      logger.log("should not appear");

      expect(consoleSpy.log).not.toHaveBeenCalled();
    });

    it("info() should NOT call console.info", () => {
      const logger = new Logger("Prod");
      logger.info("should not appear");

      expect(consoleSpy.info).not.toHaveBeenCalled();
    });

    it("warn() should NOT call console.warn", () => {
      const logger = new Logger("Prod");
      logger.warn("should not appear");

      expect(consoleSpy.warn).not.toHaveBeenCalled();
    });

    it("error() should NOT call console.error", () => {
      const logger = new Logger("Prod");
      logger.error("should not appear");

      expect(consoleSpy.error).not.toHaveBeenCalled();
    });

    it("debug() should NOT call console.debug", () => {
      const logger = new Logger("Prod");
      logger.debug("should not appear");

      expect(consoleSpy.debug).not.toHaveBeenCalled();
    });

    it("should NOT call styleText when packaged", () => {
      const logger = new Logger("Prod");
      logger.log("test");
      logger.warn("test");
      logger.error("test");
      logger.debug("test");
      logger.info("test");

      expect(mockStyleText).not.toHaveBeenCalled();
    });
  });

  // ─── styleText usage ───────────────────────────────────────────────────────

  describe("styleText formatting", () => {
    beforeEach(() => {
      mockIsPackaged.value = false;
    });

    it("log() should use styleText with 'cyan' for INFO level and 'magenta' for the tag", () => {
      const logger = new Logger("Cards");
      logger.log("test");

      // styleText is called twice: once for the tag, once for the level
      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Cards]");
      expect(mockStyleText).toHaveBeenCalledWith("cyan", "INFO");
    });

    it("info() should use styleText with 'cyan' for INFO level", () => {
      const logger = new Logger("Cards");
      logger.info("test");

      expect(mockStyleText).toHaveBeenCalledWith("cyan", "INFO");
      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Cards]");
    });

    it("warn() should use styleText with 'yellow' for WARN level", () => {
      const logger = new Logger("Cards");
      logger.warn("test");

      expect(mockStyleText).toHaveBeenCalledWith("yellow", "WARN");
      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Cards]");
    });

    it("error() should use styleText with 'red' for ERROR level", () => {
      const logger = new Logger("Cards");
      logger.error("test");

      expect(mockStyleText).toHaveBeenCalledWith("red", "ERROR");
      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Cards]");
    });

    it("debug() should use styleText with 'gray' for DEBUG level", () => {
      const logger = new Logger("Cards");
      logger.debug("test");

      expect(mockStyleText).toHaveBeenCalledWith("gray", "DEBUG");
      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Cards]");
    });

    it("should include both styled level and tag in the formatted prefix", () => {
      const logger = new Logger("MyModule");
      logger.log("hello");

      const prefix = consoleSpy.log.mock.calls[0][0] as string;
      // Our mock returns [styled:TEXT], so the prefix should contain both
      expect(prefix).toContain("[styled:INFO]");
      expect(prefix).toContain("[styled:[MyModule]]");
    });
  });

  // ─── Dynamic isPackaged toggling ───────────────────────────────────────────

  describe("dynamic isPackaged toggling", () => {
    it("should respond to isPackaged changing at runtime", () => {
      const logger = new Logger("Dynamic");

      // Start in dev mode
      mockIsPackaged.value = false;
      logger.log("dev message");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1);

      // Switch to production mode
      mockIsPackaged.value = true;
      logger.log("prod message");
      expect(consoleSpy.log).toHaveBeenCalledTimes(1); // still 1, not 2

      // Switch back to dev mode
      mockIsPackaged.value = false;
      logger.log("dev again");
      expect(consoleSpy.log).toHaveBeenCalledTimes(2);
    });
  });

  // ─── Tag in output ─────────────────────────────────────────────────────────

  describe("tag handling", () => {
    beforeEach(() => {
      mockIsPackaged.value = false;
    });

    it("should include the tag name in the styleText call", () => {
      const logger = new Logger("DivinationCards");
      logger.log("test");

      expect(mockStyleText).toHaveBeenCalledWith(
        "magenta",
        "[DivinationCards]",
      );
    });

    it("different loggers should use their own tag", () => {
      const logger1 = new Logger("Alpha");
      const logger2 = new Logger("Beta");

      logger1.log("from alpha");
      logger2.log("from beta");

      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Alpha]");
      expect(mockStyleText).toHaveBeenCalledWith("magenta", "[Beta]");
    });
  });
});

// ─── LoggerService ─────────────────────────────────────────────────────────────

describe("LoggerService", () => {
  afterEach(() => {
    // Clear the internal cache between tests by accessing the private map
    // We use type assertion to access the private static field for testing
    (LoggerService as any).loggers.clear();
  });

  describe("createLogger", () => {
    it("should return a Logger instance", () => {
      const logger = LoggerService.createLogger("Test");
      expect(logger).toBeInstanceOf(Logger);
    });

    it("should return the same instance for the same tag", () => {
      const a = LoggerService.createLogger("Singleton");
      const b = LoggerService.createLogger("Singleton");
      expect(a).toBe(b);
    });

    it("should return different instances for different tags", () => {
      const a = LoggerService.createLogger("TagA");
      const b = LoggerService.createLogger("TagB");
      expect(a).not.toBe(b);
    });

    it("should cache multiple loggers independently", () => {
      const first = LoggerService.createLogger("First");
      const second = LoggerService.createLogger("Second");
      const third = LoggerService.createLogger("Third");

      expect(LoggerService.createLogger("First")).toBe(first);
      expect(LoggerService.createLogger("Second")).toBe(second);
      expect(LoggerService.createLogger("Third")).toBe(third);
    });

    it("should treat tags as case-sensitive", () => {
      const lower = LoggerService.createLogger("test");
      const upper = LoggerService.createLogger("Test");
      expect(lower).not.toBe(upper);
    });

    it("should handle empty string as a valid tag", () => {
      const logger = LoggerService.createLogger("");
      expect(logger).toBeInstanceOf(Logger);

      // Calling again should return the same instance
      expect(LoggerService.createLogger("")).toBe(logger);
    });

    it("should handle tags with special characters", () => {
      const logger = LoggerService.createLogger("my-module/sub:component");
      expect(logger).toBeInstanceOf(Logger);
      expect(LoggerService.createLogger("my-module/sub:component")).toBe(
        logger,
      );
    });
  });
});
