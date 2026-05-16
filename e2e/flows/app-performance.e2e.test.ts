import { randomUUID } from "node:crypto";

import type { Page } from "@playwright/test";

import { expectCanvasChartRendered } from "../helpers/canvas";
import { expect, test } from "../helpers/electron-test";
import {
  callElectronAPI,
  getSetting,
  isSessionActive,
  setSetting,
  startSession,
  stopSession,
} from "../helpers/ipc-helpers";
import {
  ensurePostSetup,
  expectRouteStartsWith,
  navigateTo,
  waitForRoute,
} from "../helpers/navigation";
import {
  dbExec,
  seedLeagueCache,
  seedSessionPrerequisites,
} from "../helpers/seed-db";

interface AppPerformanceState {
  capture: {
    id: string;
    startedAt: string;
    stoppedAt: string | null;
  } | null;
  isSampling: boolean;
  samples: Array<{
    fps: number | null;
  }>;
}

interface AppPerformanceCaptureSummary {
  id: string;
  startedAt: string;
  stoppedAt: string | null;
  durationMs: number;
  sampleCount: number;
  comparison: {
    fps: { avg: "lower" | "higher" | "same" | null };
    cpu: { avg: "lower" | "higher" | "same" | null };
    memory: { avg: "lower" | "higher" | "same" | null };
    appMemoryBytes: { avg: "lower" | "higher" | "same" | null };
  };
}

interface AppPerformanceCaptureHistory {
  captures: AppPerformanceCaptureSummary[];
  total: number;
}

interface SeedAppPerformanceCaptureOptions {
  startedAt: Date;
  fps: number;
  cpu: number;
  memory: number;
  appMemoryBytes: number;
}

test.describe("App Performance", () => {
  test.describe.configure({ mode: "serial" });

  test.beforeEach(async ({ page }) => {
    await ensurePostSetup(page);
    await stopActiveSession(page);
    await stopActiveDiagnostics(page);
  });

  test("persists diagnostics settings from the UI", async ({ page }) => {
    await navigateTo(page, "/settings");
    await waitForRoute(page, "/settings", 10_000);
    await page.getByRole("tab", { name: "Troubleshooting" }).click();

    const featureToggle = page.getByLabel("Show App Performance feature");
    await featureToggle.setChecked(false);
    await expect(featureToggle).not.toBeChecked();
    expect(await getSetting(page, "appPerformanceMonitorEnabled")).toBe(false);

    await featureToggle.setChecked(true);
    await expect(featureToggle).toBeChecked();
    expect(await getSetting(page, "appPerformanceMonitorEnabled")).toBe(true);

    const retentionSelect = page.getByLabel("Keep diagnostics captures");
    await retentionSelect.selectOption("24h");
    await expect(retentionSelect).toHaveValue("24h");
    expect(await getSetting(page, "appPerformanceRetention")).toBe("24h");

    await retentionSelect.selectOption("indefinite");
    await expect(retentionSelect).toHaveValue("indefinite");
    expect(await getSetting(page, "appPerformanceRetention")).toBe(
      "indefinite",
    );

    const sessionDiagnosticsToggle = page.getByLabel(
      "Start diagnostics with sessions",
    );
    await sessionDiagnosticsToggle.setChecked(false);
    await expect(sessionDiagnosticsToggle).not.toBeChecked();
    expect(await getSetting(page, "appPerformanceAutoStartOnSession")).toBe(
      false,
    );

    await sessionDiagnosticsToggle.setChecked(true);
    await expect(sessionDiagnosticsToggle).toBeChecked();
    expect(await getSetting(page, "appPerformanceAutoStartOnSession")).toBe(
      true,
    );

    await navigateTo(page, "/");
    await expect(
      page.getByRole("link", { name: "App Performance" }),
    ).toBeVisible();
  });

  test("runs a manual diagnostics capture with live charts and a saved duration", async ({
    page,
  }) => {
    await enableAppPerformance(page, { autoStart: false });
    await navigateTo(page, "/app-performance");
    await waitForRoute(page, "/app-performance", 10_000);

    await page
      .getByRole("button", { name: /Start diagnostics/i })
      .first()
      .click();
    await waitForRoute(page, "/app-performance/live", 10_000);

    const liveState = await waitForDiagnosticsSampling(page, true);
    expect(liveState.capture?.id).toBeTruthy();

    await expect(page.getByText(/Capture started/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Stop diagnostics/i }),
    ).toBeVisible();

    await expect(page.getByRole("heading", { name: "FPS" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "CPU" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Memory" })).toBeVisible();

    const charts = page.getByTestId("app-performance-line-chart-canvas");
    await expect(charts).toHaveCount(3);
    await expectCanvasChartRendered(charts.first(), "live FPS chart");

    await page.getByTitle("Focus chart").first().click();
    await expect(page.getByTitle("Collapse chart")).toBeVisible();
    await expectCanvasChartRendered(charts.first(), "focused chart");
    await page.getByTitle("Collapse chart").click();
    await expect(page.getByTitle("Focus chart").first()).toBeVisible();

    await expect
      .poll(
        async () => {
          const state = await getAppPerformanceState(page);
          return state.samples.length;
        },
        { timeout: 6_000, intervals: [250, 500, 1_000] },
      )
      .toBeGreaterThanOrEqual(2);

    const captureId = liveState.capture?.id;
    await page.getByRole("button", { name: /Stop diagnostics/i }).click();
    await expectRouteStartsWith(page, `/app-performance/${captureId}`);
    await waitForDiagnosticsSampling(page, false);

    await expect(page.getByText(/Viewing capture from/i)).toBeVisible();
    await expect(
      page.getByRole("button", { name: /Export report/i }),
    ).toBeVisible();

    const savedCapture = await waitForSavedCapture(page, captureId!);
    expect(savedCapture.stoppedAt).not.toBeNull();
    expect(savedCapture.durationMs).toBeGreaterThan(0);
    expect(savedCapture.sampleCount).toBeGreaterThanOrEqual(2);
  });

  test("changes capture tabs and shows table comparisons for seeded history", async ({
    page,
  }) => {
    await enableAppPerformance(page, { autoStart: false });
    const comparisonCaptureIds = await seedComparisonCaptures(page);

    await navigateTo(page, "/");
    await navigateTo(page, "/app-performance");
    await waitForRoute(page, "/app-performance", 10_000);

    const table = page.getByRole("table");
    await expect(
      page.getByText("Diagnostics captures", { exact: true }),
    ).toBeVisible();
    await expect(table).toContainText("FPS");
    await expect(table).toContainText("CPU");
    await expect(table).toContainText("RAM");

    const latestComparison = await waitForSavedCapture(
      page,
      comparisonCaptureIds.latest,
    );
    expect(latestComparison.comparison.fps.avg).toBe("higher");
    expect(latestComparison.comparison.cpu.avg).toBe("lower");
    expect(latestComparison.comparison.memory.avg).toBe("lower");
    expect(latestComparison.comparison.appMemoryBytes.avg).toBe("lower");

    await expect(table.locator(".text-error").first()).toBeVisible();
    await expect(table.locator(".text-success").first()).toBeVisible();

    await page.getByRole("radio", { name: "Trends" }).click();
    await expect(page.getByText(/^Trends$/)).toBeVisible();
    await expect(page.getByText(/Latest \d+ reports/)).toBeVisible();
    await expectCanvasChartRendered(
      page.getByTestId("app-performance-line-chart-canvas").first(),
      "history trend chart",
    );

    await page.getByRole("radio", { name: "Captures" }).click();
    await expect(
      page.getByText("Diagnostics captures", { exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("table")).toBeVisible();
  });

  test("deletes selected diagnostics captures from history", async ({
    page,
  }) => {
    await enableAppPerformance(page, { autoStart: false });
    const captureIds = await seedComparisonCaptures(page);

    await navigateTo(page, "/");
    await navigateTo(page, "/app-performance");
    await waitForRoute(page, "/app-performance", 10_000);

    await expect
      .poll(
        () =>
          page.evaluate(
            () => typeof window.electron.appPerformance.deleteCaptures,
          ),
        { timeout: 5_000 },
      )
      .toBe("function");

    const beforeDelete = await listCaptures(page);
    expect(
      beforeDelete.captures.some((capture) => capture.id === captureIds.older),
    ).toBe(true);
    expect(
      beforeDelete.captures.some((capture) => capture.id === captureIds.latest),
    ).toBe(true);

    await page
      .getByRole("button", { name: "More App Performance actions" })
      .click();
    await page.getByRole("button", { name: "Delete captures" }).click();

    await expect(
      page.getByRole("button", { name: "Select page" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Select page" }).click();

    const deleteSelectedButton = page.getByRole("button", {
      name: /Delete captures \(\d+\)/,
    });
    await expect(deleteSelectedButton).toBeEnabled();
    await deleteSelectedButton.click();

    const dialog = page.locator("dialog[open]");
    await expect(
      dialog.getByText(/Delete \d+ selected diagnostics capture/),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Delete captures" }).click();

    await expect
      .poll(
        async () => {
          const history = await listCaptures(page);
          return history.captures.some(
            (capture) =>
              capture.id === captureIds.older ||
              capture.id === captureIds.latest,
          );
        },
        { timeout: 10_000, intervals: [200, 500, 1_000] },
      )
      .toBe(false);

    await expect(
      page.getByRole("button", { name: "More App Performance actions" }),
    ).toBeVisible();
  });

  test("stops auto-started diagnostics when the active session stops", async ({
    page,
  }) => {
    await enableAppPerformance(page, { autoStart: true });
    await seedSessionPrerequisites(page);
    await seedLeagueCache(page, {
      game: "poe1",
      leagueId: "Standard",
      name: "Standard",
    });

    await startSession(page, "poe1", "Standard");
    await expect
      .poll(() => isSessionActive(page, "poe1"), { timeout: 10_000 })
      .toBe(true);

    const liveState = await waitForDiagnosticsSampling(page, true);
    const captureId = liveState.capture?.id;
    expect(captureId).toBeTruthy();

    await navigateTo(page, "/app-performance/live");
    await waitForRoute(page, "/app-performance/live", 10_000);
    await expect(
      page.getByRole("button", { name: /Stop diagnostics/i }),
    ).toBeVisible();

    await stopSession(page, "poe1");
    await expect
      .poll(() => isSessionActive(page, "poe1"), { timeout: 10_000 })
      .toBe(false);
    await waitForDiagnosticsSampling(page, false);

    const savedCapture = await waitForSavedCapture(page, captureId!);
    expect(savedCapture.stoppedAt).not.toBeNull();
    expect(savedCapture.durationMs).toBeGreaterThanOrEqual(0);
  });

  test("supports manually stopping auto-started diagnostics before session stop", async ({
    page,
  }) => {
    await enableAppPerformance(page, { autoStart: true });
    await seedSessionPrerequisites(page);
    await seedLeagueCache(page, {
      game: "poe1",
      leagueId: "Standard",
      name: "Standard",
    });

    await startSession(page, "poe1", "Standard");
    await expect
      .poll(() => isSessionActive(page, "poe1"), { timeout: 10_000 })
      .toBe(true);

    const liveState = await waitForDiagnosticsSampling(page, true);
    const captureId = liveState.capture?.id;
    expect(captureId).toBeTruthy();

    await navigateTo(page, "/app-performance/live");
    await waitForRoute(page, "/app-performance/live", 10_000);
    await page.getByRole("button", { name: /Stop diagnostics/i }).click();
    await expectRouteStartsWith(page, `/app-performance/${captureId}`);
    await waitForDiagnosticsSampling(page, false);

    const savedCapture = await waitForSavedCapture(page, captureId!);
    expect(savedCapture.stoppedAt).not.toBeNull();

    await stopSession(page, "poe1");
    await expect
      .poll(() => isSessionActive(page, "poe1"), { timeout: 10_000 })
      .toBe(false);
    await waitForDiagnosticsSampling(page, false);
  });
});

async function enableAppPerformance(
  page: Page,
  { autoStart }: { autoStart: boolean },
): Promise<void> {
  await setSetting(page, "appPerformanceMonitorEnabled", true);
  await setSetting(page, "appPerformanceAutoStartOnSession", autoStart);
  await setSetting(page, "appPerformanceRetention", "indefinite");
}

async function getAppPerformanceState(
  page: Page,
): Promise<AppPerformanceState> {
  return callElectronAPI<AppPerformanceState>(
    page,
    "appPerformance",
    "getState",
  );
}

async function listCaptures(page: Page): Promise<AppPerformanceCaptureHistory> {
  return callElectronAPI<AppPerformanceCaptureHistory>(
    page,
    "appPerformance",
    "listCaptures",
    { page: 1, pageSize: 25 },
  );
}

async function stopActiveDiagnostics(page: Page): Promise<void> {
  const state = await getAppPerformanceState(page);
  if (!state.isSampling) return;

  await callElectronAPI(page, "appPerformance", "stopCapture");
  await waitForDiagnosticsSampling(page, false);
}

async function stopActiveSession(page: Page): Promise<void> {
  if (!(await isSessionActive(page, "poe1"))) return;

  await stopSession(page, "poe1");
  await expect
    .poll(() => isSessionActive(page, "poe1"), { timeout: 10_000 })
    .toBe(false);
}

async function waitForDiagnosticsSampling(
  page: Page,
  expected: boolean,
): Promise<AppPerformanceState> {
  await expect
    .poll(
      async () => {
        const state = await getAppPerformanceState(page);
        return state.isSampling;
      },
      { timeout: 10_000, intervals: [200, 500, 1_000] },
    )
    .toBe(expected);

  return getAppPerformanceState(page);
}

async function waitForSavedCapture(
  page: Page,
  captureId: string,
): Promise<AppPerformanceCaptureSummary> {
  let matchedCapture: AppPerformanceCaptureSummary | undefined;

  await expect
    .poll(
      async () => {
        const history = await listCaptures(page);
        matchedCapture = history.captures.find(
          (capture) => capture.id === captureId,
        );
        return matchedCapture?.stoppedAt ?? null;
      },
      { timeout: 10_000, intervals: [200, 500, 1_000] },
    )
    .not.toBeNull();

  if (!matchedCapture) {
    throw new Error(
      `Capture ${captureId} was not found in diagnostics history`,
    );
  }

  return matchedCapture;
}

async function seedComparisonCaptures(page: Page): Promise<{
  older: string;
  latest: string;
}> {
  const baseTime = Date.now() + 60_000;
  const older = await seedAppPerformanceCapture(page, {
    startedAt: new Date(baseTime),
    fps: 40,
    cpu: 22,
    memory: 6,
    appMemoryBytes: 220 * 1024 * 1024,
  });
  const latest = await seedAppPerformanceCapture(page, {
    startedAt: new Date(baseTime + 120_000),
    fps: 58,
    cpu: 12,
    memory: 3,
    appMemoryBytes: 140 * 1024 * 1024,
  });

  return { older, latest };
}

async function seedAppPerformanceCapture(
  page: Page,
  options: SeedAppPerformanceCaptureOptions,
): Promise<string> {
  const id = `e2e-app-performance-${randomUUID()}`;
  const sampleOneAt = new Date(options.startedAt.getTime() + 500);
  const sampleTwoAt = new Date(options.startedAt.getTime() + 1_500);
  const stoppedAt = new Date(options.startedAt.getTime() + 2_000);
  const markerId = `e2e-app-performance-marker-${randomUUID()}`;

  await dbExec(
    page,
    `
      INSERT INTO app_performance_captures (id, started_at, stopped_at)
      VALUES (?, ?, ?)
    `,
    [id, options.startedAt.toISOString(), stoppedAt.toISOString()],
  );

  for (const [index, sampledAt] of [sampleOneAt, sampleTwoAt].entries()) {
    await dbExec(
      page,
      `
        INSERT INTO app_performance_samples (
          collection_id,
          sampled_at,
          uptime_ms,
          capture_elapsed_ms,
          route,
          fps,
          system_cpu_percent,
          app_cpu_percent,
          system_memory_used_percent,
          system_memory_total_bytes,
          system_memory_free_bytes,
          app_memory_bytes,
          app_memory_percent,
          main_heap_used_bytes,
          renderer_memory_bytes,
          renderer_heap_used_bytes
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        id,
        sampledAt.toISOString(),
        10_000 + index * 1_000,
        index === 0 ? 500 : 1_500,
        "/app-performance",
        options.fps,
        options.cpu + 4,
        options.cpu,
        65,
        16 * 1024 * 1024 * 1024,
        6 * 1024 * 1024 * 1024,
        options.appMemoryBytes,
        options.memory,
        90 * 1024 * 1024,
        options.appMemoryBytes - 20 * 1024 * 1024,
        70 * 1024 * 1024,
      ],
    );
  }

  await dbExec(
    page,
    `
      INSERT INTO app_performance_route_markers (
        id,
        collection_id,
        route,
        label,
        marked_at,
        elapsed_ms
      )
      VALUES (?, ?, ?, ?, ?, ?)
    `,
    [
      markerId,
      id,
      "/app-performance",
      "App Performance",
      sampleOneAt.toISOString(),
      500,
    ],
  );

  return id;
}
