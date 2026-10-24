import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createPoeProcessSnapshot,
  createStoppedPoeProcessStates,
  type PoeProcessSnapshot,
} from "../PoeProcess.dto";

const {
  mockAssertTrustedSender,
  mockIpcHandle,
  mockPowerMonitorOn,
  mockWatcherOn,
  mockWatcherPollSnapshot,
  mockWatcherStart,
  mockWatcherStop,
  mockWebContentsSend,
} = vi.hoisted(() => ({
  mockAssertTrustedSender: vi.fn(),
  mockIpcHandle: vi.fn(),
  mockPowerMonitorOn: vi.fn(),
  mockWatcherOn: vi.fn(),
  mockWatcherPollSnapshot: vi.fn(),
  mockWatcherStart: vi.fn(),
  mockWatcherStop: vi.fn(),
  mockWebContentsSend: vi.fn(),
}));

vi.mock("electron", () => ({
  app: { isPackaged: false },
  ipcMain: { handle: mockIpcHandle },
  powerMonitor: { on: mockPowerMonitorOn },
}));

vi.mock("~/main/pollers/PoeProcessWatcher", () => ({
  PoeProcessWatcher: class MockPoeProcessWatcher {
    on = mockWatcherOn;
    pollSnapshot = mockWatcherPollSnapshot;
    start = mockWatcherStart;
    stop = mockWatcherStop;
  },
}));

vi.mock("~/main/utils/ipc-validation", () => ({
  assertTrustedSender: mockAssertTrustedSender,
}));

import { resetSingleton } from "~/main/modules/__test-utils__/singleton-helper";
import type { MainWindowService } from "~/main/modules/main-window";

import { PoeProcessService } from "../PoeProcess.service";

function getRegisteredListener<T extends (...args: never[]) => unknown>(
  registerMock: ReturnType<typeof vi.fn>,
  event: string,
): T {
  const call = registerMock.mock.calls.find(([name]) => name === event);
  if (!call) throw new Error(`No listener registered for ${event}`);
  return call[1] as T;
}

function getIpcHandler(
  channel: string,
): (event: unknown) => Promise<PoeProcessSnapshot> {
  const call = mockIpcHandle.mock.calls.find(([name]) => name === channel);
  if (!call) throw new Error(`No IPC handler registered for ${channel}`);
  return call[1];
}

function createMainWindow(): MainWindowService {
  return {
    getWebContents: () => ({
      isDestroyed: () => false,
      send: mockWebContentsSend,
    }),
  } as unknown as MainWindowService;
}

function createRunningSnapshot(game: "poe1" | "poe2"): PoeProcessSnapshot {
  const states = createStoppedPoeProcessStates();
  states[game] = {
    game,
    isRunning: true,
    pid: game === "poe1" ? 101 : 202,
    processName: game === "poe1" ? "PathOfExile.exe" : "PathOfExile2.exe",
    windowTitle: game === "poe1" ? "Path of Exile" : "Path of Exile 2",
  };
  return createPoeProcessSnapshot(states, "watching");
}

describe("PoeProcessService", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWatcherPollSnapshot.mockReturnValue(createPoeProcessSnapshot());
    resetSingleton(PoeProcessService);
    PoeProcessService.getInstance();
  });

  it("registers snapshot, power, and IPC listeners", () => {
    expect(mockWatcherOn.mock.calls.map(([event]) => event)).toEqual([
      "data",
      "error",
    ]);
    expect(mockPowerMonitorOn.mock.calls.map(([event]) => event)).toEqual([
      "suspend",
      "resume",
      "lock-screen",
      "unlock-screen",
    ]);
    expect(mockIpcHandle.mock.calls.map(([channel]) => channel)).toEqual([
      "poe-process:get-snapshot",
    ]);
  });

  it("starts and stops the native watcher with the service", () => {
    const service = PoeProcessService.getInstance();
    service.initialize(createMainWindow());
    service.stop();
    expect(mockWatcherStart).toHaveBeenCalledOnce();
    expect(mockWatcherStop).toHaveBeenCalledOnce();
  });

  it("broadcasts only the renderer-safe process snapshot", () => {
    const service = PoeProcessService.getInstance();
    service.initialize(createMainWindow());
    const snapshot = createRunningSnapshot("poe2");

    getRegisteredListener<(value: PoeProcessSnapshot) => void>(
      mockWatcherOn,
      "data",
    )(snapshot);

    expect(mockWebContentsSend).toHaveBeenCalledOnce();
    expect(mockWebContentsSend).toHaveBeenCalledWith(
      "poe-process:snapshot-changed",
      snapshot,
    );
    expect(snapshot).toEqual({
      status: "watching",
      states: {
        poe1: { isRunning: false },
        poe2: { isRunning: true },
      },
    });
  });

  it("refreshes and returns the snapshot through trusted IPC", async () => {
    const snapshot = createRunningSnapshot("poe1");
    mockWatcherPollSnapshot.mockReturnValue(snapshot);
    const event = {};

    await expect(
      getIpcHandler("poe-process:get-snapshot")(event),
    ).resolves.toEqual(snapshot);
    expect(mockAssertTrustedSender).toHaveBeenCalledWith(
      event,
      "poe-process:get-snapshot",
    );
    expect(mockWatcherPollSnapshot).toHaveBeenCalledOnce();
  });

  it("clears and broadcasts process state while suspended", () => {
    const service = PoeProcessService.getInstance();
    service.initialize(createMainWindow());
    getRegisteredListener<(value: PoeProcessSnapshot) => void>(
      mockWatcherOn,
      "data",
    )(createRunningSnapshot("poe1"));
    mockWebContentsSend.mockClear();

    getRegisteredListener<() => void>(mockPowerMonitorOn, "suspend")();

    expect(mockWatcherStop).toHaveBeenCalledOnce();
    expect(mockWebContentsSend).toHaveBeenCalledOnce();
    expect(mockWebContentsSend).toHaveBeenCalledWith(
      "poe-process:snapshot-changed",
      createPoeProcessSnapshot(),
    );
  });

  it("restarts the watcher after resume when initialized", () => {
    const service = PoeProcessService.getInstance();
    service.initialize(createMainWindow());
    mockWatcherStart.mockClear();
    getRegisteredListener<() => void>(mockPowerMonitorOn, "suspend")();
    getRegisteredListener<() => void>(mockPowerMonitorOn, "resume")();
    expect(mockWatcherStart).toHaveBeenCalledOnce();
  });

  it("does not start while suspended or resume before initialization", () => {
    const service = PoeProcessService.getInstance();
    getRegisteredListener<() => void>(mockPowerMonitorOn, "suspend")();
    service.initialize(createMainWindow());
    expect(mockWatcherStart).not.toHaveBeenCalled();

    resetSingleton(PoeProcessService);
    vi.clearAllMocks();
    PoeProcessService.getInstance();
    getRegisteredListener<() => void>(mockPowerMonitorOn, "resume")();
    expect(mockWatcherStart).not.toHaveBeenCalled();
  });

  it("logs lock and unlock notifications", () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    getRegisteredListener<() => void>(mockPowerMonitorOn, "lock-screen")();
    getRegisteredListener<() => void>(mockPowerMonitorOn, "unlock-screen")();
    expect(log).toHaveBeenCalledWith("[PoeProcess] Screen locked");
    expect(log).toHaveBeenCalledWith("[PoeProcess] Screen unlocked");
  });

  it("logs helper errors without exposing them to the renderer", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const service = PoeProcessService.getInstance();
    service.initialize(createMainWindow());
    const failure = new Error("helper failed");

    getRegisteredListener<(error: Error) => void>(
      mockWatcherOn,
      "error",
    )(failure);

    expect(consoleError).toHaveBeenCalledWith(
      "PoE process watcher error:",
      failure,
    );
    expect(mockWebContentsSend).not.toHaveBeenCalled();
  });

  it("skips unavailable renderer targets", () => {
    const service = PoeProcessService.getInstance();
    const onData = getRegisteredListener<(value: PoeProcessSnapshot) => void>(
      mockWatcherOn,
      "data",
    );
    const snapshot = createRunningSnapshot("poe1");

    onData(snapshot);
    expect(mockWebContentsSend).not.toHaveBeenCalled();

    service.initialize({
      getWebContents: () => null,
    } as unknown as MainWindowService);
    onData(snapshot);
    expect(mockWebContentsSend).not.toHaveBeenCalled();

    service.initialize({
      getWebContents: () => ({ isDestroyed: () => true }),
    } as unknown as MainWindowService);
    onData(snapshot);
    expect(mockWebContentsSend).not.toHaveBeenCalled();
  });

  it.each([
    new Error("renderer unavailable"),
    "renderer unavailable",
  ])("normalizes renderer send failures", (failure) => {
    const warning = vi
      .spyOn(console, "warn")
      .mockImplementation(() => undefined);
    const service = PoeProcessService.getInstance();
    service.initialize({
      getWebContents: () => {
        throw failure;
      },
    } as unknown as MainWindowService);

    getRegisteredListener<(value: PoeProcessSnapshot) => void>(
      mockWatcherOn,
      "data",
    )(createRunningSnapshot("poe1"));

    expect(warning).toHaveBeenCalledWith(
      "[PoeProcess] Failed to send to renderer (poe-process:snapshot-changed):",
      "renderer unavailable",
    );
  });
});
