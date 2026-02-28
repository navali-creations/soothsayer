import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const { mockSentryInit, mockAppGetVersion, mockAppIsPackaged } = vi.hoisted(
  () => ({
    mockSentryInit: vi.fn(),
    mockAppGetVersion: vi.fn().mockReturnValue("0.6.0"),
    mockAppIsPackaged: { value: false },
  }),
);

// ─── Mock @sentry/electron/main ─────────────────────────────────────────────
vi.mock("@sentry/electron/main", () => ({
  init: mockSentryInit,
}));

// ─── Mock electron ──────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  app: {
    getVersion: mockAppGetVersion,
    get isPackaged() {
      return mockAppIsPackaged.value;
    },
  },
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { SentryService } from "../Sentry.service";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SentryService", () => {
  let service: SentryService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppGetVersion.mockReturnValue("0.6.0");
    mockAppIsPackaged.value = false;

    // Reset singleton so each test gets a fresh instance
    // @ts-expect-error — accessing private static for testing
    SentryService._instance = undefined;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = SentryService.getInstance();
      const b = SentryService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      const instance = SentryService.getInstance();
      expect(instance).toBeInstanceOf(SentryService);
    });
  });

  // ─── isInitialized ──────────────────────────────────────────────────────

  describe("isInitialized", () => {
    it("should return false before initialize is called", () => {
      service = SentryService.getInstance();
      expect(service.isInitialized()).toBe(false);
    });

    it("should return true after initialize is called", () => {
      service = SentryService.getInstance();
      service.initialize();
      expect(service.isInitialized()).toBe(true);
    });
  });

  // ─── initialize ─────────────────────────────────────────────────────────

  describe("initialize", () => {
    beforeEach(() => {
      service = SentryService.getInstance();
    });

    it("should call Sentry.init with DSN, release, and environment", () => {
      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledTimes(1);
      expect(mockSentryInit).toHaveBeenCalledWith({
        dsn: import.meta.env.VITE_SENTRY_DSN,
        release: "soothsayer@0.6.0",
        environment: "development",
      });
    });

    it("should set environment to 'production' when app is packaged", () => {
      mockAppIsPackaged.value = true;

      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "production",
        }),
      );
    });

    it("should set environment to 'development' when app is not packaged", () => {
      mockAppIsPackaged.value = false;

      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: "development",
        }),
      );
    });

    it("should use the version from app.getVersion() in the release", () => {
      mockAppGetVersion.mockReturnValue("1.2.3");

      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          release: "soothsayer@1.2.3",
        }),
      );
    });

    it("should only call Sentry.init once even if initialize is called multiple times", () => {
      service.initialize();
      service.initialize();
      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledTimes(1);
    });

    it("should set isInitialized to true after first call", () => {
      expect(service.isInitialized()).toBe(false);
      service.initialize();
      expect(service.isInitialized()).toBe(true);
    });

    it("should remain initialized after multiple calls", () => {
      service.initialize();
      service.initialize();
      expect(service.isInitialized()).toBe(true);
    });
  });

  // ─── Fresh instance after singleton reset ────────────────────────────────

  describe("fresh instance behavior", () => {
    it("should start uninitialized after singleton reset", () => {
      // Initialize first instance
      const first = SentryService.getInstance();
      first.initialize();
      expect(first.isInitialized()).toBe(true);

      // Reset singleton
      // @ts-expect-error — accessing private static for testing
      SentryService._instance = undefined;

      // New instance should be uninitialized
      const second = SentryService.getInstance();
      expect(second.isInitialized()).toBe(false);
      expect(second).not.toBe(first);
    });

    it("should allow re-initialization on a new instance after singleton reset", () => {
      const first = SentryService.getInstance();
      first.initialize();

      // @ts-expect-error — accessing private static for testing
      SentryService._instance = undefined;
      vi.clearAllMocks();

      const second = SentryService.getInstance();
      expect(second.isInitialized()).toBe(false);

      second.initialize();
      expect(second.isInitialized()).toBe(true);
      expect(mockSentryInit).toHaveBeenCalledTimes(1);
    });
  });
});
