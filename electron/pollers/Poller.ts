import EventEmitter from "node:events";

/**
 * Generic Poller base class that can be extended for different polling services.
 * Emits 'start', 'stop', and 'data' events based on polling results.
 */
export abstract class Poller<T = any> extends EventEmitter {
  private _isPollerRunning = false;
  private _pollInterval: NodeJS.Timeout | undefined;
  private _previousState: T | undefined;
  protected _intervalMs: number;

  constructor(intervalMs: number = 5000) {
    super();
    this._intervalMs = intervalMs;
  }

  get isPollerRunning() {
    return this._isPollerRunning;
  }

  get pollInterval() {
    return this._pollInterval;
  }

  /**
   * Abstract method that subclasses must implement to define polling logic.
   * Should return the current state being polled.
   */
  protected abstract pollOnce(): Promise<T>;

  /**
   * Optional method to compare states. Override if custom comparison is needed.
   * Default implementation uses strict equality.
   */
  protected hasStateChanged(previous: T | undefined, current: T): boolean {
    return previous !== current;
  }

  /**
   * Optional hook called when state transitions from inactive to active
   */
  protected onStart(state: T): void {
    // Override in subclass if needed
  }

  /**
   * Optional hook called when state transitions from active to inactive
   */
  protected onStop(previousState: T): void {
    // Override in subclass if needed
  }

  /**
   * Optional hook called on every poll with current state
   */
  protected onData(state: T): void {
    // Override in subclass if needed
  }

  stop() {
    this._isPollerRunning = false;

    if (this._pollInterval) {
      clearInterval(this._pollInterval);
      this._pollInterval = undefined;
    }
  }

  start() {
    this.stop();
    this.poll();
    this._pollInterval = setInterval(() => this.poll(), this._intervalMs);
  }

  private poll = async () => {
    try {
      const currentState = await this.pollOnce();

      // Emit data event on every poll
      this.emit("data", currentState);
      this.onData(currentState);

      // Check for state changes
      if (this.hasStateChanged(this._previousState, currentState)) {
        // State changed from inactive to active
        if (!this._isPollerRunning && this.isStateActive(currentState)) {
          this._isPollerRunning = true;
          this.emit("start", currentState);
          this.onStart(currentState);
        }
        // State changed from active to inactive
        else if (this._isPollerRunning && !this.isStateActive(currentState)) {
          this._isPollerRunning = false;
          this.emit("stop", this._previousState);
          if (this._previousState !== undefined) {
            this.onStop(this._previousState);
          }
        }

        this._previousState = currentState;
      }
    } catch (error) {
      this.emit("error", error);
    }
  };

  protected abstract isStateActive(state: T): boolean;
}
