import { styleText } from "node:util";

import { app } from "electron";

type LogLevel = "debug" | "info" | "warn" | "error";
type StyleTextFormat = Parameters<typeof styleText>[0];

const LOG_LEVEL_COLORS: Record<LogLevel, StyleTextFormat> = {
  debug: "gray",
  info: "cyan",
  warn: "yellow",
  error: "red",
};

const TAG_COLOR: StyleTextFormat = "magenta";

class Logger {
  private readonly tag: string;

  constructor(tag: string) {
    this.tag = tag;
  }

  private isEnabled(): boolean {
    return !app.isPackaged;
  }

  private formatTag(level: LogLevel): string {
    const coloredTag = styleText(TAG_COLOR, `[${this.tag}]`);
    const coloredLevel = styleText(
      LOG_LEVEL_COLORS[level],
      level.toUpperCase(),
    );
    return `${coloredLevel} ${coloredTag}`;
  }

  /**
   * General-purpose log (maps to console.log).
   * Displayed only in development.
   */
  public log(...args: unknown[]): void {
    if (!this.isEnabled()) return;
    console.log(this.formatTag("info"), ...args);
  }

  /**
   * Informational message (maps to console.info).
   * Displayed only in development.
   */
  public info(...args: unknown[]): void {
    if (!this.isEnabled()) return;
    console.info(this.formatTag("info"), ...args);
  }

  /**
   * Warning message (maps to console.warn).
   * Displayed only in development.
   */
  public warn(...args: unknown[]): void {
    if (!this.isEnabled()) return;
    console.warn(this.formatTag("warn"), ...args);
  }

  /**
   * Error message (maps to console.error).
   * Displayed only in development.
   */
  public error(...args: unknown[]): void {
    if (!this.isEnabled()) return;
    console.error(this.formatTag("error"), ...args);
  }

  /**
   * Debug message (maps to console.debug).
   * Displayed only in development.
   */
  public debug(...args: unknown[]): void {
    if (!this.isEnabled()) return;
    console.debug(this.formatTag("debug"), ...args);
  }
}

/**
 * Singleton factory for creating tagged Logger instances.
 *
 * All output is gated behind `!app.isPackaged`, so logs are only
 * visible during development. Uses Node.js 22 `styleText` for
 * coloured terminal output.
 *
 * @example
 * ```ts
 * const logger = LoggerService.createLogger("DivinationCards");
 * logger.log("Initialized successfully");
 * logger.warn("No league selected");
 * logger.error("Failed to sync cards", error);
 * ```
 */
class LoggerService {
  private static loggers = new Map<string, Logger>();

  /**
   * Create (or retrieve) a Logger instance for the given tag.
   * Subsequent calls with the same tag return the same instance.
   */
  static createLogger(tag: string): Logger {
    let logger = LoggerService.loggers.get(tag);
    if (!logger) {
      logger = new Logger(tag);
      LoggerService.loggers.set(tag, logger);
    }
    return logger;
  }
}

export { Logger, LoggerService };
