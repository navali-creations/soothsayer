import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCaptureException, mockCaptureMessage, mockClose, mockInit } =
  vi.hoisted(() => ({
    mockCaptureException: vi.fn(),
    mockCaptureMessage: vi.fn(),
    mockClose: vi.fn(),
    mockInit: vi.fn(),
  }));

vi.mock("@sentry/electron/main", () => ({
  captureException: mockCaptureException,
  captureMessage: mockCaptureMessage,
  close: mockClose,
  init: mockInit,
}));

describe("Sentry reporter", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards initialization and closing to the SDK", async () => {
    mockClose.mockResolvedValue(true);
    const { closeSentry, initSentry } = await import("../Sentry.reporter");

    await initSentry({ dsn: "test-dsn" });
    await expect(closeSentry(250)).resolves.toBe(true);

    expect(mockInit).toHaveBeenCalledWith({ dsn: "test-dsn" });
    expect(mockClose).toHaveBeenCalledWith(250);
  });

  it("forwards exception and message reports asynchronously", async () => {
    const { captureSentryException, captureSentryMessage } = await import(
      "../Sentry.reporter"
    );
    const error = new Error("boom");

    captureSentryException(error, { level: "error" });
    captureSentryMessage("hello", "warning");
    await vi.waitFor(() => {
      expect(mockCaptureException).toHaveBeenCalledWith(error, {
        level: "error",
      });
      expect(mockCaptureMessage).toHaveBeenCalledWith("hello", "warning");
    });
  });
});
