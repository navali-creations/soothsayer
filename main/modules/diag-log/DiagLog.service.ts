import { appendFileSync } from "node:fs";
import { homedir } from "node:os";

import { ipcMain, shell } from "electron";

import { clearDiagLog, getLogPath } from "../../utils/diag-log";
import { DiagLogChannel } from "./DiagLog.channels";

const NOISE_FILTERS = [
  "ExtensionLoadWarning",
  "'session.getAllExtensions' is deprecated",
  "'session.loadExtension' is deprecated",
  "electron --trace-warnings",
];

const REDACT_KEYS = new Set([
  "access_token",
  "refresh_token",
  "apikey",
  "authorization",
  "password",
  "secret",
  "token",
  "key",
]);

const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g;

const MAX_LOG_BYTES = 1_048_576; // 1 MB

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function redactUserPaths(message: string): string {
  const userHome = homedir();
  const serializedHome = userHome.replaceAll("\\", "\\\\");
  return message
    .replace(new RegExp(escapeRegExp(userHome), "gi"), "[USER_HOME]")
    .replace(new RegExp(escapeRegExp(serializedHome), "gi"), "[USER_HOME]")
    .replace(/C:(?:\\\\|\\)Users(?:\\\\|\\)[^\\/"\s]+/gi, "[USER_HOME]")
    .replace(/\/(?:Users|home)\/[^/"\s]+/g, "[USER_HOME]");
}

class DiagLogService {
  private static _instance: DiagLogService;

  private _bytesWritten = 0;
  private _capped = false;

  static getInstance(): DiagLogService {
    if (!DiagLogService._instance) {
      DiagLogService._instance = new DiagLogService();
    }
    return DiagLogService._instance;
  }

  private constructor() {
    clearDiagLog();
    this.patchConsole();
    this.setupHandlers();
  }

  private patchConsole(): void {
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    console.log = (...args: unknown[]) => {
      originalLog.apply(console, args);
      this.appendToLog("LOG", args);
    };

    console.warn = (...args: unknown[]) => {
      originalWarn.apply(console, args);
      this.appendToLog("WARN", args);
    };

    console.error = (...args: unknown[]) => {
      originalError.apply(console, args);
      this.appendToLog("ERROR", args);
    };
  }

  private appendToLog(level: string, args: unknown[]): void {
    try {
      if (this._capped) {
        return;
      }

      if (this._bytesWritten >= MAX_LOG_BYTES) {
        const capLine = `[${new Date().toISOString()}] [LOG CAPPED]\n`;
        appendFileSync(getLogPath(), capLine, "utf-8");
        this._bytesWritten += Buffer.byteLength(capLine, "utf-8");
        this._capped = true;
        return;
      }

      const message = redactUserPaths(
        args
          .map((a) => {
            if (typeof a === "string") return a;
            try {
              const serializableValue =
                a instanceof Error
                  ? {
                      ...a,
                      name: a.name,
                      message: a.message,
                      stack: a.stack,
                    }
                  : a;

              return JSON.stringify(serializableValue, (key, value) => {
                if (
                  key &&
                  typeof value === "string" &&
                  REDACT_KEYS.has(key.toLowerCase())
                ) {
                  return "[REDACTED]";
                }
                return value;
              });
            } catch {
              return String(a);
            }
          })
          .join(" ")
          .replace(JWT_PATTERN, "[JWT_REDACTED]"),
      );

      if (NOISE_FILTERS.some((filter) => message.includes(filter))) {
        return;
      }

      const line = `[${new Date().toISOString()}] [${level}] ${message}\n`;
      const lineBytes = Buffer.byteLength(line, "utf-8");
      appendFileSync(getLogPath(), line, "utf-8");
      this._bytesWritten += lineBytes;
    } catch {
      // Best-effort — never crash the app for a diagnostic log
    }
  }

  private setupHandlers(): void {
    ipcMain.handle(
      DiagLogChannel.RevealLogFile,
      async (): Promise<{ success: boolean; path: string }> => {
        try {
          const logPath = getLogPath();
          shell.showItemInFolder(logPath);
          return { success: true, path: logPath };
        } catch (error) {
          console.error("[DiagLog] Failed to reveal log file:", error);
          return { success: false, path: getLogPath() };
        }
      },
    );
  }
}

export { DiagLogService };
