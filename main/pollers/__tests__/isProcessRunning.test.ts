import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock for child_process ──────────────────────────────────────────
const { mockExecFile } = vi.hoisted(() => ({
  mockExecFile: vi.fn(),
}));

vi.mock("node:child_process", () => ({
  execFile: mockExecFile,
}));

// ─── Import under test ──────────────────────────────────────────────────────
import { isProcessRunning } from "../isProcessRunning";

describe("isProcessRunning", () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Restore platform
    Object.defineProperty(process, "platform", { value: originalPlatform });
    vi.restoreAllMocks();
  });

  function setPlatform(platform: string) {
    Object.defineProperty(process, "platform", { value: platform });
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // Platform-specific command selection
  // ═══════════════════════════════════════════════════════════════════════════
  describe("platform-specific commands", () => {
    it("should use tasklist on win32", async () => {
      setPlatform("win32");
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          expect(cmd).toBe("tasklist");
          expect(args).toEqual([]);
          cb(null, "");
        },
      );

      await isProcessRunning("test.exe");
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("should use ps -ax on darwin", async () => {
      setPlatform("darwin");
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          expect(cmd).toBe("ps");
          expect(args).toEqual(["-ax"]);
          cb(null, "");
        },
      );

      await isProcessRunning("test");
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });

    it("should use ps -A on linux", async () => {
      setPlatform("linux");
      mockExecFile.mockImplementation(
        (
          cmd: string,
          args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          expect(cmd).toBe("ps");
          expect(args).toEqual(["-A"]);
          cb(null, "");
        },
      );

      await isProcessRunning("test");
      expect(mockExecFile).toHaveBeenCalledTimes(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unsupported platform
  // ═══════════════════════════════════════════════════════════════════════════
  describe("unsupported platform", () => {
    it("should return false on unsupported platform", async () => {
      setPlatform("freebsd");
      const result = await isProcessRunning("test");
      expect(result).toBe(false);
      expect(mockExecFile).not.toHaveBeenCalled();
    });

    it("should return false on aix platform", async () => {
      setPlatform("aix");
      const result = await isProcessRunning("someprocess");
      expect(result).toBe(false);
      expect(mockExecFile).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Process detection
  // ═══════════════════════════════════════════════════════════════════════════
  describe("process detection", () => {
    beforeEach(() => {
      setPlatform("win32");
    });

    it("should return true when process is found in output", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(
            null,
            [
              "Image Name                     PID Session Name        Session#    Mem Usage",
              "========================= ======== ================ =========== ============",
              "System Idle Process              0 Services                   0          8 K",
              "PathOfExile.exe              12345 Console                    1    512,000 K",
              "explorer.exe                  2468 Console                    1     80,000 K",
            ].join("\n"),
          );
        },
      );

      const result = await isProcessRunning("PathOfExile.exe");
      expect(result).toBe(true);
    });

    it("should return false when process is not found in output", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(
            null,
            [
              "Image Name                     PID Session Name        Session#    Mem Usage",
              "========================= ======== ================ =========== ============",
              "System Idle Process              0 Services                   0          8 K",
              "explorer.exe                  2468 Console                    1     80,000 K",
            ].join("\n"),
          );
        },
      );

      const result = await isProcessRunning("PathOfExile.exe");
      expect(result).toBe(false);
    });

    it("should return false when output is empty", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(null, "");
        },
      );

      const result = await isProcessRunning("PathOfExile.exe");
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Case-insensitive matching
  // ═══════════════════════════════════════════════════════════════════════════
  describe("case-insensitive matching", () => {
    beforeEach(() => {
      setPlatform("win32");
    });

    it("should match process name case-insensitively (lowercase query)", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(null, "PathOfExile.exe    12345 Console   1    512,000 K");
        },
      );

      const result = await isProcessRunning("pathofexile.exe");
      expect(result).toBe(true);
    });

    it("should match process name case-insensitively (uppercase query)", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(null, "pathofexile.exe    12345 Console   1    512,000 K");
        },
      );

      const result = await isProcessRunning("PATHOFEXILE.EXE");
      expect(result).toBe(true);
    });

    it("should match process name case-insensitively (mixed case)", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(null, "PATHOFEXILE.EXE    12345 Console   1    512,000 K");
        },
      );

      const result = await isProcessRunning("PathOfExile.exe");
      expect(result).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Error handling
  // ═══════════════════════════════════════════════════════════════════════════
  describe("error handling", () => {
    beforeEach(() => {
      setPlatform("win32");
    });

    it("should return false when execFile returns an error", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(new Error("Command failed"), "");
        },
      );

      const result = await isProcessRunning("test.exe");
      expect(result).toBe(false);
      consoleSpy.mockRestore();
    });

    it("should log a warning when execFile fails", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const error = new Error("quota exceeded");
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(error, "");
        },
      );

      await isProcessRunning("myprocess.exe");

      expect(consoleSpy).toHaveBeenCalledTimes(1);
      expect(consoleSpy).toHaveBeenCalledWith(
        '[isProcessRunning] Failed to check process "myprocess.exe":',
        "quota exceeded",
      );

      consoleSpy.mockRestore();
    });

    it("should handle errors gracefully during system sleep/hibernation", async () => {
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(new Error("ENOMEM: not enough memory"), "");
        },
      );

      const result = await isProcessRunning("PathOfExile.exe");
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Partial / substring matching
  // ═══════════════════════════════════════════════════════════════════════════
  describe("substring matching", () => {
    beforeEach(() => {
      setPlatform("win32");
    });

    it("should match when process name is a substring of output", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(null, "PathOfExileSteam.exe    12345 Console   1    512,000 K");
        },
      );

      // "PathOfExile" is a substring of "PathOfExileSteam.exe"
      const result = await isProcessRunning("PathOfExile");
      expect(result).toBe(true);
    });

    it("should not match when process name is not a substring", async () => {
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(null, "explorer.exe    2468 Console   1    80,000 K");
        },
      );

      const result = await isProcessRunning("PathOfExile");
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Cross-platform tests with darwin/linux
  // ═══════════════════════════════════════════════════════════════════════════
  describe("cross-platform detection", () => {
    it("should detect process on darwin (ps -ax output)", async () => {
      setPlatform("darwin");
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(
            null,
            [
              "  PID TTY           TIME CMD",
              "    1 ??         5:32.45 /sbin/launchd",
              "  123 ??         0:01.23 /Applications/PathOfExile.app/Contents/MacOS/PathOfExile",
              "  456 ??         0:00.50 /usr/sbin/syslogd",
            ].join("\n"),
          );
        },
      );

      const result = await isProcessRunning("PathOfExile");
      expect(result).toBe(true);
    });

    it("should return false when process not found on linux", async () => {
      setPlatform("linux");
      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(
            null,
            [
              "  PID TTY          TIME CMD",
              "    1 ?        00:00:05 systemd",
              "  200 ?        00:00:01 sshd",
            ].join("\n"),
          );
        },
      );

      const result = await isProcessRunning("PathOfExile");
      expect(result).toBe(false);
    });

    it("should handle error on darwin gracefully", async () => {
      setPlatform("darwin");
      const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      mockExecFile.mockImplementation(
        (
          _cmd: string,
          _args: string[],
          cb: (err: Error | null, stdout: string) => void,
        ) => {
          cb(new Error("ps: operation not permitted"), "");
        },
      );

      const result = await isProcessRunning("PathOfExile");
      expect(result).toBe(false);
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
