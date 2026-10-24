import { readFileSync } from "node:fs";

const input = readFileSync(0, "utf8").trim();
const line = input.split(/\r?\n/).at(-1);

if (!line) {
  throw new Error("PoE process helper emitted no payload");
}

const payload = JSON.parse(line);
if (payload.type !== "state" || !Array.isArray(payload.states)) {
  throw new Error("PoE process helper did not emit a state payload");
}

if (payload.states.length !== 2) {
  throw new Error("PoE process helper must emit exactly two game states");
}

const games = new Set();
for (const state of payload.states) {
  if (
    !state ||
    typeof state !== "object" ||
    (state.game !== "poe1" && state.game !== "poe2") ||
    typeof state.isRunning !== "boolean" ||
    typeof state.processName !== "string"
  ) {
    throw new Error("PoE process helper emitted an invalid game state");
  }

  if (games.has(state.game)) {
    throw new Error("PoE process helper emitted a duplicate game state");
  }
  games.add(state.game);

  if (state.isRunning) {
    if (
      !Number.isInteger(state.pid) ||
      state.pid <= 0 ||
      state.processName.trim().length === 0 ||
      typeof state.windowTitle !== "string"
    ) {
      throw new Error("PoE process helper emitted an invalid running state");
    }
  } else if (
    state.processName !== "" ||
    "pid" in state ||
    "windowTitle" in state
  ) {
    throw new Error("PoE process helper emitted an invalid stopped state");
  }
}

if (!games.has("poe1") || !games.has("poe2")) {
  throw new Error("PoE process helper payload is missing a game state");
}
