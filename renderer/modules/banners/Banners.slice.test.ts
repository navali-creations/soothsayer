import { beforeEach, describe, expect, it, vi } from "vitest";

import { type BannersSlice, createBannersSlice } from "./Banners.slice";

type TestState = BannersSlice;

function createHarness() {
  let state = {} as TestState;

  const set = vi.fn((updater: (draft: TestState) => void) => {
    updater(state);
  });
  const get = vi.fn(() => state);

  state = createBannersSlice(set as never, get as never, undefined as never);

  return { get, set, state };
}

function installBannersApi(overrides: Partial<typeof defaultBannersApi> = {}) {
  const api = {
    ...defaultBannersApi,
    ...overrides,
  };

  Object.defineProperty(window, "electron", {
    value: {
      ...(window as any).electron,
      banners: api,
    },
    configurable: true,
  });

  return api;
}

const defaultBannersApi = {
  getAllDismissed: vi.fn<() => Promise<string[]>>(),
  dismiss: vi.fn<(bannerId: string) => Promise<void>>(),
};

describe("Banners.slice", () => {
  beforeEach(() => {
    defaultBannersApi.getAllDismissed = vi.fn().mockResolvedValue([]);
    defaultBannersApi.dismiss = vi.fn().mockResolvedValue(undefined);
    installBannersApi();
  });

  it("starts with an empty unloaded banner state", () => {
    const { state } = createHarness();

    expect(state.banners.dismissedIds).toEqual(new Set());
    expect(state.banners.isLoaded).toBe(false);
    expect(state.banners.isDismissed("community-backfill")).toBe(false);
  });

  it("loads dismissed banner ids from the banners API", async () => {
    const api = installBannersApi({
      getAllDismissed: vi.fn().mockResolvedValue(["a", "b"]),
    });
    const { state } = createHarness();

    await state.banners.loadDismissed();

    expect(api.getAllDismissed).toHaveBeenCalledTimes(1);
    expect(state.banners.dismissedIds).toEqual(new Set(["a", "b"]));
    expect(state.banners.isLoaded).toBe(true);
    expect(state.banners.isDismissed("a")).toBe(true);
  });

  it("marks banners as loaded when loading dismissed ids fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("db unavailable");
    installBannersApi({
      getAllDismissed: vi.fn().mockRejectedValue(error),
    });
    const { state } = createHarness();

    await state.banners.loadDismissed();

    expect(state.banners.dismissedIds).toEqual(new Set());
    expect(state.banners.isLoaded).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[BannersSlice] Failed to load dismissed banners:",
      error,
    );
  });

  it("optimistically dismisses a banner and persists it", async () => {
    const api = installBannersApi({
      dismiss: vi.fn().mockResolvedValue(undefined),
    });
    const { state } = createHarness();

    await state.banners.dismiss("community-backfill");

    expect(state.banners.dismissedIds).toEqual(new Set(["community-backfill"]));
    expect(api.dismiss).toHaveBeenCalledWith("community-backfill");
    expect(state.banners.isDismissed("community-backfill")).toBe(true);
  });

  it("reverts an optimistic dismissal when persistence fails", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("write failed");
    installBannersApi({
      dismiss: vi.fn().mockRejectedValue(error),
    });
    const { state } = createHarness();

    await state.banners.dismiss("community-backfill");

    expect(state.banners.dismissedIds).toEqual(new Set());
    expect(state.banners.isDismissed("community-backfill")).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[BannersSlice] Failed to dismiss banner:",
      error,
    );
  });
});
