import { isProcessRunning } from "./isProcessRunning";
import { Poller } from "./Poller";

interface ProcessState {
  isRunning: boolean;
  processName: string;
}

/**
 * Generic process poller that monitors specific processes.
 */
export class ProcessPoller extends Poller<ProcessState> {
  protected processNames: string[];

  constructor(processNames: string | string[], intervalMs: number = 5000) {
    super(intervalMs);
    this.processNames = Array.isArray(processNames)
      ? processNames
      : [processNames];
  }

  protected async pollOnce(): Promise<ProcessState> {
    for (const processName of this.processNames) {
      const isRunning = await isProcessRunning(processName);
      if (isRunning) {
        return { isRunning: true, processName };
      }
    }
    return { isRunning: false, processName: this.processNames[0] };
  }

  protected isStateActive(state: ProcessState): boolean {
    return state.isRunning;
  }

  protected hasStateChanged(
    previous: ProcessState | undefined,
    current: ProcessState,
  ): boolean {
    return previous?.isRunning !== current.isRunning;
  }
}
