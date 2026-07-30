import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type {
  BannerDismissalsResult,
  BannerDismissResult,
  BannerId,
} from "~/main/modules/banners/Banners.types";

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
  getAllDismissed: vi.fn<() => Promise<BannerDismissalsResult>>(),
  dismiss: vi.fn<(bannerId: BannerId) => Promise<BannerDismissResult>>(),
};

describe("Banners.slice", () => {
  beforeEach(() => {
    defaultBannersApi.getAllDismissed = vi.fn().mockResolvedValue({
      success: true,
      bannerIds: [],
    });
    defaultBannersApi.dismiss = vi.fn().mockResolvedValue({ success: true });
    installBannersApi();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("starts with an empty unloaded banner state", () => {
    const { state } = createHarness();

    expect(state.banners.dismissedIds).toEqual(new Set());
    expect(state.banners.loadStatus).toBe("idle");
    expect(state.banners.dismissedIds.has("community-backfill")).toBe(false);
  });

  it("loads dismissed banner ids from the banners API", async () => {
    const api = installBannersApi({
      getAllDismissed: vi.fn().mockResolvedValue({
        success: true,
        bannerIds: ["community-backfill"],
      }),
    });
    const { state } = createHarness();

    await state.banners.loadDismissed();

    expect(api.getAllDismissed).toHaveBeenCalledTimes(1);
    expect(state.banners.dismissedIds).toEqual(new Set(["community-backfill"]));
    expect(state.banners.loadStatus).toBe("ready");
    expect(state.banners.dismissedIds.has("community-backfill")).toBe(true);
  });

  it("retries transient hydration failures with backoff", async () => {
    vi.useFakeTimers();
    const getAllDismissed = vi
      .fn()
      .mockRejectedValueOnce(new Error("db unavailable"))
      .mockRejectedValueOnce(new Error("db still unavailable"))
      .mockResolvedValueOnce({
        success: true,
        bannerIds: ["community-backfill"],
      });
    installBannersApi({ getAllDismissed });
    const { state } = createHarness();

    const loadPromise = state.banners.loadDismissed();
    await vi.advanceTimersByTimeAsync(600);
    await loadPromise;

    expect(getAllDismissed).toHaveBeenCalledTimes(3);
    expect(state.banners.loadStatus).toBe("ready");
    expect(state.banners.dismissedIds).toEqual(new Set(["community-backfill"]));
  });

  it("keeps hydration in an error state when all attempts fail", async () => {
    vi.useFakeTimers();
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const error = new Error("db unavailable");
    installBannersApi({
      getAllDismissed: vi.fn().mockRejectedValue(error),
    });
    const { state } = createHarness();

    const loadPromise = state.banners.loadDismissed();
    await vi.advanceTimersByTimeAsync(600);
    await loadPromise;

    expect(state.banners.dismissedIds).toEqual(new Set());
    expect(state.banners.loadStatus).toBe("error");
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[BannersSlice] Failed to load dismissed banners.",
    );
  });

  it("optimistically dismisses a banner and persists it", async () => {
    const api = installBannersApi({
      dismiss: vi.fn().mockResolvedValue({ success: true }),
    });
    const { state } = createHarness();

    const result = await state.banners.dismiss("community-backfill");

    expect(result).toBe(true);
    expect(state.banners.dismissedIds).toEqual(new Set(["community-backfill"]));
    expect(api.dismiss).toHaveBeenCalledWith("community-backfill");
    expect(state.banners.dismissedIds.has("community-backfill")).toBe(true);
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

    const result = await state.banners.dismiss("community-backfill");

    expect(result).toBe(false);
    expect(state.banners.dismissedIds).toEqual(new Set());
    expect(state.banners.dismissedIds.has("community-backfill")).toBe(false);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[BannersSlice] Failed to dismiss banner.",
    );
  });

  it("reverts when IPC reports that persistence was rejected", async () => {
    installBannersApi({
      dismiss: vi.fn().mockResolvedValue({
        success: false,
        error: "Invalid input",
      }),
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { state } = createHarness();

    const result = await state.banners.dismiss("community-backfill");

    expect(result).toBe(false);
    expect(state.banners.dismissedIds).toEqual(new Set());
  });

  it("reflects a dismissal already committed by a main-process workflow", () => {
    const { state } = createHarness();

    state.banners.markDismissed("community-backfill");

    expect(state.banners.dismissedIds).toEqual(new Set(["community-backfill"]));
    expect(defaultBannersApi.dismiss).not.toHaveBeenCalled();
  });
});
