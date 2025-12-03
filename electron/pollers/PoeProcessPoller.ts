import { ProcessPoller } from "./ProcessPoller";

/**
 * Specialized poller for Path of Exile process detection.
 * Monitors both Steam and Standalone versions.
 */
export class PoeProcessPoller extends ProcessPoller {
  private static readonly POE_PROCESSES = [
    "PathOfExileSteam.exe",
    "PathOfExile.exe",
  ];

  private static readonly POLL_INTERVAL_MS = 5000;

  constructor() {
    super(PoeProcessPoller.POE_PROCESSES, PoeProcessPoller.POLL_INTERVAL_MS);
  }

  protected onStart(state: { isRunning: boolean; processName: string }): void {
    console.log(`Path of Exile started: ${state.processName}`);
  }

  protected onStop(previousState: {
    isRunning: boolean;
    processName: string;
  }): void {
    console.log(`Path of Exile stopped: ${previousState.processName}`);
  }
}
