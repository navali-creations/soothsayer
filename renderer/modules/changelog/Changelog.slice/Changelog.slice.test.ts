import { beforeEach, describe, expect, it } from "vitest";

import type { ElectronMock } from "~/renderer/__test-setup__/electron-mock";
import {
  createTestStore,
  type TestStore,
} from "~/renderer/__test-setup__/test-store";

let store: TestStore;
let electron: ElectronMock;

beforeEach(() => {
  electron = window.electron as unknown as ElectronMock;
  store = createTestStore();
});

describe("ChangelogSlice", () => {
  // ── Initial State ────────────────────────────────────────────────────────

  describe("initial state", () => {
    it("has empty releases array", () => {
      expect(store.getState().changelog.releases).toEqual([]);
    });

    it("has isLoading set to false", () => {
      expect(store.getState().changelog.isLoading).toBe(false);
    });

    it("has error set to null", () => {
      expect(store.getState().changelog.error).toBeNull();
    });

    it("has hasFetched set to false", () => {
      expect(store.getState().changelog.hasFetched).toBe(false);
    });
  });

  // ── fetchChangelog ───────────────────────────────────────────────────────

  describe("fetchChangelog", () => {
    it("sets isLoading to true while fetching", async () => {
      // Use a deferred promise so we can observe the loading state
      let resolvePromise!: (value: unknown) => void;
      electron.updater.getChangelog.mockReturnValue(
        new Promise((resolve) => {
          resolvePromise = resolve;
        }),
      );

      const fetchPromise = store.getState().changelog.fetchChangelog();

      expect(store.getState().changelog.isLoading).toBe(true);
      expect(store.getState().changelog.error).toBeNull();

      resolvePromise({ success: true, releases: [] });
      await fetchPromise;

      expect(store.getState().changelog.isLoading).toBe(false);
    });

    it("populates releases on success", async () => {
      const mockReleases = [
        {
          version: "1.2.0",
          changeType: "minor",
          entries: [
            {
              title: "New feature",
              description: "A cool feature",
              content: "",
            },
          ],
        },
        {
          version: "1.1.0",
          changeType: "patch",
          entries: [
            { title: "Bug fix", description: "Fixed a bug", content: "" },
          ],
        },
      ];

      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: mockReleases,
      });

      await store.getState().changelog.fetchChangelog();

      const state = store.getState().changelog;
      expect(state.releases).toEqual(mockReleases);
      expect(state.isLoading).toBe(false);
      expect(state.hasFetched).toBe(true);
      expect(state.error).toBeNull();
    });

    it("sets hasFetched to true on success", async () => {
      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: [{ version: "1.0.0", changeType: "major", entries: [] }],
      });

      await store.getState().changelog.fetchChangelog();

      expect(store.getState().changelog.hasFetched).toBe(true);
    });

    it("handles result.success = false with an error message", async () => {
      electron.updater.getChangelog.mockResolvedValue({
        success: false,
        releases: [],
        error: "GitHub API rate limited",
      });

      await store.getState().changelog.fetchChangelog();

      const state = store.getState().changelog;
      expect(state.error).toBe("GitHub API rate limited");
      expect(state.releases).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.hasFetched).toBe(true);
    });

    it("uses fallback error message when result.success is false and error is undefined", async () => {
      electron.updater.getChangelog.mockResolvedValue({
        success: false,
        releases: [],
      });

      await store.getState().changelog.fetchChangelog();

      expect(store.getState().changelog.error).toBe("Failed to load changelog");
    });

    it("handles thrown exceptions", async () => {
      electron.updater.getChangelog.mockRejectedValue(
        new Error("Network timeout"),
      );

      await store.getState().changelog.fetchChangelog();

      const state = store.getState().changelog;
      expect(state.error).toBe("Network timeout");
      expect(state.isLoading).toBe(false);
      expect(state.hasFetched).toBe(true);
      expect(state.releases).toEqual([]);
    });

    it("skips fetch if already fetched successfully with releases", async () => {
      const mockReleases = [
        { version: "1.0.0", changeType: "major", entries: [] },
      ];

      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: mockReleases,
      });

      // First fetch
      await store.getState().changelog.fetchChangelog();
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(1);

      // Second fetch — should be skipped
      await store.getState().changelog.fetchChangelog();
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(1);
    });

    it("does not skip fetch if hasFetched is true but releases are empty", async () => {
      // Simulate a previous fetch that succeeded but returned no releases
      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: [],
      });

      await store.getState().changelog.fetchChangelog();
      expect(store.getState().changelog.hasFetched).toBe(true);
      expect(store.getState().changelog.releases).toEqual([]);
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(1);

      // Second fetch should NOT be skipped because releases.length === 0
      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: [{ version: "1.0.0", changeType: "major", entries: [] }],
      });

      await store.getState().changelog.fetchChangelog();
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(2);
    });

    it("does not skip fetch if previous fetch resulted in an error", async () => {
      electron.updater.getChangelog.mockResolvedValue({
        success: false,
        releases: [],
        error: "Server error",
      });

      await store.getState().changelog.fetchChangelog();
      expect(store.getState().changelog.hasFetched).toBe(true);
      expect(store.getState().changelog.error).toBe("Server error");

      // Second fetch should NOT be skipped because releases are empty
      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: [{ version: "2.0.0", changeType: "major", entries: [] }],
      });

      await store.getState().changelog.fetchChangelog();
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(2);
      expect(store.getState().changelog.releases).toEqual([
        { version: "2.0.0", changeType: "major", entries: [] },
      ]);
      expect(store.getState().changelog.error).toBeNull();
    });

    it("clears previous error on new fetch", async () => {
      // First: fail
      electron.updater.getChangelog.mockRejectedValue(
        new Error("Connection refused"),
      );
      await store.getState().changelog.fetchChangelog();
      expect(store.getState().changelog.error).toBe("Connection refused");

      // Second: succeed (releases were empty so fetch is not skipped)
      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: [{ version: "1.0.0", changeType: "major", entries: [] }],
      });
      await store.getState().changelog.fetchChangelog();
      expect(store.getState().changelog.error).toBeNull();
    });
  });

  // ── reset ────────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("resets all state to defaults", async () => {
      // First populate with data
      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases: [
          { version: "1.0.0", changeType: "major", entries: [] },
          { version: "0.9.0", changeType: "minor", entries: [] },
        ],
      });

      await store.getState().changelog.fetchChangelog();

      // Verify state is populated
      expect(store.getState().changelog.releases.length).toBe(2);
      expect(store.getState().changelog.hasFetched).toBe(true);

      // Reset
      store.getState().changelog.reset();

      const state = store.getState().changelog;
      expect(state.releases).toEqual([]);
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.hasFetched).toBe(false);
    });

    it("allows re-fetching after reset", async () => {
      const releases = [{ version: "1.0.0", changeType: "major", entries: [] }];

      electron.updater.getChangelog.mockResolvedValue({
        success: true,
        releases,
      });

      // Fetch, then reset, then fetch again
      await store.getState().changelog.fetchChangelog();
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(1);

      store.getState().changelog.reset();

      await store.getState().changelog.fetchChangelog();
      expect(electron.updater.getChangelog).toHaveBeenCalledTimes(2);
      expect(store.getState().changelog.releases).toEqual(releases);
    });
  });
});
