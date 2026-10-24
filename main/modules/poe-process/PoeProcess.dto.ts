import type { GameType } from "~/types/data-stores";

const POE_PROCESS_GAMES = [
  "poe1",
  "poe2",
] as const satisfies readonly GameType[];

interface PoeProcessRunningState {
  game: GameType;
  isRunning: true;
  pid: number;
  processName: string;
  windowTitle: string;
}

interface PoeProcessStoppedState {
  game: GameType;
  isRunning: false;
  pid?: never;
  processName: "";
  windowTitle?: never;
}

type PoeProcessState = PoeProcessRunningState | PoeProcessStoppedState;
type PoeProcessStatesByGame = Record<GameType, PoeProcessState>;

type PoeProcessWatcherStatus = "stopped" | "watching" | "unavailable";

interface PoeProcessGameStatus {
  isRunning: boolean;
}

interface PoeProcessSnapshot {
  status: PoeProcessWatcherStatus;
  states: Record<GameType, PoeProcessGameStatus>;
}

function createStoppedPoeProcessState(game: GameType): PoeProcessStoppedState {
  return {
    game,
    isRunning: false,
    processName: "",
  };
}

function createStoppedPoeProcessStates(): PoeProcessStatesByGame {
  return {
    poe1: createStoppedPoeProcessState("poe1"),
    poe2: createStoppedPoeProcessState("poe2"),
  };
}

function createPoeProcessSnapshot(
  states: PoeProcessStatesByGame = createStoppedPoeProcessStates(),
  status: PoeProcessWatcherStatus = "stopped",
): PoeProcessSnapshot {
  return {
    status,
    states: {
      poe1: { isRunning: states.poe1.isRunning },
      poe2: { isRunning: states.poe2.isRunning },
    },
  };
}

export type {
  PoeProcessGameStatus,
  PoeProcessRunningState,
  PoeProcessSnapshot,
  PoeProcessState,
  PoeProcessStatesByGame,
  PoeProcessStoppedState,
  PoeProcessWatcherStatus,
};
export {
  createPoeProcessSnapshot,
  createStoppedPoeProcessState,
  createStoppedPoeProcessStates,
  POE_PROCESS_GAMES,
};
