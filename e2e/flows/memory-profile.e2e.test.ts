/**
 * E2E Tests: Memory Profiling
 *
 * Measures the memory footprint of the Soothsayer Electron app at key lifecycle
 * points and asserts that memory growth stays within acceptable bounds.
 *
 * These tests serve as automated regression guards for the performance work done
 * in the POE1 Divination Cards performance plan and the general performance
 * optimization plan. They capture:
 *
 * - Idle footprint after app launch and hydration
 * - Memory impact of card sync / data loading operations
 * - Memory stability during rapid navigation (leak detection)
 * - Renderer memory when browsing card grids
 *
 * ## Running
 *
 * ```sh
 * pnpm test:e2e -- --grep "Memory"
 * ```
 *
 * ## Notes
 *
 * - Memory measurements are inherently noisy. Thresholds are generous to avoid
 *   flaky failures — the goal is catching large regressions (e.g., +50 MB heap),
 *   not enforcing exact byte counts.
 * - GC timing is non-deterministic. We call `global.gc()` when available (requires
 *   `--js-flags=--expose-gc`) and add stabilization delays, but some variance is
 *   expected.
 * - All memory values logged to stdout are visible in Playwright's test output
 *   and CI artifacts, making it easy to track trends over time even when all
 *   assertions pass.
 *
 * @module e2e/flows/memory-profile
 */

import { RARITY_INSIGHTS_CARDS } from "../fixtures/rarity-insights-fixture";
import { expect, test } from "../helpers/electron-test";
import { callElectronAPI, mockSetupComplete } from "../helpers/ipc-helpers";
import {
  captureMainMemory,
  captureRendererMemory,
  computeDelta,
  detectMemoryTrend,
  formatBytes,
  formatDeltaSummary,
  formatSnapshot,
  MEMORY_THRESHOLDS,
  MemoryProfiler,
} from "../helpers/memory";
import {
  ensurePostSetup,
  navigateTo,
  waitForHydration,
} from "../helpers/navigation";
import {
  seedDivinationCards,
  seedSessionPrerequisites,
} from "../helpers/seed-db";

// ─── Idle Footprint ───────────────────────────────────────────────────────────

test.describe
  .skip("Memory Profiling — Idle Footprint", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should report main process memory at idle", async ({ app }) => {
      const mem = await captureMainMemory(app);

      console.log("[Memory] Main process at idle:");
      console.log(`  RSS:          ${formatBytes(mem.rss)}`);
      console.log(`  Heap Used:    ${formatBytes(mem.heapUsed)}`);
      console.log(`  Heap Total:   ${formatBytes(mem.heapTotal)}`);
      console.log(`  External:     ${formatBytes(mem.external)}`);
      console.log(`  ArrayBuffers: ${formatBytes(mem.arrayBuffers)}`);

      // Sanity: the app should not use more than 300 MB RSS at idle
      expect(
        mem.rss,
        `Main process RSS at idle (${formatBytes(mem.rss)}) exceeds ${formatBytes(
          MEMORY_THRESHOLDS.idleFootprint.mainRss,
        )} threshold`,
      ).toBeLessThan(MEMORY_THRESHOLDS.idleFootprint.mainRss);

      // Heap used should be well under 150 MB at idle
      expect(
        mem.heapUsed,
        `Main process heap at idle (${formatBytes(
          mem.heapUsed,
        )}) exceeds ${formatBytes(
          MEMORY_THRESHOLDS.idleFootprint.mainHeapUsed,
        )} threshold`,
      ).toBeLessThan(MEMORY_THRESHOLDS.idleFootprint.mainHeapUsed);
    });

    test("should report renderer memory at idle", async ({ page }) => {
      await waitForHydration(page);

      const mem = await captureRendererMemory(page);

      console.log("[Memory] Renderer at idle:");
      console.log(`  JS Heap Used:  ${formatBytes(mem.usedJSHeapSize)}`);
      console.log(`  JS Heap Total: ${formatBytes(mem.totalJSHeapSize)}`);
      console.log(`  JS Heap Limit: ${formatBytes(mem.jsHeapSizeLimit)}`);

      // Renderer should not use more than 100 MB heap at idle
      expect(
        mem.usedJSHeapSize,
        `Renderer heap at idle (${formatBytes(
          mem.usedJSHeapSize,
        )}) exceeds ${formatBytes(
          MEMORY_THRESHOLDS.idleFootprint.rendererHeapUsed,
        )} threshold`,
      ).toBeLessThan(MEMORY_THRESHOLDS.idleFootprint.rendererHeapUsed);
    });

    test("should capture combined snapshot at idle and produce a report", async ({
      app,
      page,
    }) => {
      await waitForHydration(page);

      const profiler = new MemoryProfiler(app, page);
      const baseline = await profiler.baseline();

      console.log("[Memory] Combined idle snapshot:");
      console.log(formatSnapshot(baseline));

      // Both processes should have non-zero values (sanity)
      expect(baseline.main.rss).toBeGreaterThan(0);
      expect(baseline.main.heapUsed).toBeGreaterThan(0);
      expect(baseline.renderer.usedJSHeapSize).toBeGreaterThan(0);
    });
  });

// ─── Data Loading Impact ──────────────────────────────────────────────────────

test.describe
  .skip("Memory Profiling — Data Loading", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should measure memory impact of loading divination cards", async ({
      app,
      page,
    }) => {
      await waitForHydration(page);

      const profiler = new MemoryProfiler(app, page);
      await profiler.baseline();

      // Seed cards via the IPC bridge (this triggers DB writes + IPC)
      await seedDivinationCards(page, RARITY_INSIGHTS_CARDS);

      // Navigate to the Cards page to trigger renderer-side data loading
      await navigateTo(page, "/cards");
      // Wait for the card grid to be visible
      await page.locator("main").waitFor({ state: "visible", timeout: 15_000 });
      // Give the renderer time to finish rendering card images, etc.
      await page.waitForTimeout(2_000);

      const report = await profiler.snapshot("after card sync + grid render");

      console.log("[Memory] After loading divination cards:");
      console.log(report.summary);

      // Main process heap should not grow more than 50 MB from card sync
      if (report.delta) {
        expect(
          report.delta.main.heapUsed,
          `Main heap grew ${formatBytes(
            report.delta.main.heapUsed,
          )} after card sync — exceeds ${formatBytes(
            MEMORY_THRESHOLDS.singleOperation.mainHeapGrowth,
          )} threshold`,
        ).toBeLessThan(MEMORY_THRESHOLDS.singleOperation.mainHeapGrowth);

        // Renderer heap should not grow more than 30 MB from rendering the grid
        expect(
          report.delta.renderer.usedJSHeapSize,
          `Renderer heap grew ${formatBytes(
            report.delta.renderer.usedJSHeapSize,
          )} after card grid render — exceeds ${formatBytes(
            MEMORY_THRESHOLDS.singleOperation.rendererHeapGrowth,
          )} threshold`,
        ).toBeLessThan(MEMORY_THRESHOLDS.singleOperation.rendererHeapGrowth);
      }
    });

    test("should measure memory of fetching all cards via IPC", async ({
      app,
      page,
    }) => {
      await waitForHydration(page);
      await seedDivinationCards(page, RARITY_INSIGHTS_CARDS);

      const profiler = new MemoryProfiler(app, page);
      await profiler.baseline();

      // Call getAll via the IPC bridge (this serializes all card DTOs)
      const cards = await callElectronAPI<unknown[]>(
        page,
        "divinationCards",
        "getAll",
      );

      const report = await profiler.snapshot("after IPC getAll cards");

      console.log("[Memory] After IPC getAll cards:");
      console.log(`  Cards returned: ${cards?.length ?? 0}`);
      console.log(report.summary);

      // Log per-card memory cost estimate
      if (report.delta && cards && cards.length > 0) {
        const perCard = report.delta.renderer.usedJSHeapSize / cards.length;
        console.log(
          `  Estimated renderer cost per card: ${formatBytes(perCard)}`,
        );
      }
    });
  });

// ─── Navigation Stress ────────────────────────────────────────────────────────

test.describe
  .skip("Memory Profiling — Navigation Stress", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should not leak memory during rapid navigation", async ({
      app,
      page,
    }) => {
      await waitForHydration(page);

      const routes = [
        "/cards",
        "/sessions",
        "/statistics",
        "/profit-forecast",
        "/rarity-insights",
        "/settings",
        "/",
      ];

      const result = await detectMemoryTrend(
        app,
        page,
        async () => {
          // Navigate through all routes in a cycle
          for (const route of routes) {
            await navigateTo(page, route, { waitForNavigation: false });
            await page.waitForTimeout(200);
          }
          // Wait for the last navigation to settle
          await page
            .locator("main")
            .waitFor({ state: "visible", timeout: 10_000 });
        },
        5, // 5 iterations = 35 route changes total
        { gc: true, stabilizeMs: 300 },
      );

      // Log all iteration snapshots
      console.log("[Memory] Navigation stress test snapshots:");
      for (const snap of result.snapshots) {
        console.log(
          `  ${snap.label}: main heap=${formatBytes(
            snap.main.heapUsed,
          )}, renderer heap=${formatBytes(snap.renderer.usedJSHeapSize)}`,
        );
      }
      console.log(
        `  Main heap growth/iteration:     ${formatBytes(
          result.mainHeapGrowthPerIteration,
        )}`,
      );
      console.log(
        `  Renderer heap growth/iteration: ${formatBytes(
          result.rendererHeapGrowthPerIteration,
        )}`,
      );
      console.log(
        `  Main heap monotonically increasing:     ${result.mainHeapMonotonicallyIncreasing}`,
      );
      console.log(
        `  Renderer heap monotonically increasing: ${result.rendererHeapMonotonicallyIncreasing}`,
      );

      // Total growth across all iterations should stay within bounds
      const first = result.snapshots[0];
      const last = result.snapshots[result.snapshots.length - 1];
      const totalMainGrowth = last.main.heapUsed - first.main.heapUsed;
      const totalRendererGrowth =
        last.renderer.usedJSHeapSize - first.renderer.usedJSHeapSize;

      expect(
        totalMainGrowth,
        `Main heap grew ${formatBytes(totalMainGrowth)} over ${
          result.snapshots.length - 1
        } navigation cycles — exceeds ${formatBytes(
          MEMORY_THRESHOLDS.navigationStress.mainHeapGrowth,
        )} threshold`,
      ).toBeLessThan(MEMORY_THRESHOLDS.navigationStress.mainHeapGrowth);

      expect(
        totalRendererGrowth,
        `Renderer heap grew ${formatBytes(totalRendererGrowth)} over ${
          result.snapshots.length - 1
        } navigation cycles — exceeds ${formatBytes(
          MEMORY_THRESHOLDS.navigationStress.rendererHeapGrowth,
        )} threshold`,
      ).toBeLessThan(MEMORY_THRESHOLDS.navigationStress.rendererHeapGrowth);

      // Warn (but don't fail) if heap is monotonically increasing — it's a leak signal
      if (result.mainHeapMonotonicallyIncreasing) {
        console.warn(
          "[Memory] ⚠️  Main process heap grew monotonically across all iterations — possible leak",
        );
      }
      if (result.rendererHeapMonotonicallyIncreasing) {
        console.warn(
          "[Memory] ⚠️  Renderer heap grew monotonically across all iterations — possible leak",
        );
      }
    });

    test("should measure memory after repeated card page visits", async ({
      app,
      page,
    }) => {
      await waitForHydration(page);
      await seedDivinationCards(page, RARITY_INSIGHTS_CARDS);

      const profiler = new MemoryProfiler(app, page);
      await profiler.baseline();

      // Visit the cards page 5 times, navigating away and back
      for (let i = 0; i < 5; i++) {
        await navigateTo(page, "/cards");
        await page
          .locator("main")
          .waitFor({ state: "visible", timeout: 10_000 });
        await page.waitForTimeout(500);

        await navigateTo(page, "/");
        await page
          .locator("main")
          .waitFor({ state: "visible", timeout: 10_000 });
        await page.waitForTimeout(300);

        const report = await profiler.incrementalSnapshot(
          `card-visit-${i + 1}`,
        );
        console.log(
          `[Memory] Card visit #${i + 1}: main heap=${formatBytes(
            report.snapshot.main.heapUsed,
          )}, renderer heap=${formatBytes(
            report.snapshot.renderer.usedJSHeapSize,
          )}` +
            (report.delta
              ? ` (Δ main: ${formatBytes(
                  report.delta.main.heapUsed,
                )}, Δ renderer: ${formatBytes(
                  report.delta.renderer.usedJSHeapSize,
                )})`
              : ""),
        );
      }

      // Final assessment
      const fullReport = profiler.fullReport();
      console.log(`\n${fullReport}`);

      // Total growth from baseline to last visit should be bounded
      const baseline = profiler.getBaseline()!;
      const last = profiler.lastSnapshot()!;
      const totalDelta = computeDelta(baseline, last);

      expect(
        totalDelta.main.heapUsed,
        `Main heap grew ${formatBytes(
          totalDelta.main.heapUsed,
        )} over 5 card page visits`,
      ).toBeLessThan(MEMORY_THRESHOLDS.singleOperation.mainHeapGrowth);

      expect(
        totalDelta.renderer.usedJSHeapSize,
        `Renderer heap grew ${formatBytes(
          totalDelta.renderer.usedJSHeapSize,
        )} over 5 card page visits`,
      ).toBeLessThan(MEMORY_THRESHOLDS.singleOperation.rendererHeapGrowth);
    });
  });

// ─── Session Operations ───────────────────────────────────────────────────────

test.describe
  .skip("Memory Profiling — Session Operations", () => {
    test.beforeEach(async ({ page }) => {
      await ensurePostSetup(page);
    });

    test("should measure memory impact of starting and stopping sessions", async ({
      app,
      page,
    }) => {
      await waitForHydration(page);

      // Seed prerequisites so sessions can be created
      await seedSessionPrerequisites(page);

      const profiler = new MemoryProfiler(app, page);
      await profiler.baseline();

      // Start and stop a session 3 times
      for (let i = 0; i < 3; i++) {
        try {
          await callElectronAPI(page, "session", "start", "poe1", "Standard");
          await page.waitForTimeout(500);
          await callElectronAPI(page, "session", "stop", "poe1");
          await page.waitForTimeout(300);
        } catch {
          // Session operations may fail if prerequisites aren't fully met —
          // that's OK, we're measuring memory, not session correctness
          console.log(
            `[Memory] Session cycle #${i + 1} had an error — continuing`,
          );
        }

        const report = await profiler.incrementalSnapshot(
          `session-cycle-${i + 1}`,
        );
        console.log(
          `[Memory] Session cycle #${i + 1}: main heap=${formatBytes(
            report.snapshot.main.heapUsed,
          )}`,
        );
      }

      const fullReport = profiler.fullReport();
      console.log(`\n${fullReport}`);

      // Session start/stop should not leak — total growth should be minimal
      const baseline = profiler.getBaseline()!;
      const last = profiler.lastSnapshot()!;
      const totalDelta = computeDelta(baseline, last);

      expect(
        totalDelta.main.heapUsed,
        `Main heap grew ${formatBytes(
          totalDelta.main.heapUsed,
        )} over 3 session cycles`,
      ).toBeLessThan(MEMORY_THRESHOLDS.singleOperation.mainHeapGrowth);
    });
  });

// ─── Full Lifecycle Report ────────────────────────────────────────────────────

test.describe
  .skip("Memory Profiling — Full Lifecycle", () => {
    test("should produce a comprehensive memory report across app lifecycle", async ({
      app,
      page,
    }) => {
      // Phase 1: App launch (pre-setup)
      const profiler = new MemoryProfiler(app, page);
      await profiler.baseline();
      console.log("[Memory] Phase 1: App launched");

      // Phase 2: After setup/hydration
      await mockSetupComplete(page);
      await waitForHydration(page, 30_000);
      const postSetup = await profiler.snapshot("post-setup-hydration");
      console.log("[Memory] Phase 2: Post-setup hydration");
      console.log(postSetup.summary);

      // Phase 3: After seeding cards
      await seedDivinationCards(page, RARITY_INSIGHTS_CARDS);
      const postSeed = await profiler.snapshot("post-card-seed");
      console.log("[Memory] Phase 3: Post card seed");
      console.log(postSeed.summary);

      // Phase 4: After navigating to cards page
      await navigateTo(page, "/cards");
      await page.locator("main").waitFor({ state: "visible", timeout: 15_000 });
      await page.waitForTimeout(2_000);
      const postCards = await profiler.snapshot("post-cards-page");
      console.log("[Memory] Phase 4: Cards page rendered");
      console.log(postCards.summary);

      // Phase 5: After visiting multiple pages
      const pageRoutes = [
        "/sessions",
        "/statistics",
        "/rarity-insights",
        "/profit-forecast",
        "/settings",
      ];
      for (const route of pageRoutes) {
        await navigateTo(page, route);
        await page
          .locator("main")
          .waitFor({ state: "visible", timeout: 10_000 });
        await page.waitForTimeout(500);
      }
      const postMultiPage = await profiler.snapshot("post-multi-page-tour");
      console.log("[Memory] Phase 5: After visiting all pages");
      console.log(postMultiPage.summary);

      // Phase 6: Return to home and settle
      await navigateTo(page, "/");
      await page.locator("main").waitFor({ state: "visible", timeout: 10_000 });
      await page.waitForTimeout(2_000);
      const postSettle = await profiler.snapshot("post-settle");
      console.log("[Memory] Phase 6: Settled on home page");
      console.log(postSettle.summary);

      // ── Full Report ──
      console.log(`\n${profiler.fullReport()}`);

      // ── Assertions ──

      // The app at rest (Phase 6) should not have grown excessively from
      // the post-setup baseline (Phase 2)
      const lifecycleDelta = computeDelta(
        postSetup.snapshot,
        postSettle.snapshot,
      );

      console.log("\n[Memory] Lifecycle delta (setup → settle):");
      console.log(formatDeltaSummary(lifecycleDelta));

      // Main RSS should not grow more than 100 MB across the full lifecycle
      expect(
        lifecycleDelta.main.rss,
        `Main RSS grew ${formatBytes(
          lifecycleDelta.main.rss,
        )} across full lifecycle`,
      ).toBeLessThan(100 * 1024 * 1024);

      // Renderer heap should not grow more than 50 MB across the full lifecycle
      expect(
        lifecycleDelta.renderer.usedJSHeapSize,
        `Renderer heap grew ${formatBytes(
          lifecycleDelta.renderer.usedJSHeapSize,
        )} across full lifecycle`,
      ).toBeLessThan(50 * 1024 * 1024);
    });
  });
