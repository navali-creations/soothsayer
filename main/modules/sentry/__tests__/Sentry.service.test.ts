import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockSentryInit,
  mockSentryClose,
  mockAppGetVersion,
  mockAppIsPackaged,
} = vi.hoisted(() => ({
  mockSentryInit: vi.fn(),
  mockSentryClose: vi.fn().mockResolvedValue(undefined),
  mockAppGetVersion: vi.fn().mockReturnValue("0.6.0"),
  mockAppIsPackaged: { value: false },
}));

// ─── Mock @sentry/electron/main ─────────────────────────────────────────────
vi.mock("@sentry/electron/main", () => ({
  init: mockSentryInit,
  close: mockSentryClose,
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

// ─── Mock package.json ──────────────────────────────────────────────────────
vi.mock("../../../package.json", () => ({
  default: { version: "0.12.0" },
}));

/** Matches `soothsayer@<semver>` — asserts the format, not a specific version. */
const RELEASE_PATTERN = expect.stringMatching(/^soothsayer@\d+\.\d+\.\d+$/);

// ─── Import under test (after mocks) ────────────────────────────────────────
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

import {
  SentryService,
  scrubBreadcrumbData,
  scrubPaths,
} from "../Sentry.service";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("SentryService", () => {
  let service: SentryService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAppGetVersion.mockReturnValue("0.6.0");
    mockAppIsPackaged.value = false;

    // Reset singleton so each test gets a fresh instance
    resetSingleton(SentryService);
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

    it("should call Sentry.init with DSN, release, environment, and PII scrubbing callbacks", () => {
      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledTimes(1);
      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: import.meta.env.VITE_SENTRY_DSN,
          release: RELEASE_PATTERN,
          environment: "development",
          sendDefaultPii: false,
          beforeSend: expect.any(Function),
          beforeBreadcrumb: expect.any(Function),
        }),
      );
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

    it("should use the version from package.json in the release", () => {
      service.initialize();

      expect(mockSentryInit).toHaveBeenCalledWith(
        expect.objectContaining({
          release: RELEASE_PATTERN,
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

  // ─── disable ────────────────────────────────────────────────────────────

  describe("disable", () => {
    beforeEach(() => {
      service = SentryService.getInstance();
    });

    it("should call Sentry.close and set disabled to true when initialized", async () => {
      service.initialize();
      expect(service.isDisabled()).toBe(false);

      await service.disable();

      expect(mockSentryClose).toHaveBeenCalledWith(2000);
      expect(service.isDisabled()).toBe(true);
    });

    it("should not call Sentry.close if not initialized", async () => {
      await service.disable();

      expect(mockSentryClose).not.toHaveBeenCalled();
      expect(service.isDisabled()).toBe(false);
    });

    it("should not call Sentry.close if already disabled", async () => {
      service.initialize();
      await service.disable();
      vi.clearAllMocks();

      await service.disable();

      expect(mockSentryClose).not.toHaveBeenCalled();
    });

    it("should remain initialized after disable (only disabled flag changes)", async () => {
      service.initialize();
      await service.disable();

      expect(service.isInitialized()).toBe(true);
      expect(service.isDisabled()).toBe(true);
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
      resetSingleton(SentryService);

      // New instance should be uninitialized
      const second = SentryService.getInstance();
      expect(second.isInitialized()).toBe(false);
      expect(second).not.toBe(first);
    });

    it("should allow re-initialization on a new instance after singleton reset", () => {
      const first = SentryService.getInstance();
      first.initialize();

      resetSingleton(SentryService);
      vi.clearAllMocks();

      const second = SentryService.getInstance();
      expect(second.isInitialized()).toBe(false);

      second.initialize();
      expect(second.isInitialized()).toBe(true);
      expect(mockSentryInit).toHaveBeenCalledTimes(1);
    });
  });
});

// ─── PII Scrubbing Unit Tests ─────────────────────────────────────────────

describe("scrubPaths", () => {
  it("should scrub Windows paths containing a username", () => {
    const input =
      "ERR_FAILED (-2) loading 'file:///C:\\Users\\SomeUser\\AppData\\Local\\soothsayer\\index.html'";
    const result = scrubPaths(input);

    expect(result).not.toContain("SomeUser");
    expect(result).toContain("soothsayer");
    expect(result).toContain("**");
  });

  it("should scrub Unix home paths", () => {
    const input = "Error at /home/john/projects/soothsayer/dist/main.js:42:10";
    const result = scrubPaths(input);

    expect(result).not.toContain("john");
    expect(result).toContain("soothsayer");
    expect(result).toContain("**");
  });

  it("should scrub macOS paths under /Users", () => {
    const input =
      "Loading /Users/alice/Library/Application Support/soothsayer/data.db";
    const result = scrubPaths(input);

    expect(result).not.toContain("alice");
    expect(result).toContain("soothsayer");
  });

  it("should scrub multiple paths in the same string", () => {
    const input =
      "Opened C:\\Users\\Bob\\AppData\\Roaming\\soothsayer\\config.json and C:\\Users\\Bob\\AppData\\Local\\Path of Exile\\logs\\Client.txt";
    const result = scrubPaths(input);

    expect(result).not.toContain("Bob");
    expect(result).toContain("soothsayer");
    expect(result).toContain("Path of Exile");
  });

  it("should return text unchanged when no paths are present", () => {
    const input = "This is a normal error message with no paths";
    expect(scrubPaths(input)).toBe(input);
  });

  it("should handle path with Path of Exile 2 anchor", () => {
    const input =
      "Reading C:\\Users\\Player\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt";
    const result = scrubPaths(input);

    expect(result).not.toContain("Player");
    expect(result).toContain("Path of Exile 2");
  });

  it("should handle empty string", () => {
    expect(scrubPaths("")).toBe("");
  });
});

describe("scrubBreadcrumbData", () => {
  it("should scrub string values containing paths", () => {
    const data = {
      url: "file:///C:\\Users\\TestUser\\AppData\\Local\\soothsayer\\index.html",
      status: 200,
    };

    const result = scrubBreadcrumbData(data);

    expect(result.url).not.toContain("TestUser");
    expect(result.status).toBe(200);
  });

  it("should scrub string items in arrays", () => {
    const data = {
      arguments: [
        "[Init] Database location: C:\\Users\\SomeUser\\AppData\\Roaming\\soothsayer\\soothsayer.db",
        "normal string",
        42,
      ],
    };

    const result = scrubBreadcrumbData(data);
    const args = result.arguments as unknown[];

    expect(args[0]).not.toContain("SomeUser");
    expect(args[0]).toContain("soothsayer");
    expect(args[1]).toBe("normal string");
    expect(args[2]).toBe(42);
  });

  it("should pass through non-string, non-array values unchanged", () => {
    const data = {
      count: 5,
      flag: true,
      nested: { key: "value" },
    };

    const result = scrubBreadcrumbData(data);

    expect(result.count).toBe(5);
    expect(result.flag).toBe(true);
    expect(result.nested).toEqual({ key: "value" });
  });

  it("should handle empty data object", () => {
    const result = scrubBreadcrumbData({});
    expect(result).toEqual({});
  });
});

// ─── beforeSend / beforeBreadcrumb Integration Tests ─────────────────────

describe("Sentry callbacks (beforeSend / beforeBreadcrumb)", () => {
  let beforeSend: (event: any) => any;
  let beforeBreadcrumb: (breadcrumb: any) => any;

  beforeEach(() => {
    vi.clearAllMocks();
    resetSingleton(SentryService);

    const service = SentryService.getInstance();
    service.initialize();

    const initCall = mockSentryInit.mock.calls[0][0];
    beforeSend = initCall.beforeSend;
    beforeBreadcrumb = initCall.beforeBreadcrumb;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("beforeSend", () => {
    it("should scrub exception values containing paths", () => {
      const event = {
        exception: {
          values: [
            {
              type: "Error",
              value:
                "ERR_FAILED (-2) loading 'file:///C:\\Users\\SomeUser\\AppData\\Local\\soothsayer\\index.html'",
            },
          ],
        },
      };

      const result = beforeSend(event);

      expect(result.exception.values[0].value).not.toContain("SomeUser");
      expect(result.exception.values[0].value).toContain("soothsayer");
    });

    it("should scrub stack frame filenames and abs_path", () => {
      const event = {
        exception: {
          values: [
            {
              type: "Error",
              value: "some error",
              stacktrace: {
                frames: [
                  {
                    filename:
                      "C:\\Users\\SomeUser\\AppData\\Local\\soothsayer\\main.js",
                    abs_path:
                      "C:\\Users\\SomeUser\\AppData\\Local\\soothsayer\\main.js",
                    lineno: 42,
                  },
                  {
                    filename: "internal/node.js",
                    lineno: 10,
                  },
                ],
              },
            },
          ],
        },
      };

      const result = beforeSend(event);
      const frames = result.exception.values[0].stacktrace.frames;

      expect(frames[0].filename).not.toContain("SomeUser");
      expect(frames[0].abs_path).not.toContain("SomeUser");
      expect(frames[0].filename).toContain("soothsayer");
      // Frame without abs_path should be untouched
      expect(frames[1].filename).toBe("internal/node.js");
    });

    it("should scrub breadcrumbs attached to the event", () => {
      const event = {
        breadcrumbs: [
          {
            message:
              "[Init] Database location: C:\\Users\\TestUser\\AppData\\Roaming\\soothsayer\\soothsayer.db",
            data: {
              url: "file:///C:\\Users\\TestUser\\AppData\\Local\\soothsayer\\index.html",
            },
          },
          {
            message: "User clicked button",
          },
        ],
      };

      const result = beforeSend(event);

      expect(result.breadcrumbs[0].message).not.toContain("TestUser");
      expect(result.breadcrumbs[0].data.url).not.toContain("TestUser");
      expect(result.breadcrumbs[1].message).toBe("User clicked button");
    });

    it("should return the event even when it has no exception or breadcrumbs", () => {
      const event = { message: "simple message" };
      const result = beforeSend(event);
      expect(result).toEqual(event);
    });

    it("should handle exception with no stacktrace", () => {
      const event = {
        exception: {
          values: [
            {
              type: "Error",
              value: "C:\\Users\\User\\AppData\\Local\\soothsayer\\crash.txt",
            },
          ],
        },
      };

      const result = beforeSend(event);
      expect(result.exception.values[0].value).not.toContain("User\\AppData");
    });
  });

  describe("beforeBreadcrumb", () => {
    it("should scrub breadcrumb message containing paths", () => {
      const breadcrumb = {
        message:
          "Loading C:\\Users\\SomeUser\\AppData\\Local\\soothsayer\\renderer.js",
        category: "console",
      };

      const result = beforeBreadcrumb(breadcrumb);

      expect(result.message).not.toContain("SomeUser");
      expect(result.message).toContain("soothsayer");
      expect(result.category).toBe("console");
    });

    it("should scrub breadcrumb data", () => {
      const breadcrumb = {
        category: "console",
        data: {
          arguments: [
            "C:\\Users\\TestUser\\AppData\\Roaming\\soothsayer\\log.txt",
          ],
        },
      };

      const result = beforeBreadcrumb(breadcrumb);
      const args = result.data.arguments as string[];

      expect(args[0]).not.toContain("TestUser");
      expect(args[0]).toContain("soothsayer");
    });

    it("should return breadcrumb unchanged when no paths are present", () => {
      const breadcrumb = {
        message: "Just a normal breadcrumb",
        category: "ui.click",
      };

      const result = beforeBreadcrumb(breadcrumb);
      expect(result.message).toBe("Just a normal breadcrumb");
    });

    it("should handle breadcrumb with no message or data", () => {
      const breadcrumb = {
        category: "navigation",
        timestamp: 1234567890,
      };

      const result = beforeBreadcrumb(breadcrumb);
      expect(result).toEqual(breadcrumb);
    });
  });
});
