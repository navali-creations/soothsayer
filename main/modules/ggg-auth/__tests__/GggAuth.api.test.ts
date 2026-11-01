import { beforeEach, expect, it, vi } from "vitest";

const { on, removeListener } = vi.hoisted(() => ({
  on: vi.fn(),
  removeListener: vi.fn(),
}));
vi.mock("electron", () => ({
  ipcRenderer: { on, removeListener, invoke: vi.fn() },
}));

import { GggAuthAPI } from "../GggAuth.api";
import { GggAuthChannel } from "../GggAuth.channels";

beforeEach(() => vi.clearAllMocks());

it("subscribes to auth invalidation without forwarding IPC arguments and removes the exact listener", () => {
  const callback = vi.fn();
  const stop = GggAuthAPI.onAuthStatusChanged(callback);
  expect(on).toHaveBeenCalledWith(
    GggAuthChannel.AuthStatusChanged,
    expect.any(Function),
  );
  const handler = on.mock.calls[0][1];
  handler({ sender: "main" }, { unexpected: "payload" });
  expect(callback).toHaveBeenCalledWith();
  stop();
  expect(removeListener).toHaveBeenCalledWith(
    GggAuthChannel.AuthStatusChanged,
    handler,
  );
});
