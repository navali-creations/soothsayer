import {
  type ChildProcess,
  type SpawnOptions,
  spawn,
} from "node:child_process";
import EventEmitter from "node:events";
import { existsSync } from "node:fs";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  type PoeProcessSnapshot,
  type PoeProcessStatesByGame,
  type PoeProcessWatcherStatus,
} from "~/main/modules/poe-process/PoeProcess.dto";

import {
  HELPER_PROCESS_TITLE,
  type PathExists,
  resolvePoeProcessHelperPath,
} from "./PoeProcessHelperPath";
import {
  createHelperExitMessage,
  HELPER_STDOUT_LINE_MAX_CHARS,
  normalizeHelperProcessStates,
  type PoeProcessWatcherPayload,
} from "./PoeProcessHelperProtocol";

type PoeProcessWatcherChild = ChildProcess;
type SpawnProcess = (
  command: string,
  args: string[],
  options: SpawnOptions,
) => PoeProcessWatcherChild;
interface PoeProcessWatcherOptions {
  helperPath?: string | null;
  isPackaged?: boolean;
  pathExists?: PathExists;
  platform?: NodeJS.Platform;
  spawnProcess?: SpawnProcess;
}

const HELPER_INITIAL_STATE_TIMEOUT_MS = 3_000;
const HELPER_MESSAGE_TIMEOUT_MS = 45_000;
const HELPER_RESTART_BASE_DELAY_MS = 1_000;
const HELPER_RESTART_MAX_DELAY_MS = 10_000;
const HELPER_MAX_RESTART_ATTEMPTS = 3;
const HELPER_RESTART_STABLE_MS = 30_000;
const HELPER_DIAGNOSTIC_LOG_LIMIT = 3;
class PoeProcessWatcher extends EventEmitter {
  private readonly helperPath: string | null | undefined;
  private readonly isPackaged: boolean;
  private readonly pathExists: PathExists;
  private readonly platform: NodeJS.Platform;
  private readonly spawnProcess: SpawnProcess;
  private helper: PoeProcessWatcherChild | null = null;
  private helperDiagnosticLogCount = 0;
  private helperHasState = false;
  private helperHealthTimeout: NodeJS.Timeout | null = null;
  private helperRestartAttempts = 0;
  private helperRestartTimeout: NodeJS.Timeout | null = null;
  private helperStartedAtMs = 0;
  private helperStderrBuffer = "";
  private helperStates: PoeProcessStatesByGame | null = null;
  private status: PoeProcessWatcherStatus = "stopped";
  private readonly processExitCleanup = () => {
    this.stop();
  };
  private running = false;
  private stdoutBuffer = "";

  constructor(options: PoeProcessWatcherOptions = {}) {
    super();
    this.helperPath = options.helperPath;
    this.isPackaged = options.isPackaged ?? false;
    this.pathExists = options.pathExists ?? existsSync;
    this.platform = options.platform ?? process.platform;
    this.spawnProcess = options.spawnProcess ?? spawn;
  }

  start(): void {
    if (this.running) {
      return;
    }

    this.running = true;
    this.helperRestartAttempts = 0;
    this.helperStartedAtMs = 0;
    this.registerProcessExitCleanup();
    if (this.platform !== "win32" && this.platform !== "linux") {
      this.markHelperUnavailable();
      return;
    }

    this.startHelper();
  }

  stop(): void {
    if (!this.running) {
      return;
    }

    this.running = false;
    this.unregisterProcessExitCleanup();
    this.clearHelperRestartTimeout();
    this.stopHelper();
    this.helperStderrBuffer = "";
    this.helperRestartAttempts = 0;
    this.helperDiagnosticLogCount = 0;
    this.status = "stopped";
    this.helperStates = null;
    this.stdoutBuffer = "";
  }

  pollSnapshot(): PoeProcessSnapshot {
    return this.resolveSnapshotFromHelperStates();
  }

  private startHelper(): void {
    this.clearHelperRestartTimeout();
    const command = this.resolveHelperPath();
    if (!command) {
      this.emit(
        "error",
        new Error("PoE process watcher helper executable was not found"),
      );
      this.markHelperUnavailable();
      return;
    }

    try {
      const helper = this.spawnProcess(
        command,
        ["--title", HELPER_PROCESS_TITLE, "--parent-pid", String(process.pid)],
        {
          stdio: ["ignore", "pipe", "pipe"],
          windowsHide: true,
        },
      );
      this.helper = helper;
      this.helperDiagnosticLogCount = 0;
      this.helperHasState = false;
      this.helperStartedAtMs = Date.now();
      this.helperStderrBuffer = "";
      this.status = "watching";
      this.armHelperHealthTimeout(HELPER_INITIAL_STATE_TIMEOUT_MS);
      this.setupHelperListeners(helper);
    } catch (error) {
      this.handleHelperFailure(
        error instanceof Error
          ? error
          : new Error("PoE process watcher helper failed to start"),
      );
    }
  }

  private resolveHelperPath(): string | null {
    if (this.helperPath !== undefined) {
      return this.helperPath;
    }

    return resolvePoeProcessHelperPath({
      isPackaged: this.isPackaged,
      pathExists: this.pathExists,
      platform: this.platform,
    });
  }

  private setupHelperListeners(helper: PoeProcessWatcherChild): void {
    helper.stdout?.setEncoding("utf8");
    helper.stdout?.on("data", (chunk: string | Buffer) => {
      if (this.helper !== helper) {
        return;
      }

      this.handleHelperStdout(String(chunk));
    });
    helper.stderr?.setEncoding("utf8");
    helper.stderr?.on("data", (chunk: string | Buffer) => {
      if (this.helper !== helper) {
        return;
      }

      this.appendHelperStderr(String(chunk));
    });
    helper.once("error", (error) => {
      if (this.helper !== helper) {
        return;
      }

      this.handleHelperFailure(error);
    });
    helper.once("exit", (code, signal) => {
      if (this.helper !== helper) {
        return;
      }

      this.helper = null;
      this.clearHelperHealthTimeout();
      this.emit(
        "error",
        new Error(
          createHelperExitMessage(code, signal, this.consumeHelperStderr()),
        ),
      );
      this.scheduleHelperRestartOrMarkUnavailable();
    });
  }

  private stopHelper(): boolean {
    this.clearHelperHealthTimeout();
    if (!this.helper) {
      return true;
    }

    const helper = this.helper;
    this.helper = null;
    const terminated = helper.kill();
    if (!terminated) {
      console.warn(
        "[PoeProcess] PoE process watcher helper could not be terminated; automatic restart disabled",
      );
    }

    return terminated;
  }

  private handleHelperFailure(error: Error): void {
    const helperTerminated = this.stopHelper();
    this.emit("error", error);
    if (!helperTerminated) {
      this.markHelperUnavailable();
      return;
    }
    this.scheduleHelperRestartOrMarkUnavailable();
  }

  private scheduleHelperRestartOrMarkUnavailable(): void {
    this.clearHelperHealthTimeout();
    this.clearHelperRestartTimeout();
    this.stdoutBuffer = "";
    if (this.helperRestartAttempts >= HELPER_MAX_RESTART_ATTEMPTS) {
      this.markHelperUnavailable();
      return;
    }

    const attempt = this.helperRestartAttempts + 1;
    const delayMs = Math.min(
      HELPER_RESTART_BASE_DELAY_MS * 2 ** (attempt - 1),
      HELPER_RESTART_MAX_DELAY_MS,
    );
    this.helperRestartAttempts = attempt;
    this.status = "watching";
    this.helperRestartTimeout = setTimeout(() => {
      this.helperRestartTimeout = null;
      this.startHelper();
    }, delayMs);
    this.helperRestartTimeout.unref?.();
  }

  private armHelperHealthTimeout(timeoutMs: number): void {
    this.clearHelperHealthTimeout();
    this.helperHealthTimeout = setTimeout(() => {
      const message = this.helperHasState
        ? "PoE process watcher helper stopped sending health updates"
        : "PoE process watcher helper did not emit an initial state";
      this.handleHelperFailure(new Error(message));
    }, timeoutMs);
    this.helperHealthTimeout.unref?.();
  }

  private clearHelperHealthTimeout(): void {
    if (!this.helperHealthTimeout) {
      return;
    }

    clearTimeout(this.helperHealthTimeout);
    this.helperHealthTimeout = null;
  }

  private clearHelperRestartTimeout(): void {
    if (!this.helperRestartTimeout) {
      return;
    }

    clearTimeout(this.helperRestartTimeout);
    this.helperRestartTimeout = null;
  }

  private appendHelperStderr(chunk: string): void {
    const message = chunk.trim();
    if (message.length === 0) {
      return;
    }

    this.helperStderrBuffer = `${this.helperStderrBuffer}\n${message}`
      .trim()
      .slice(-1_024);

    this.logHelperDiagnostic(message);
  }

  private consumeHelperStderr(): string {
    const message = this.helperStderrBuffer;
    this.helperStderrBuffer = "";

    return message;
  }

  private registerProcessExitCleanup(): void {
    process.once("exit", this.processExitCleanup);
  }

  private unregisterProcessExitCleanup(): void {
    process.off("exit", this.processExitCleanup);
  }

  private handleHelperStdout(chunk: string): void {
    this.stdoutBuffer += chunk;
    const lines = this.stdoutBuffer.split(/\r?\n/);
    this.stdoutBuffer = lines.pop()!;
    if (this.stdoutBuffer.length > HELPER_STDOUT_LINE_MAX_CHARS) {
      this.handleHelperFailure(
        new Error("PoE process watcher helper stdout line was too large"),
      );
      return;
    }

    for (const line of lines) {
      if (line.length > HELPER_STDOUT_LINE_MAX_CHARS) {
        this.handleHelperFailure(
          new Error("PoE process watcher helper stdout line was too large"),
        );
        return;
      }
      if (!this.handleHelperLine(line)) {
        return;
      }
    }
  }

  private handleHelperLine(line: string): boolean {
    const trimmedLine = line.trim();
    if (trimmedLine.length === 0) {
      return true;
    }

    let parsedPayload: unknown;
    try {
      parsedPayload = JSON.parse(trimmedLine) as unknown;
    } catch {
      this.handleHelperFailure(
        new Error("PoE process watcher helper emitted invalid JSON"),
      );
      return false;
    }
    if (
      typeof parsedPayload !== "object" ||
      parsedPayload === null ||
      Array.isArray(parsedPayload)
    ) {
      this.handleHelperFailure(
        new Error("PoE process watcher helper emitted invalid JSON payload"),
      );
      return false;
    }

    const payload = parsedPayload as PoeProcessWatcherPayload;

    if (payload.type === "error") {
      this.handleHelperFailure(
        new Error(
          typeof payload.message === "string"
            ? payload.message
            : "PoE process watcher helper failed",
        ),
      );
      return false;
    }

    if (payload.type === "heartbeat") {
      this.resetHelperRestartAttemptsIfStable();
      this.armHelperHealthTimeout(HELPER_MESSAGE_TIMEOUT_MS);
      return true;
    }

    if (payload.type !== "state") {
      this.handleHelperFailure(
        new Error("PoE process watcher helper emitted unknown payload type"),
      );
      return false;
    }

    this.helperHasState = true;
    this.resetHelperRestartAttemptsIfStable();
    this.armHelperHealthTimeout(HELPER_MESSAGE_TIMEOUT_MS);
    try {
      this.helperStates = normalizeHelperProcessStates(payload.states);
    } catch (error) {
      this.handleHelperFailure(
        error instanceof Error
          ? error
          : new Error(
              "PoE process watcher helper emitted invalid state payload",
            ),
      );
      return false;
    }
    this.emit("data", this.resolveSnapshotFromHelperStates());
    return true;
  }

  private logHelperDiagnostic(message: string): void {
    if (this.helperDiagnosticLogCount >= HELPER_DIAGNOSTIC_LOG_LIMIT) {
      return;
    }

    this.helperDiagnosticLogCount += 1;
    console.warn("[PoeProcess] PoE process watcher helper diagnostic", {
      message,
      watcherStatus: this.status,
    });
  }

  private resetHelperRestartAttemptsIfStable(): void {
    if (this.helperRestartAttempts === 0) {
      return;
    }

    if (Date.now() - this.helperStartedAtMs >= HELPER_RESTART_STABLE_MS) {
      this.helperRestartAttempts = 0;
    }
  }

  private resolveSnapshotFromHelperStates(): PoeProcessSnapshot {
    return createPoeProcessSnapshot(
      this.helperStates ?? createStoppedPoeProcessStates(),
      this.status,
    );
  }

  private markHelperUnavailable(): void {
    this.clearHelperRestartTimeout();
    this.status = "unavailable";
    this.helperHasState = false;
    this.helperStates = null;
    this.stdoutBuffer = "";
    this.forceStoppedState();
  }

  private forceStoppedState(): void {
    const stoppedSnapshot = this.resolveSnapshotFromHelperStates();
    this.emit("data", stoppedSnapshot);
  }
}

export type { PoeProcessWatcherOptions };
export { PoeProcessWatcher };
