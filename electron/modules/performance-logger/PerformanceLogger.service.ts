type PerformanceLogContext = {
  [key: string]: string | number | boolean | undefined;
};

class PerformanceLoggerService {
  private static _instance: PerformanceLoggerService;
  private enabled: boolean;

  static getInstance() {
    if (!PerformanceLoggerService._instance) {
      PerformanceLoggerService._instance = new PerformanceLoggerService();
    }

    return PerformanceLoggerService._instance;
  }

  constructor() {
    // Check for PERF_DEBUG environment variable
    this.enabled = process.env.PERF_DEBUG === "true";

    if (this.enabled) {
      console.log("[PERF LOGGER] Performance logging enabled");
    }
  }

  /**
   * Check if performance logging is enabled
   */
  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Log a performance message with optional context
   */
  public log(message: string, context?: PerformanceLogContext): void {
    if (!this.enabled) {
      return;
    }

    if (context) {
      const contextStr = Object.entries(context)
        .map(([key, value]) => {
          if (typeof value === "number") {
            return `${key}: ${value.toFixed(2)}ms`;
          }
          return `${key}: ${value}`;
        })
        .join(" | ");

      console.log(`[PERF] ${message} | ${contextStr}`);
    } else {
      console.log(`[PERF] ${message}`);
    }
  }

  /**
   * Start a timer and return a function to log the elapsed time
   */
  public startTimer(label: string): (context?: PerformanceLogContext) => void {
    if (!this.enabled) {
      // Return a no-op function when disabled
      return () => {};
    }

    const start = performance.now();

    return (context?: PerformanceLogContext) => {
      const duration = performance.now() - start;
      this.log(label, { ...context, duration });
    };
  }

  /**
   * Start multiple named timers and return an object to end each one
   */
  public startTimers(): {
    start: (name: string) => void;
    end: (name: string) => number;
    log: (message: string, timings: Record<string, number>) => void;
  } {
    if (!this.enabled) {
      // Return no-op functions when disabled
      return {
        start: () => {},
        end: () => 0,
        log: () => {},
      };
    }

    const timers = new Map<string, number>();

    return {
      start: (name: string) => {
        timers.set(name, performance.now());
      },
      end: (name: string) => {
        const start = timers.get(name);
        if (start === undefined) return 0;
        return performance.now() - start;
      },
      log: (message: string, timings: Record<string, number>) => {
        this.log(message, timings);
      },
    };
  }

  /**
   * Time a function execution and log the result
   */
  public async time<T>(
    label: string,
    fn: () => T | Promise<T>,
    context?: PerformanceLogContext,
  ): Promise<T> {
    if (!this.enabled) {
      return await fn();
    }

    const start = performance.now();
    const result = await fn();
    const duration = performance.now() - start;

    this.log(label, { ...context, duration });

    return result;
  }
}

export { PerformanceLoggerService, type PerformanceLogContext };
