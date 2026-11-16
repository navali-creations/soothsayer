import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { GameType } from "~/types/data-stores";

import {
  createPricingSaveQueue,
  PRICING_SAVE_DELAY_MS,
} from "./CurrentSession.utils";

describe("pricing save queue", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each([0, null, 2.25])(
    "retries the retained failed value %s once per explicit retry",
    async (value) => {
      const save = vi
        .fn(async () => ({ success: true }))
        .mockResolvedValueOnce({ success: false })
        .mockResolvedValueOnce({ success: false });
      const queue = createPricingSaveQueue<number | null>(save, vi.fn());
      const edit = queue.enqueue("poe1", value);
      await expect(queue.flush("poe1")).resolves.toBe(false);
      await edit;
      await expect(queue.flush("poe1", { retryFailed: true })).resolves.toBe(
        false,
      );
      expect(save).toHaveBeenCalledTimes(2);
      await vi.runAllTimersAsync();
      expect(save).toHaveBeenCalledTimes(2);
      await expect(queue.flush("poe1", { retryFailed: true })).resolves.toBe(
        true,
      );
      expect(save.mock.calls).toEqual([
        ["poe1", value],
        ["poe1", value],
        ["poe1", value],
      ]);
    },
  );

  it("keeps a newer edit instead of retrying the older failed value", async () => {
    const save = vi
      .fn(async () => ({ success: true }))
      .mockResolvedValueOnce({ success: false });
    const queue = createPricingSaveQueue<number>(save, vi.fn());
    const first = queue.enqueue("poe1", 2.25);
    await queue.flush("poe1");
    await first;
    const latest = queue.enqueue("poe1", 3);
    await expect(queue.flush("poe1", { retryFailed: true })).resolves.toBe(
      true,
    );
    await latest;
    expect(save.mock.calls).toEqual([
      ["poe1", 2.25],
      ["poe1", 3],
    ]);
  });

  it("does not enqueue an old failed value while a newer save is running", async () => {
    const response = Promise.withResolvers<{ success: boolean }>();
    const save = vi
      .fn(async () => ({ success: true }))
      .mockResolvedValueOnce({ success: false })
      .mockReturnValueOnce(response.promise);
    const queue = createPricingSaveQueue<number>(save, vi.fn());
    const first = queue.enqueue("poe1", 2.25);
    await queue.flush("poe1");
    await first;
    const latest = queue.enqueue("poe1", 3);
    const saving = queue.flush("poe1");
    const retrying = queue.flush("poe1", { retryFailed: true });
    response.resolve({ success: true });
    await Promise.all([latest, saving, retrying]);
    expect(save.mock.calls).toEqual([
      ["poe1", 2.25],
      ["poe1", 3],
    ]);
  });

  it("saves only the latest pending value and resolves all superseded edits", async () => {
    const save = vi.fn(async () => ({ success: true }));
    const settled = vi.fn();
    const queue = createPricingSaveQueue<number>(save, settled);
    const edits = [
      queue.enqueue("poe1", 1),
      queue.enqueue("poe1", 12),
      queue.enqueue("poe1", 123),
    ];
    expect(save).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(PRICING_SAVE_DELAY_MS);
    await Promise.all(edits);
    expect(save).toHaveBeenCalledExactlyOnceWith("poe1", 123);
    expect(settled).toHaveBeenCalledExactlyOnceWith("poe1", false);
  });

  it("does not let an older failed request overwrite a successful retry of the same value", async () => {
    const firstSave = Promise.withResolvers<{ success: boolean }>();
    const save = vi
      .fn(async () => ({ success: true }))
      .mockImplementationOnce(() => firstSave.promise);
    const settled = vi.fn();
    const queue = createPricingSaveQueue<number>(save, settled);
    const first = queue.enqueue("poe1", 2);
    const flushing = queue.flush("poe1");
    const retry = queue.enqueue("poe1", 2);
    firstSave.reject(new Error("old request failed"));
    await Promise.all([flushing, first, retry]);
    expect(save).toHaveBeenCalledTimes(2);
    expect(settled).toHaveBeenCalledExactlyOnceWith("poe1", false);
  });

  it("keeps games independent while one save is pending", async () => {
    const firstSave = Promise.withResolvers<{ success: boolean }>();
    const save = vi.fn((game: GameType) =>
      game === "poe1" ? firstSave.promise : Promise.resolve({ success: true }),
    );
    const settled = vi.fn();
    const queue = createPricingSaveQueue<number>(save, settled);
    const first = queue.enqueue("poe1", 2);
    const firstFlush = queue.flush("poe1");
    const second = queue.enqueue("poe2", 5);
    await queue.flush("poe2");
    await second;
    expect(settled).toHaveBeenCalledExactlyOnceWith("poe2", false);
    firstSave.resolve({ success: false });
    await Promise.all([first, firstFlush]);
    expect(settled).toHaveBeenLastCalledWith("poe1", true);
  });

  it("flushes pending edits once before a lifecycle transition", async () => {
    const save = vi.fn(async () => ({ success: true }));
    const queue = createPricingSaveQueue<number>(save, vi.fn());
    const pending = queue.enqueue("poe1", 2);
    await Promise.all([queue.flush("poe1"), queue.flush("poe1"), pending]);
    await vi.runAllTimersAsync();
    expect(save).toHaveBeenCalledExactlyOnceWith("poe1", 2);
  });

  it.each(["rejected", "unsuccessful"])(
    "keeps a %s save failure visible to later flushes until a successful edit",
    async (failure) => {
      const save = vi.fn(async () => ({ success: true }));
      if (failure === "rejected")
        save.mockRejectedValueOnce(new Error("IPC failed"));
      else save.mockResolvedValueOnce({ success: false });
      const queue = createPricingSaveQueue<number>(save, vi.fn());
      const edit = queue.enqueue("poe1", 2.25);
      await expect(queue.flush("poe1")).resolves.toBe(false);
      await edit;
      await expect(queue.flush("poe1")).resolves.toBe(false);
      await expect(queue.flush("poe2")).resolves.toBe(true);

      const retry = queue.enqueue("poe1", 2.25);
      await expect(queue.flush("poe1")).resolves.toBe(true);
      await retry;
    },
  );
});
