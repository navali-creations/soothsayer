import { describe, expect, it } from "vitest";

import {
  createHelperExitMessage,
  normalizeHelperProcessStates,
} from "../PoeProcessHelperProtocol";

describe("PoE process helper protocol", () => {
  it("normalizes a complete game-aware state payload", () => {
    expect(
      normalizeHelperProcessStates([
        {
          game: "poe1",
          isRunning: false,
          processName: "",
        },
        {
          game: "poe2",
          isRunning: true,
          pid: 42,
          processName: "PathOfExileSteam.exe",
          windowTitle: "Path of Exile 2",
        },
      ]),
    ).toEqual({
      poe1: {
        game: "poe1",
        isRunning: false,
        processName: "",
      },
      poe2: {
        game: "poe2",
        isRunning: true,
        pid: 42,
        processName: "PathOfExileSteam.exe",
        windowTitle: "Path of Exile 2",
      },
    });
  });

  it.each([
    [{}, "invalid state payload"],
    [[null], "invalid state entry"],
    [
      [
        { game: "poe3", isRunning: false, processName: "" },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid game id",
    ],
    [
      [
        { game: "poe1", isRunning: false, processName: "" },
        { game: "poe1", isRunning: false, processName: "" },
      ],
      "duplicate game state",
    ],
    [
      [
        { game: "poe1", isRunning: "yes", processName: "" },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid running state",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: true,
          pid: -1,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid process id",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: true,
          processName: "PathOfExile.exe",
          windowTitle: "Path of Exile",
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "missing process id",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: true,
          pid: 1,
          processName: " ",
          windowTitle: "Path of Exile",
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid process name",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: true,
          pid: 1,
          processName: 42,
          windowTitle: "Path of Exile",
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid process name",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: false,
          processName: "",
          windowTitle: 42,
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid window title",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: true,
          pid: 1,
          processName: "PathOfExile.exe",
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid window title",
    ],
    [
      [
        {
          game: "poe1",
          isRunning: true,
          pid: 1,
          processName: "PathOfExile.exe",
          windowTitle: "",
        },
        { game: "poe2", isRunning: false, processName: "" },
      ],
      "invalid window title",
    ],
    [
      [{ game: "poe1", isRunning: false, processName: "" }],
      "incomplete state payload",
    ],
  ])("rejects malformed helper states", (states, message) => {
    expect(() => normalizeHelperProcessStates(states)).toThrow(message);
  });

  it("includes bounded stderr in exit diagnostics", () => {
    expect(createHelperExitMessage(1, null, "native failure\n")).toBe(
      "PoE process watcher helper exited with code 1 and signal null; stderr: native failure ",
    );
    expect(createHelperExitMessage(1, null, "")).toBe(
      "PoE process watcher helper exited with code 1 and signal null",
    );
    expect(createHelperExitMessage(null, "SIGTERM", "first\nsecond")).toBe(
      "PoE process watcher helper exited with code null and signal SIGTERM; stderr: first second",
    );
  });
});
