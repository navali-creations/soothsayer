import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getIpcHandler } from "~/main/modules/__test-utils__/mock-factories";
import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";

const {
  mockAppendFileSync,
  mockIpcHandle,
  mockShowItemInFolder,
  mockClearDiagLog,
  mockGetLogPath,
} = vi.hoisted(() => ({
  mockAppendFileSync: vi.fn(),
  mockIpcHandle: vi.fn(),
  mockShowItemInFolder: vi.fn(),
  mockClearDiagLog: vi.fn(),
  mockGetLogPath: vi.fn(() => "C:\\logs\\diag.log"),
}));

vi.mock("node:fs", () => ({
  appendFileSync: mockAppendFileSync,
}));

vi.mock("electron", () => ({
  ipcMain: {
    handle: mockIpcHandle,
  },
  shell: {
    showItemInFolder: mockShowItemInFolder,
  },
}));

vi.mock("~/main/utils/diag-log", () => ({
  clearDiagLog: mockClearDiagLog,
  getLogPath: mockGetLogPath,
}));

import { DiagLogChannel } from "../DiagLog.channels";
import { DiagLogService } from "../DiagLog.service";

const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
};

describe("DiagLogService", () => {
  beforeEach(() => {
    resetSingleton(DiagLogService);
    vi.clearAllMocks();
    console.log = vi.fn();
    console.warn = vi.fn();
    console.error = vi.fn();
  });

  afterEach(() => {
    console.log = originalConsole.log;
    console.warn = originalConsole.warn;
    console.error = originalConsole.error;
    resetSingleton(DiagLogService);
  });

  it("initializes once, clears the log, and registers its IPC handler", () => {
    const service = DiagLogService.getInstance();

    expect(DiagLogService.getInstance()).toBe(service);
    expect(mockClearDiagLog).toHaveBeenCalledOnce();
    expect(mockIpcHandle).toHaveBeenCalledWith(
      DiagLogChannel.RevealLogFile,
      expect.any(Function),
    );
  });

  it("mirrors console levels while redacting secrets and JWTs", () => {
    DiagLogService.getInstance();

    console.log("plain");
    console.warn({ password: "secret", nested: { access_token: "token" } });
    console.error("eyJheader.eyJpayload.signature", { harmless: true });

    expect(mockAppendFileSync).toHaveBeenCalledTimes(3);
    expect(mockAppendFileSync.mock.calls[0][1]).toContain("[LOG] plain");
    expect(mockAppendFileSync.mock.calls[1][1]).toContain(
      '"password":"[REDACTED]"',
    );
    expect(mockAppendFileSync.mock.calls[1][1]).toContain(
      '"access_token":"[REDACTED]"',
    );
    expect(mockAppendFileSync.mock.calls[2][1]).toContain("[JWT_REDACTED]");
  });

  it("serializes circular values safely and filters Electron noise", () => {
    DiagLogService.getInstance();
    const circular: Record<string, unknown> = {};
    circular.self = circular;

    console.log(circular);
    expect(mockAppendFileSync.mock.calls[0][1]).toContain("[object Object]");

    mockAppendFileSync.mockClear();
    console.warn("ExtensionLoadWarning from Electron");
    expect(mockAppendFileSync).not.toHaveBeenCalled();
  });

  it("caps the log and ignores later writes", () => {
    const service = DiagLogService.getInstance() as unknown as {
      _bytesWritten: number;
    };
    service._bytesWritten = 1_048_576;

    console.log("trigger cap");
    console.log("ignored");

    expect(mockAppendFileSync).toHaveBeenCalledOnce();
    expect(mockAppendFileSync.mock.calls[0][1]).toContain("[LOG CAPPED]");
  });

  it("never lets append failures escape through console calls", () => {
    DiagLogService.getInstance();
    mockAppendFileSync.mockImplementation(() => {
      throw new Error("disk unavailable");
    });

    expect(() => console.error("safe failure")).not.toThrow();
  });

  it("reveals the log file and returns a safe failure result", async () => {
    DiagLogService.getInstance();
    const handler = getIpcHandler(mockIpcHandle, DiagLogChannel.RevealLogFile);

    await expect(handler({})).resolves.toEqual({
      success: true,
      path: "C:\\logs\\diag.log",
    });
    expect(mockShowItemInFolder).toHaveBeenCalledWith("C:\\logs\\diag.log");

    mockShowItemInFolder.mockImplementationOnce(() => {
      throw new Error("shell unavailable");
    });
    await expect(handler({})).resolves.toEqual({
      success: false,
      path: "C:\\logs\\diag.log",
    });
  });
});
