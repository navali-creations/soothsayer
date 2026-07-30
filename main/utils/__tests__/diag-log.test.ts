import { join, resolve } from "node:path";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockAppendFileSync, mockMkdirSync, mockWriteFileSync, mockGetPath } =
  vi.hoisted(() => ({
    mockAppendFileSync: vi.fn(),
    mockMkdirSync: vi.fn(),
    mockWriteFileSync: vi.fn(),
    mockGetPath: vi.fn(),
  }));

const mockUserDataPath = resolve("mock-user-data");
const mockLogPath = join(mockUserDataPath, "diag.log");

vi.mock("node:fs", () => ({
  appendFileSync: mockAppendFileSync,
  mkdirSync: mockMkdirSync,
  writeFileSync: mockWriteFileSync,
}));

vi.mock("electron", () => ({
  app: {
    getPath: mockGetPath,
  },
}));

async function loadDiagLog() {
  vi.resetModules();
  return import("../diag-log");
}

describe("diagnostic log utilities", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPath.mockReturnValue(mockUserDataPath);
  });

  it("creates and caches the diagnostic log path", async () => {
    const { getLogPath } = await loadDiagLog();

    expect(getLogPath()).toBe(mockLogPath);
    expect(getLogPath()).toBe(mockLogPath);
    expect(mockGetPath).toHaveBeenCalledOnce();
    expect(mockMkdirSync).toHaveBeenCalledOnce();
  });

  it("clears the current log and ignores filesystem failures", async () => {
    const { clearDiagLog } = await loadDiagLog();

    clearDiagLog();
    expect(mockWriteFileSync).toHaveBeenCalledWith(mockLogPath, "", "utf-8");

    mockWriteFileSync.mockImplementationOnce(() => {
      throw new Error("disk unavailable");
    });
    expect(() => clearDiagLog()).not.toThrow();
  });

  it("appends timestamped messages and ignores filesystem failures", async () => {
    const { diagLog } = await loadDiagLog();

    diagLog("session started");
    expect(mockAppendFileSync).toHaveBeenCalledWith(
      mockLogPath,
      expect.stringMatching(/^\[\d{4}-\d{2}-\d{2}T.*Z\] session started\n$/),
      "utf-8",
    );

    mockAppendFileSync.mockImplementationOnce(() => {
      throw new Error("disk unavailable");
    });
    expect(() => diagLog("still safe")).not.toThrow();
  });
});
