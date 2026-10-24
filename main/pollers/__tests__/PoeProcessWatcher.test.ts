import type { spawn } from "node:child_process";
import EventEmitter from "node:events";
import { PassThrough } from "node:stream";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  type PoeProcessState,
} from "~/main/modules/poe-process/PoeProcess.dto";
import type { GameType } from "~/types/data-stores";

import { PoeProcessWatcher } from "../PoeProcessWatcher";

type SpawnResult = ReturnType<typeof spawn>;
type SpawnMockCall = [string, string[], unknown];
type HelperStateInput = {
  game: GameType;
  isRunning: boolean;
  pid?: number;
  processName?: string;
  windowTitle?: string;
};

const helperPath = "C:\\Soothsayer\\soothsayer-poe-process-helper.exe";
const helperDefaultsByGame: Record<
  GameType,
  { pid: number; processName: string; windowTitle: string }
> = {
  poe1: {
    pid: 10_001,
    processName: "PathOfExile.exe",
    windowTitle: "Path of Exile",
  },
  poe2: {
    pid: 20_002,
    processName: "PathOfExileSteam.exe",
    windowTitle: "Path of Exile 2",
  },
};

class FakeWatcherChild extends EventEmitter {
  readonly stderr = new PassThrough();
  readonly stdout = new PassThrough();
  readonly kill = vi.fn(() => {
    this.emit("exit", 0, null);
    return true;
  });
}

class LazyExitFakeWatcherChild extends FakeWatcherChild {
  override readonly kill = vi.fn(() => true);
}

class UnkillableFakeWatcherChild extends FakeWatcherChild {
  override readonly kill = vi.fn(() => false);
}

function createSpawnMock(child: FakeWatcherChild) {
  return vi.fn(() => child as unknown as SpawnResult);
}

function createSpawnSequenceMock(children: FakeWatcherChild[]) {
  let childIndex = 0;

  return vi.fn(() => {
    const child = children[childIndex];
    childIndex += 1;
    if (!child) {
      throw new Error("No fake helper child configured");
    }

    return child as unknown as SpawnResult;
  });
}

function createStoppedHelperStates(): HelperStateInput[] {
  return [
    { game: "poe1", isRunning: false, processName: "" },
    { game: "poe2", isRunning: false, processName: "" },
  ];
}

function createHelperStates(
  runningStates: Array<Omit<HelperStateInput, "isRunning">>,
): HelperStateInput[] {
  const states = createStoppedHelperStates();

  for (const runningState of runningStates) {
    const index = states.findIndex(({ game }) => game === runningState.game);
    states[index] = {
      ...runningState,
      isRunning: true,
      pid: runningState.pid ?? helperDefaultsByGame[runningState.game].pid,
      processName:
        runningState.processName ??
        helperDefaultsByGame[runningState.game].processName,
      windowTitle:
        runningState.windowTitle ??
        helperDefaultsByGame[runningState.game].windowTitle,
    };
  }

  return states;
}

function createExpectedSnapshot(
  _game: GameType,
  runningStates: Array<Omit<HelperStateInput, "isRunning">>,
) {
  const states = createStoppedPoeProcessStates();

  for (const runningState of createHelperStates(runningStates)) {
    states[runningState.game] = runningState.isRunning
      ? {
          game: runningState.game,
          isRunning: true,
          pid: runningState.pid ?? helperDefaultsByGame[runningState.game].pid,
          processName:
            runningState.processName ??
            helperDefaultsByGame[runningState.game].processName,
          windowTitle:
            runningState.windowTitle ??
            helperDefaultsByGame[runningState.game].windowTitle,
        }
      : {
          game: runningState.game,
          isRunning: false,
          processName: "",
        };
  }

  return createPoeProcessSnapshot(states, "watching");
}

function expectProcessStatus(
  watcher: PoeProcessWatcher,
  state: PoeProcessState,
): void {
  const snapshot = watcher.pollSnapshot();
  if (state.game) {
    expect(snapshot.states[state.game]).toEqual({
      isRunning: state.isRunning,
    });
    return;
  }

  expect(
    Object.values(snapshot.states).every(({ isRunning }) => !isRunning),
  ).toBe(true);
}

function expectProcessStateForGame(
  watcher: PoeProcessWatcher,
  game: GameType,
  state: PoeProcessState,
): void {
  const snapshot = watcher.pollSnapshot();

  expect(snapshot.states[game]).toEqual({ isRunning: state.isRunning });
}

function writeHelperState(
  child: FakeWatcherChild,
  states: HelperStateInput[],
): void {
  child.stdout.write(`${JSON.stringify({ type: "state", states })}\n`);
}

function writeRunningHelperState(
  child: FakeWatcherChild,
  runningStates: Array<Omit<HelperStateInput, "isRunning">>,
): void {
  writeHelperState(child, createHelperStates(runningStates));
}

function writeStoppedHelperState(child: FakeWatcherChild): void {
  writeHelperState(child, createStoppedHelperStates());
}

function writeHelperError(child: FakeWatcherChild, message: string): void {
  child.stdout.write(`${JSON.stringify({ type: "error", message })}\n`);
}

describe("PoeProcessWatcher", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("spawns the Windows helper and emits Rust-resolved state transitions", () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const data = vi.fn();
    watcher.on("data", data);

    watcher.start();

    expect(spawnProcess).toHaveBeenCalledWith(
      helperPath,
      [
        "--title",
        "Soothsayer PoE Process Watcher",
        "--parent-pid",
        String(process.pid),
      ],
      expect.objectContaining({
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      }),
    );
    const spawnArgs =
      (spawnProcess.mock.calls[0] as SpawnMockCall | undefined)?.[1] ?? [];
    expect(spawnArgs).not.toContain("-Command");

    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    expect(data).toHaveBeenLastCalledWith(
      createExpectedSnapshot("poe2", [
        {
          game: "poe2",
          processName: "PathOfExileSteam.exe",
        },
      ]),
    );
    writeStoppedHelperState(child);

    expect(data).toHaveBeenLastCalledWith(createExpectedSnapshot("poe2", []));

    watcher.stop();
    expect(child.kill).toHaveBeenCalledTimes(1);
  });

  it("does not spawn another helper when already started", () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });

    watcher.start();
    watcher.start();

    expect(spawnProcess).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("defaults to the current process platform", () => {
    const watcher = new PoeProcessWatcher();

    expect(watcher.pollSnapshot().status).toBe("stopped");
  });

  it("buffers partial helper stdout lines", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const data = vi.fn();
    watcher.on("data", data);
    watcher.start();

    child.stdout.write('{"type":"state","states":[');
    expect(data).not.toHaveBeenCalled();

    child.stdout.write(
      '{"game":"poe1","isRunning":true,"pid":1001,"processName":"PathOfExile.exe","windowTitle":"Path of Exile"},' +
        '{"game":"poe2","isRunning":false,"processName":""}]}\n',
    );

    expect(data).toHaveBeenCalledWith(
      createExpectedSnapshot("poe1", [
        {
          game: "poe1",
          pid: 1001,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
      ]),
    );
    watcher.stop();
  });

  it("returns the last helper state for refresh requests", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("keeps the helper active when native helper writes diagnostics to stderr", () => {
    const child = new FakeWatcherChild();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const data = vi.fn();
    const error = vi.fn();
    watcher.on("data", data);
    watcher.on("error", error);

    try {
      watcher.start();
      child.stderr.write("Access denied \n");
      writeRunningHelperState(child, [
        {
          game: "poe2",
          processName: "PathOfExileSteam.exe",
        },
      ]);

      expect(error).not.toHaveBeenCalled();
      expect(watcher.pollSnapshot().status).toBe("watching");
      expect(warn).toHaveBeenCalledWith(
        expect.stringContaining("PoE process watcher helper diagnostic"),
        expect.objectContaining({ message: "Access denied" }),
      );
      expect(data).toHaveBeenLastCalledWith(
        createExpectedSnapshot("poe2", [
          {
            game: "poe2",
            processName: "PathOfExileSteam.exe",
          },
        ]),
      );
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("limits repeated native helper diagnostic logs", () => {
    const child = new FakeWatcherChild();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });

    try {
      watcher.start();
      child.stderr.write("first warning\n");
      child.stderr.write("second warning\n");
      child.stderr.write("third warning\n");
      child.stderr.write("fourth warning\n");

      expect(warn).toHaveBeenCalledTimes(3);
      expect(warn).not.toHaveBeenCalledWith(
        expect.stringContaining("PoE process watcher helper diagnostic"),
        expect.objectContaining({ message: "fourth warning" }),
      );
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("ignores empty native helper diagnostics", () => {
    const child = new FakeWatcherChild();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });

    try {
      watcher.start();
      child.stderr.write("   \n");

      expect(warn).not.toHaveBeenCalled();
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("keeps the helper active on heartbeat messages", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    child.stdout.write(`${JSON.stringify({ type: "heartbeat" })}\n`);

    expect(error).not.toHaveBeenCalled();
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("ignores blank helper stdout lines", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    child.stdout.write("\n");

    expect(error).not.toHaveBeenCalled();
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("exposes both game statuses from Rust-resolved helper states", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    expectProcessStateForGame(watcher, "poe2", {
      game: "poe2",
      isRunning: true,
      pid: 20_002,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    });
    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("returns stopped for a game that Rust marked inactive", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    expectProcessStateForGame(watcher, "poe2", {
      game: "poe2",
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("reads helper snapshots without emitting watcher events", async () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const data = vi.fn();
    watcher.on("data", data);
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    data.mockClear();

    expectProcessStateForGame(watcher, "poe2", {
      game: "poe2",
      isRunning: true,
      pid: 20_002,
      processName: "PathOfExileSteam.exe",
      windowTitle: "Path of Exile 2",
    });

    expect(data).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("resolves helper snapshots without exposing helper process details", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    watcher.start();
    writeRunningHelperState(child, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    expect(watcher.pollSnapshot()).toEqual({
      status: "watching",
      states: {
        poe1: { isRunning: false },
        poe2: { isRunning: true },
      },
    });
    watcher.stop();
  });

  it("restarts the Windows helper when it exits unexpectedly", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();
    writeRunningHelperState(firstChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    firstChild.emit("exit", 1, null);

    expectProcessStateForGame(watcher, "poe1", {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("helper exited"),
      }),
    );
    expect(watcher.pollSnapshot().status).toBe("watching");

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expectProcessStateForGame(watcher, "poe1", {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("includes helper stderr and signal when it exits unexpectedly", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    child.stderr.write("native detail\n");
    child.emit("exit", null, "SIGTERM");

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message:
          "PoE process watcher helper exited with code null and signal SIGTERM; stderr: native detail",
      }),
    );
    watcher.stop();
  });

  it("restarts the Windows helper when it emits an error payload", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(watcher.pollSnapshot().status).toBe("watching");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "subscription failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("uses the fallback error message when helper error payload message is invalid", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    firstChild.stdout.write(
      `${JSON.stringify({ type: "error", message: 42 })}\n`,
    );

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PoE process watcher helper failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("reports a native helper spawn failure", () => {
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: vi.fn(() => {
        throw new Error("spawn failed");
      }),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "spawn failed",
      }),
    );
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("reports a non-error native helper spawn failure", () => {
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: vi.fn(() => {
        throw "spawn failed";
      }),
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();

    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "PoE process watcher helper failed to start",
      }),
    );
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("restarts the Windows helper when the helper process emits an error", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    firstChild.emit("error", new Error("process failed"));

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "process failed",
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("disables restarts when a failed helper cannot be terminated", () => {
    const child = new UnkillableFakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    watcher.on("error", vi.fn());

    watcher.start();
    writeHelperError(child, "subscription failed");

    expect(child.kill).toHaveBeenCalledOnce();
    expect(spawnProcess).toHaveBeenCalledOnce();
    expect(watcher.pollSnapshot()).toEqual({
      status: "unavailable",
      states: {
        poe1: { isRunning: false },
        poe2: { isRunning: false },
      },
    });
    expect(warning).toHaveBeenCalledWith(
      expect.stringContaining("could not be terminated"),
    );
    watcher.stop();
  });

  it("cancels a pending helper restart when stopped", async () => {
    vi.useFakeTimers();
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    watcher.on("error", vi.fn());

    watcher.start();
    writeHelperError(child, "subscription failed");
    watcher.stop();
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(1);
    expect(watcher.pollSnapshot().status).toBe("stopped");
  });

  it("restarts the Windows helper when it emits an unknown payload type", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    firstChild.stdout.write(`${JSON.stringify({ type: "unknown" })}\n`);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("unknown payload type"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when it does not emit initial state", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    expect(watcher.pollSnapshot().status).toBe("watching");
    await vi.advanceTimersByTimeAsync(3_000);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(watcher.pollSnapshot().status).toBe("watching");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("initial state"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when health updates stop after initial state", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeStoppedHelperState(firstChild);
    await vi.advanceTimersByTimeAsync(45_000);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stopped sending health updates"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("marks the Windows helper unavailable after bounded restart failures", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const thirdChild = new FakeWatcherChild();
    const fourthChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([
      firstChild,
      secondChild,
      thirdChild,
      fourthChild,
    ]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeHelperError(secondChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(2_000);
    writeHelperError(thirdChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(4_000);
    writeHelperError(fourthChild, "subscription failed");

    expect(spawnProcess).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalledTimes(4);
    expect(watcher.pollSnapshot().status).toBe("unavailable");
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("does not reset the helper restart budget for immediate state-then-crash loops", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const thirdChild = new FakeWatcherChild();
    const fourthChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([
      firstChild,
      secondChild,
      thirdChild,
      fourthChild,
    ]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeRunningHelperState(firstChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    firstChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    secondChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(2_000);
    writeRunningHelperState(thirdChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    thirdChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(4_000);
    writeRunningHelperState(fourthChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    fourthChild.emit("exit", 1, null);

    expect(spawnProcess).toHaveBeenCalledTimes(4);
    expect(error).toHaveBeenCalledTimes(4);
    expect(watcher.pollSnapshot().status).toBe("unavailable");
    watcher.stop();
  });

  it("resets the helper restart budget after a stable heartbeat window", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const thirdChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([
      firstChild,
      secondChild,
      thirdChild,
    ]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    await vi.advanceTimersByTimeAsync(30_000);
    secondChild.stdout.write(`${JSON.stringify({ type: "heartbeat" })}\n`);
    secondChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(3);
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("ignores stale exits from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    firstChild.emit("exit", 1, null);
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("ignores stale errors from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);

    firstChild.emit("error", new Error("late process error"));
    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });

  it("ignores stale stdout from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const data = vi.fn();
    const error = vi.fn();
    watcher.on("data", data);
    watcher.on("error", error);

    watcher.start();
    writeHelperError(firstChild, "subscription failed");
    await vi.advanceTimersByTimeAsync(1_000);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    data.mockClear();

    writeRunningHelperState(firstChild, [
      {
        game: "poe2",
        processName: "PathOfExileSteam.exe",
      },
    ]);

    expect(data).not.toHaveBeenCalled();
    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    expect(spawnProcess).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(1);
    watcher.stop();
  });

  it("ignores stale stderr from a helper that was already replaced", async () => {
    vi.useFakeTimers();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const firstChild = new LazyExitFakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);

    try {
      watcher.start();
      writeHelperError(firstChild, "subscription failed");
      await vi.advanceTimersByTimeAsync(1_000);
      writeRunningHelperState(secondChild, [
        {
          game: "poe1",
          processName: "PathOfExile.exe",
        },
      ]);
      warn.mockClear();

      firstChild.stderr.write("Access denied \n");

      expect(warn).not.toHaveBeenCalled();
      expect(spawnProcess).toHaveBeenCalledTimes(2);
      expect(error).toHaveBeenCalledTimes(1);
    } finally {
      watcher.stop();
      warn.mockRestore();
    }
  });

  it("kills the helper from process-exit cleanup", () => {
    const child = new FakeWatcherChild();
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess: createSpawnMock(child),
    });
    const processOnce = vi.spyOn(process, "once");
    const processOff = vi.spyOn(process, "off");

    try {
      watcher.start();
      const cleanup = processOnce.mock.calls.find(
        ([event]) => event === "exit",
      )?.[1] as (() => void) | undefined;

      expect(cleanup).toBeDefined();
      cleanup?.();

      expect(child.kill).toHaveBeenCalledTimes(1);
      expect(processOff).toHaveBeenCalledWith("exit", cleanup);
      expect(watcher.pollSnapshot().status).toBe("stopped");
    } finally {
      watcher.stop();
      processOnce.mockRestore();
      processOff.mockRestore();
    }
  });

  it("restarts the Windows helper when stdout line size is exceeded", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write("{".repeat(20_000));

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(watcher.pollSnapshot().status).toBe("watching");
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stdout line was too large"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when a completed stdout line is too large", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write(`${"{".repeat(20_000)}\n`);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("stdout line was too large"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when a state payload is malformed", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write(`${JSON.stringify({ type: "state" })}\n`);

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("invalid state payload"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeRunningHelperState(secondChild, [
      {
        game: "poe1",
        processName: "PathOfExile.exe",
      },
    ]);
    expectProcessStatus(watcher, {
      game: "poe1",
      isRunning: true,
      pid: 10_001,
      processName: "PathOfExile.exe",
      windowTitle: "Path of Exile",
    });
    watcher.stop();
  });

  it("uses the fallback error when state normalization throws a non-error", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    const badState = new Proxy(
      {},
      {
        get() {
          throw "state failed";
        },
      },
    );
    const parse = vi.spyOn(JSON, "parse").mockReturnValue({
      states: [badState],
      type: "state",
    });
    watcher.on("error", error);

    try {
      watcher.start();
      firstChild.stdout.write("state\n");

      expect(firstChild.kill).toHaveBeenCalledTimes(1);
      expect(error).toHaveBeenCalledWith(
        expect.objectContaining({
          message: "PoE process watcher helper emitted invalid state payload",
        }),
      );
    } finally {
      parse.mockRestore();
    }

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when it emits invalid JSON", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write("{not-json}\n");

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("invalid JSON"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("restarts the Windows helper when JSON is valid but not a protocol object", async () => {
    vi.useFakeTimers();
    const firstChild = new FakeWatcherChild();
    const secondChild = new FakeWatcherChild();
    const spawnProcess = createSpawnSequenceMock([firstChild, secondChild]);
    const watcher = new PoeProcessWatcher({
      helperPath,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    firstChild.stdout.write("null\n");

    expect(firstChild.kill).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("invalid JSON payload"),
      }),
    );

    await vi.advanceTimersByTimeAsync(1_000);

    expect(spawnProcess).toHaveBeenCalledTimes(2);
    writeStoppedHelperState(secondChild);
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("marks the Windows helper unavailable when the native helper executable is missing", async () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher({
      pathExists: () => false,
      platform: "win32",
      spawnProcess,
    });
    const error = vi.fn();
    watcher.on("error", error);
    watcher.start();

    expect(spawnProcess).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("helper executable was not found"),
      }),
    );
    expect(watcher.pollSnapshot().status).toBe("unavailable");
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("marks the watcher unavailable outside Windows and Linux", async () => {
    const watcher = new PoeProcessWatcher({
      platform: "darwin",
    });

    watcher.start();

    expect(watcher.pollSnapshot().status).toBe("unavailable");
    expectProcessStatus(watcher, {
      isRunning: false,
      processName: "",
    });
    watcher.stop();
  });

  it("runs the native helper on Linux", () => {
    const child = new FakeWatcherChild();
    const spawnProcess = createSpawnMock(child);
    const watcher = new PoeProcessWatcher({
      helperPath: "/opt/soothsayer/soothsayer-poe-process-helper",
      platform: "linux",
      spawnProcess,
    });

    watcher.start();

    expect(spawnProcess).toHaveBeenCalledOnce();
    expect(watcher.pollSnapshot().status).toBe("watching");
    watcher.stop();
  });
});
