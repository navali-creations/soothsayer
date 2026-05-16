import type BetterSqlite3 from "better-sqlite3";

import type {
  AppPerformanceCaptureDTO,
  AppPerformanceCaptureSparklineSampleDTO,
  AppPerformanceCaptureSummaryDTO,
  AppPerformanceMetricComparisonDirection,
  AppPerformanceMetricComparisonDTO,
  AppPerformanceRetention,
  AppPerformanceRouteMarkerDTO,
  AppPerformanceSampleDTO,
  AppPerformanceStateDTO,
} from "./AppPerformance.dto";
import {
  type AppPerformanceMetricStats,
  type AppPerformanceReportStats,
  estimateAppPerformanceStorageBytes,
} from "./AppPerformance.utils";

const CLEANUP_DELETE_BATCH_SIZE = 200;
const CAPTURE_SUMMARY_SPARKLINE_SAMPLE_LIMIT = 36;
const REPORT_SAMPLE_LIMIT = 240;
const REPORT_ROUTE_MARKER_LIMIT = 1_000;

type CaptureRow = {
  id: string;
  started_at: string;
  stopped_at: string | null;
};

type SampleRow = {
  sampled_at: string;
  uptime_ms: number;
  capture_elapsed_ms: number;
  route: string | null;
  fps: number | null;
  system_cpu_percent: number | null;
  app_cpu_percent: number | null;
  system_memory_used_percent: number | null;
  system_memory_total_bytes: number | null;
  system_memory_free_bytes: number | null;
  app_memory_bytes: number | null;
  app_memory_percent: number | null;
  main_heap_used_bytes: number | null;
  renderer_memory_bytes: number | null;
  renderer_heap_used_bytes: number | null;
};

type MarkerRow = {
  id: string;
  route: string;
  label: string;
  marked_at: string;
  elapsed_ms: number;
};

type CaptureSummaryRow = {
  id: string;
  started_at: string;
  stopped_at: string | null;
  sample_count: number;
  route_marker_count: number;
  last_elapsed_ms: number | null;
  fps_min: number | null;
  fps_avg: number | null;
  fps_max: number | null;
  cpu_min: number | null;
  cpu_avg: number | null;
  cpu_max: number | null;
  memory_min: number | null;
  memory_avg: number | null;
  memory_max: number | null;
  system_memory_min: number | null;
  system_memory_avg: number | null;
  system_memory_max: number | null;
  app_memory_bytes_min: number | null;
  app_memory_bytes_avg: number | null;
  app_memory_bytes_max: number | null;
  previous_fps_min: number | null;
  previous_fps_avg: number | null;
  previous_fps_max: number | null;
  previous_cpu_min: number | null;
  previous_cpu_avg: number | null;
  previous_cpu_max: number | null;
  previous_memory_min: number | null;
  previous_memory_avg: number | null;
  previous_memory_max: number | null;
  previous_app_memory_bytes_min: number | null;
  previous_app_memory_bytes_avg: number | null;
  previous_app_memory_bytes_max: number | null;
};

type CaptureSummarySparklineSampleRow = {
  collection_id: string;
  capture_elapsed_ms: number;
  fps: number | null;
  app_cpu_percent: number | null;
  app_memory_bytes: number | null;
  app_memory_percent: number | null;
  system_memory_used_percent: number | null;
};

type ReportSampleAggregateRow = {
  sample_count: number;
  fps_min: number | null;
  fps_avg: number | null;
  fps_max: number | null;
  app_cpu_min: number | null;
  app_cpu_avg: number | null;
  app_cpu_max: number | null;
  system_cpu_min: number | null;
  system_cpu_avg: number | null;
  system_cpu_max: number | null;
  app_memory_percent_min: number | null;
  app_memory_percent_avg: number | null;
  app_memory_percent_max: number | null;
  system_memory_min: number | null;
  system_memory_avg: number | null;
  system_memory_max: number | null;
  app_memory_bytes_min: number | null;
  app_memory_bytes_avg: number | null;
  app_memory_bytes_max: number | null;
};

type ReportSampleCurrentRow = {
  fps_current: number | null;
  app_cpu_current: number | null;
  system_cpu_current: number | null;
  app_memory_percent_current: number | null;
  system_memory_current: number | null;
  app_memory_bytes_current: number | null;
};

interface ListCaptureSummaryOptions {
  limit?: number;
  offset?: number;
}

interface CaptureStateOptions {
  sampleLimit?: number;
  sampleMode?: "latest" | "span";
  routeMarkerLimit?: number;
}

export interface AppPerformanceRowCounts {
  captures: number;
  samples: number;
  routeMarkers: number;
}

export interface AppPerformanceReportData {
  capture: AppPerformanceCaptureDTO | null;
  isSampling: boolean;
  samples: AppPerformanceSampleDTO[];
  routeMarkers: AppPerformanceRouteMarkerDTO[];
  sampleCount: number;
  routeMarkerCount: number;
  stats: AppPerformanceReportStats;
}

export class AppPerformanceRepository {
  constructor(private db: BetterSqlite3.Database) {}

  createCapture(capture: AppPerformanceCaptureDTO): void {
    this.db
      .prepare(
        `
        INSERT INTO app_performance_captures (id, started_at, stopped_at)
        VALUES (@id, @startedAt, @stoppedAt)
      `,
      )
      .run(capture);
  }

  stopCapture(collectionId: string, stoppedAt: string): void {
    this.db
      .prepare(
        `
        UPDATE app_performance_captures
        SET stopped_at = ?
        WHERE id = ?
      `,
      )
      .run(stoppedAt, collectionId);
  }

  closeOpenCaptures(stoppedAt: string): number {
    const result = this.db
      .prepare(
        `
        UPDATE app_performance_captures
        SET stopped_at = ?
        WHERE stopped_at IS NULL
      `,
      )
      .run(stoppedAt);

    return result.changes;
  }

  deleteCapture(collectionId: string): number {
    return this.deleteCaptures([collectionId]);
  }

  deleteCaptures(collectionIds: string[]): number {
    const uniqueIds = Array.from(new Set(collectionIds));
    if (uniqueIds.length === 0) return 0;

    const placeholders = uniqueIds.map(() => "?").join(", ");
    const deleteSamples = this.db.prepare(`
      DELETE FROM app_performance_samples
      WHERE collection_id IN (${placeholders})
    `);
    const deleteRouteMarkers = this.db.prepare(`
      DELETE FROM app_performance_route_markers
      WHERE collection_id IN (${placeholders})
    `);
    const deleteCaptures = this.db.prepare(`
      DELETE FROM app_performance_captures
      WHERE id IN (${placeholders})
    `);
    const deleteMany = this.db.transaction((ids: string[]) => {
      deleteSamples.run(...ids);
      deleteRouteMarkers.run(...ids);
      const result = deleteCaptures.run(...ids);
      return result.changes;
    });

    return deleteMany(uniqueIds);
  }

  insertSamples(
    collectionId: string,
    samples: AppPerformanceSampleDTO[],
  ): void {
    if (samples.length === 0) return;

    const stmt = this.db.prepare(`
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
      VALUES (
        @collectionId,
        @sampledAt,
        @uptimeMs,
        @captureElapsedMs,
        @route,
        @fps,
        @systemCpuPercent,
        @appCpuPercent,
        @systemMemoryUsedPercent,
        @systemMemoryTotalBytes,
        @systemMemoryFreeBytes,
        @appMemoryBytes,
        @appMemoryPercent,
        @mainHeapUsedBytes,
        @rendererMemoryBytes,
        @rendererHeapUsedBytes
      )
    `);

    const insertMany = this.db.transaction(
      (rows: AppPerformanceSampleDTO[]) => {
        for (const sample of rows) {
          stmt.run({ collectionId, ...sample });
        }
      },
    );

    insertMany(samples);
  }

  insertRouteMarker(
    collectionId: string,
    marker: AppPerformanceRouteMarkerDTO,
  ): void {
    this.db
      .prepare(
        `
        INSERT OR IGNORE INTO app_performance_route_markers (
          id,
          collection_id,
          route,
          label,
          marked_at,
          elapsed_ms
        )
        VALUES (@id, @collectionId, @route, @label, @markedAt, @elapsedMs)
      `,
      )
      .run({ collectionId, ...marker });
  }

  getCapture(id: string): AppPerformanceCaptureDTO | null {
    const row = this.db
      .prepare(
        `
        SELECT id, started_at, stopped_at
        FROM app_performance_captures
        WHERE id = ?
      `,
      )
      .get(id) as CaptureRow | undefined;

    return row ? this.mapCapture(row) : null;
  }

  getLatestCapture(): AppPerformanceCaptureDTO | null {
    const row = this.db
      .prepare(
        `
        SELECT id, started_at, stopped_at
        FROM app_performance_captures
        ORDER BY started_at DESC
        LIMIT 1
      `,
      )
      .get() as CaptureRow | undefined;

    return row ? this.mapCapture(row) : null;
  }

  listCaptureSummaries(
    options: ListCaptureSummaryOptions = {},
    now = new Date(),
  ): AppPerformanceCaptureSummaryDTO[] {
    const limit = clampPositiveInteger(options.limit ?? 5, 1, 100);
    const offset = clampPositiveInteger(options.offset ?? 0, 0, 100_000);
    const rows = this.db
      .prepare(
        `
        WITH selected_captures AS (
          SELECT id, started_at, stopped_at
          FROM app_performance_captures
          ORDER BY started_at DESC
          LIMIT ? OFFSET ?
        ),
        previous_captures AS (
          SELECT p.id, p.started_at, p.stopped_at
          FROM app_performance_captures p
          WHERE p.id IN (
            SELECT (
              SELECT p2.id
              FROM app_performance_captures p2
              WHERE p2.started_at < selected_captures.started_at
              ORDER BY p2.started_at DESC
              LIMIT 1
            )
            FROM selected_captures
          )
        ),
        comparison_captures AS (
          SELECT * FROM selected_captures
          UNION
          SELECT * FROM previous_captures
        ),
        sample_summaries AS (
          SELECT
            collection_id,
            COUNT(*) AS sample_count,
            MAX(capture_elapsed_ms) AS last_elapsed_ms,
            MIN(fps) AS fps_min,
            AVG(fps) AS fps_avg,
            MAX(fps) AS fps_max,
            MIN(app_cpu_percent) AS cpu_min,
            AVG(app_cpu_percent) AS cpu_avg,
            MAX(app_cpu_percent) AS cpu_max,
            MIN(app_memory_percent) AS memory_min,
            AVG(app_memory_percent) AS memory_avg,
            MAX(app_memory_percent) AS memory_max,
            MIN(system_memory_used_percent) AS system_memory_min,
            AVG(system_memory_used_percent) AS system_memory_avg,
            MAX(system_memory_used_percent) AS system_memory_max,
            MIN(app_memory_bytes) AS app_memory_bytes_min,
            AVG(app_memory_bytes) AS app_memory_bytes_avg,
            MAX(app_memory_bytes) AS app_memory_bytes_max
          FROM app_performance_samples
          WHERE collection_id IN (SELECT id FROM comparison_captures)
          GROUP BY collection_id
        ),
        route_marker_counts AS (
          SELECT collection_id, COUNT(*) AS route_marker_count
          FROM app_performance_route_markers
          WHERE collection_id IN (SELECT id FROM comparison_captures)
          GROUP BY collection_id
        ),
        capture_summaries AS (
          SELECT
            c.id,
            c.started_at,
            c.stopped_at,
            COALESCE(s.sample_count, 0) AS sample_count,
            COALESCE(m.route_marker_count, 0) AS route_marker_count,
            s.last_elapsed_ms,
            s.fps_min,
            s.fps_avg,
            s.fps_max,
            s.cpu_min,
            s.cpu_avg,
            s.cpu_max,
            s.memory_min,
            s.memory_avg,
            s.memory_max,
            s.system_memory_min,
            s.system_memory_avg,
            s.system_memory_max,
            s.app_memory_bytes_min,
            s.app_memory_bytes_avg,
            s.app_memory_bytes_max
          FROM comparison_captures c
          LEFT JOIN sample_summaries s ON s.collection_id = c.id
          LEFT JOIN route_marker_counts m ON m.collection_id = c.id
        ),
        ranked_summaries AS (
          SELECT
            *,
            LAG(fps_min) OVER (ORDER BY started_at ASC) AS previous_fps_min,
            LAG(fps_avg) OVER (ORDER BY started_at ASC) AS previous_fps_avg,
            LAG(fps_max) OVER (ORDER BY started_at ASC) AS previous_fps_max,
            LAG(cpu_min) OVER (ORDER BY started_at ASC) AS previous_cpu_min,
            LAG(cpu_avg) OVER (ORDER BY started_at ASC) AS previous_cpu_avg,
            LAG(cpu_max) OVER (ORDER BY started_at ASC) AS previous_cpu_max,
            LAG(memory_min) OVER (ORDER BY started_at ASC) AS previous_memory_min,
            LAG(memory_avg) OVER (ORDER BY started_at ASC) AS previous_memory_avg,
            LAG(memory_max) OVER (ORDER BY started_at ASC) AS previous_memory_max,
            LAG(app_memory_bytes_min) OVER (ORDER BY started_at ASC) AS previous_app_memory_bytes_min,
            LAG(app_memory_bytes_avg) OVER (ORDER BY started_at ASC) AS previous_app_memory_bytes_avg,
            LAG(app_memory_bytes_max) OVER (ORDER BY started_at ASC) AS previous_app_memory_bytes_max
          FROM capture_summaries
        )
        SELECT
          *
        FROM ranked_summaries
        WHERE id IN (SELECT id FROM selected_captures)
        ORDER BY started_at DESC
      `,
      )
      .all(limit, offset) as CaptureSummaryRow[];

    const sparklineSamplesByCaptureId = this.listCaptureSummarySparklineSamples(
      rows.map((row) => row.id),
    );

    return rows.map((row) =>
      this.mapCaptureSummary(
        row,
        now,
        sparklineSamplesByCaptureId.get(row.id) ?? [],
      ),
    );
  }

  getSamples(
    collectionId: string,
    options: Pick<CaptureStateOptions, "sampleLimit" | "sampleMode"> = {},
  ): AppPerformanceSampleDTO[] {
    const limit = normalizeOptionalLimit(options.sampleLimit);
    if (limit !== null) {
      if (limit === 0) return [];

      if (options.sampleMode === "span") {
        const rows = this.db
          .prepare(
            `
            WITH numbered_samples AS (
              SELECT
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
                renderer_heap_used_bytes,
                ROW_NUMBER() OVER (
                  ORDER BY capture_elapsed_ms ASC, sampled_at ASC
                ) AS sample_index,
                COUNT(*) OVER () AS sample_count
              FROM app_performance_samples
              WHERE collection_id = ?
            ),
            bucketed_samples AS (
              SELECT
                *,
                CAST(((sample_index - 1) * ?) / sample_count AS INTEGER) AS bucket
              FROM numbered_samples
            ),
            selected_samples AS (
              SELECT
                *,
                ROW_NUMBER() OVER (
                  PARTITION BY bucket
                  ORDER BY sample_index ASC
                ) AS bucket_row
              FROM bucketed_samples
            )
            SELECT
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
            FROM selected_samples
            WHERE sample_count <= ? OR bucket_row = 1
            ORDER BY capture_elapsed_ms ASC, sampled_at ASC
          `,
          )
          .all(collectionId, limit, limit) as SampleRow[];

        return rows.map(this.mapSample);
      }

      const rows = this.db
        .prepare(
          `
          SELECT *
          FROM (
            SELECT
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
            FROM app_performance_samples
            WHERE collection_id = ?
            ORDER BY sampled_at DESC
            LIMIT ?
          )
          ORDER BY sampled_at ASC
        `,
        )
        .all(collectionId, limit) as SampleRow[];

      return rows.map(this.mapSample);
    }

    const rows = this.db
      .prepare(
        `
        SELECT
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
        FROM app_performance_samples
        WHERE collection_id = ?
        ORDER BY sampled_at ASC
      `,
      )
      .all(collectionId) as SampleRow[];

    return rows.map(this.mapSample);
  }

  getRouteMarkers(collectionId: string): AppPerformanceRouteMarkerDTO[] {
    return this.getRouteMarkersWithOptions(collectionId);
  }

  private getRouteMarkersWithOptions(
    collectionId: string,
    options: Pick<CaptureStateOptions, "routeMarkerLimit"> = {},
  ): AppPerformanceRouteMarkerDTO[] {
    const limit = normalizeOptionalLimit(options.routeMarkerLimit);
    if (limit !== null) {
      const rows = this.db
        .prepare(
          `
          SELECT *
          FROM (
            SELECT id, route, label, marked_at, elapsed_ms
            FROM app_performance_route_markers
            WHERE collection_id = ?
            ORDER BY marked_at DESC
            LIMIT ?
          )
          ORDER BY marked_at ASC
        `,
        )
        .all(collectionId, limit) as MarkerRow[];

      return rows.map(this.mapMarker);
    }

    const rows = this.db
      .prepare(
        `
        SELECT id, route, label, marked_at, elapsed_ms
        FROM app_performance_route_markers
        WHERE collection_id = ?
        ORDER BY marked_at ASC
      `,
      )
      .all(collectionId) as MarkerRow[];

    return rows.map(this.mapMarker);
  }

  getStateForCapture(
    collectionId: string,
    isSampling: boolean,
    options: CaptureStateOptions = {},
  ): AppPerformanceStateDTO {
    const capture = this.getCapture(collectionId);
    return {
      capture,
      isSampling,
      samples: this.getSamples(collectionId, options),
      routeMarkers: this.getRouteMarkersWithOptions(collectionId, options),
    };
  }

  getReportDataForCapture(
    collectionId: string,
    isSampling: boolean,
    options: CaptureStateOptions = {},
  ): AppPerformanceReportData {
    const reportStats = this.getReportStats(collectionId);

    return {
      capture: this.getCapture(collectionId),
      isSampling,
      samples: this.getSamples(collectionId, {
        sampleLimit: options.sampleLimit ?? REPORT_SAMPLE_LIMIT,
      }),
      routeMarkers: this.getRouteMarkersWithOptions(collectionId, {
        routeMarkerLimit: options.routeMarkerLimit ?? REPORT_ROUTE_MARKER_LIMIT,
      }),
      sampleCount: reportStats.sampleCount,
      routeMarkerCount: this.countRouteMarkersForCapture(collectionId),
      stats: reportStats.stats,
    };
  }

  hasData(): boolean {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM app_performance_captures")
      .get() as { count: number };
    return row.count > 0;
  }

  countCaptures(): number {
    const row = this.db
      .prepare("SELECT COUNT(*) AS count FROM app_performance_captures")
      .get() as { count: number };
    return row.count;
  }

  getRowCounts(): AppPerformanceRowCounts {
    const captures = this.db
      .prepare("SELECT COUNT(*) AS count FROM app_performance_captures")
      .get() as { count: number };
    const samples = this.db
      .prepare("SELECT COUNT(*) AS count FROM app_performance_samples")
      .get() as { count: number };
    const routeMarkers = this.db
      .prepare("SELECT COUNT(*) AS count FROM app_performance_route_markers")
      .get() as { count: number };

    return {
      captures: captures.count,
      samples: samples.count,
      routeMarkers: routeMarkers.count,
    };
  }

  cleanup(retention: AppPerformanceRetention, now = new Date()): number {
    if (retention === "indefinite" || !this.hasData()) return 0;

    const ageMs =
      retention === "24h" ? 24 * 60 * 60 * 1000 : 7 * 24 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - ageMs).toISOString();
    const selectExpiredIds = this.db.prepare(`
        SELECT id
        FROM app_performance_captures
        WHERE started_at < ?
        LIMIT ?
      `);
    let deletedCount = 0;

    while (true) {
      const rows = selectExpiredIds.all(
        cutoff,
        CLEANUP_DELETE_BATCH_SIZE,
      ) as Array<{ id: string }>;
      if (rows.length === 0) break;

      const deletedInBatch = this.deleteCaptures(rows.map((row) => row.id));
      deletedCount += deletedInBatch;
      if (rows.length < CLEANUP_DELETE_BATCH_SIZE || deletedInBatch === 0) {
        break;
      }
    }

    return deletedCount;
  }

  private getReportStats(collectionId: string): {
    sampleCount: number;
    stats: AppPerformanceReportStats;
  } {
    const aggregate = this.db
      .prepare(
        `
        SELECT
          COUNT(*) AS sample_count,
          MIN(fps) AS fps_min,
          AVG(fps) AS fps_avg,
          MAX(fps) AS fps_max,
          MIN(app_cpu_percent) AS app_cpu_min,
          AVG(app_cpu_percent) AS app_cpu_avg,
          MAX(app_cpu_percent) AS app_cpu_max,
          MIN(system_cpu_percent) AS system_cpu_min,
          AVG(system_cpu_percent) AS system_cpu_avg,
          MAX(system_cpu_percent) AS system_cpu_max,
          MIN(app_memory_percent) AS app_memory_percent_min,
          AVG(app_memory_percent) AS app_memory_percent_avg,
          MAX(app_memory_percent) AS app_memory_percent_max,
          MIN(system_memory_used_percent) AS system_memory_min,
          AVG(system_memory_used_percent) AS system_memory_avg,
          MAX(system_memory_used_percent) AS system_memory_max,
          MIN(app_memory_bytes) AS app_memory_bytes_min,
          AVG(app_memory_bytes) AS app_memory_bytes_avg,
          MAX(app_memory_bytes) AS app_memory_bytes_max
        FROM app_performance_samples
        WHERE collection_id = ?
      `,
      )
      .get(collectionId) as ReportSampleAggregateRow;

    const current = this.db
      .prepare(
        `
        SELECT
          (
            SELECT fps
            FROM app_performance_samples
            WHERE collection_id = @collectionId AND fps IS NOT NULL
            ORDER BY sampled_at DESC
            LIMIT 1
          ) AS fps_current,
          (
            SELECT app_cpu_percent
            FROM app_performance_samples
            WHERE collection_id = @collectionId AND app_cpu_percent IS NOT NULL
            ORDER BY sampled_at DESC
            LIMIT 1
          ) AS app_cpu_current,
          (
            SELECT system_cpu_percent
            FROM app_performance_samples
            WHERE collection_id = @collectionId AND system_cpu_percent IS NOT NULL
            ORDER BY sampled_at DESC
            LIMIT 1
          ) AS system_cpu_current,
          (
            SELECT app_memory_percent
            FROM app_performance_samples
            WHERE collection_id = @collectionId AND app_memory_percent IS NOT NULL
            ORDER BY sampled_at DESC
            LIMIT 1
          ) AS app_memory_percent_current,
          (
            SELECT system_memory_used_percent
            FROM app_performance_samples
            WHERE collection_id = @collectionId AND system_memory_used_percent IS NOT NULL
            ORDER BY sampled_at DESC
            LIMIT 1
          ) AS system_memory_current,
          (
            SELECT app_memory_bytes
            FROM app_performance_samples
            WHERE collection_id = @collectionId AND app_memory_bytes IS NOT NULL
            ORDER BY sampled_at DESC
            LIMIT 1
          ) AS app_memory_bytes_current
      `,
      )
      .get({ collectionId }) as ReportSampleCurrentRow;

    return {
      sampleCount: aggregate.sample_count,
      stats: {
        fps: mapMetricStats(
          current.fps_current,
          aggregate.fps_min,
          aggregate.fps_avg,
          aggregate.fps_max,
        ),
        appCpu: mapMetricStats(
          current.app_cpu_current,
          aggregate.app_cpu_min,
          aggregate.app_cpu_avg,
          aggregate.app_cpu_max,
        ),
        systemCpu: mapMetricStats(
          current.system_cpu_current,
          aggregate.system_cpu_min,
          aggregate.system_cpu_avg,
          aggregate.system_cpu_max,
        ),
        appMemoryPercent: mapMetricStats(
          current.app_memory_percent_current,
          aggregate.app_memory_percent_min,
          aggregate.app_memory_percent_avg,
          aggregate.app_memory_percent_max,
        ),
        systemMemory: mapMetricStats(
          current.system_memory_current,
          aggregate.system_memory_min,
          aggregate.system_memory_avg,
          aggregate.system_memory_max,
        ),
        appMemoryBytes: mapMetricStats(
          current.app_memory_bytes_current,
          aggregate.app_memory_bytes_min,
          aggregate.app_memory_bytes_avg,
          aggregate.app_memory_bytes_max,
        ),
      },
    };
  }

  private countRouteMarkersForCapture(collectionId: string): number {
    const row = this.db
      .prepare(
        `
        SELECT COUNT(*) AS count
        FROM app_performance_route_markers
        WHERE collection_id = ?
      `,
      )
      .get(collectionId) as { count: number };

    return row.count;
  }

  private listCaptureSummarySparklineSamples(
    captureIds: string[],
  ): Map<string, AppPerformanceCaptureSparklineSampleDTO[]> {
    const samplesByCaptureId = new Map<
      string,
      AppPerformanceCaptureSparklineSampleDTO[]
    >(captureIds.map((id) => [id, []]));

    if (captureIds.length === 0) return samplesByCaptureId;

    const placeholders = captureIds.map(() => "?").join(", ");
    const rows = this.db
      .prepare(
        `
        WITH numbered_samples AS (
          SELECT
            collection_id,
            capture_elapsed_ms,
            fps,
            app_cpu_percent,
            app_memory_bytes,
            app_memory_percent,
            system_memory_used_percent,
            ROW_NUMBER() OVER (
              PARTITION BY collection_id
              ORDER BY capture_elapsed_ms ASC, sampled_at ASC
            ) AS sample_index,
            COUNT(*) OVER (PARTITION BY collection_id) AS sample_count
          FROM app_performance_samples
          WHERE collection_id IN (${placeholders})
        ),
        bucketed_samples AS (
          SELECT
            *,
            CAST(
              ((sample_index - 1) * ?) / sample_count AS INTEGER
            ) AS bucket
          FROM numbered_samples
        )
        SELECT
          collection_id,
          MIN(capture_elapsed_ms) AS capture_elapsed_ms,
          AVG(fps) AS fps,
          AVG(app_cpu_percent) AS app_cpu_percent,
          AVG(app_memory_bytes) AS app_memory_bytes,
          AVG(app_memory_percent) AS app_memory_percent,
          AVG(system_memory_used_percent) AS system_memory_used_percent
        FROM bucketed_samples
        GROUP BY collection_id, bucket
        ORDER BY collection_id ASC, capture_elapsed_ms ASC
      `,
      )
      .all(
        ...captureIds,
        CAPTURE_SUMMARY_SPARKLINE_SAMPLE_LIMIT,
      ) as CaptureSummarySparklineSampleRow[];

    for (const row of rows) {
      samplesByCaptureId.get(row.collection_id)?.push({
        captureElapsedMs: Number.isFinite(row.capture_elapsed_ms)
          ? row.capture_elapsed_ms
          : 0,
        fps: normalizeNullableNumber(row.fps),
        appCpuPercent: normalizeNullableNumber(row.app_cpu_percent),
        appMemoryBytes: normalizeNullableNumber(row.app_memory_bytes),
        appMemoryPercent: normalizeNullableNumber(row.app_memory_percent),
        systemMemoryUsedPercent: normalizeNullableNumber(
          row.system_memory_used_percent,
        ),
      });
    }

    return samplesByCaptureId;
  }

  private mapCapture(row: CaptureRow): AppPerformanceCaptureDTO {
    return {
      id: row.id,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
    };
  }

  private mapCaptureSummary(
    row: CaptureSummaryRow,
    now: Date,
    sparklineSamples: AppPerformanceCaptureSparklineSampleDTO[],
  ): AppPerformanceCaptureSummaryDTO {
    const fallbackStop = row.stopped_at ? new Date(row.stopped_at) : now;
    const fallbackDuration = Math.max(
      0,
      fallbackStop.getTime() - new Date(row.started_at).getTime(),
    );

    return {
      id: row.id,
      startedAt: row.started_at,
      stoppedAt: row.stopped_at,
      durationMs:
        typeof row.last_elapsed_ms === "number" && row.last_elapsed_ms > 0
          ? row.last_elapsed_ms
          : fallbackDuration,
      sampleCount: row.sample_count,
      routeMarkerCount: row.route_marker_count,
      estimatedSizeBytes: estimateAppPerformanceStorageBytes({
        captureCount: 1,
        sampleCount: row.sample_count,
        routeMarkerCount: row.route_marker_count,
      }),
      fps: mapMetricSummary(row.fps_min, row.fps_avg, row.fps_max),
      cpu: mapMetricSummary(row.cpu_min, row.cpu_avg, row.cpu_max),
      memory: mapMetricSummary(row.memory_min, row.memory_avg, row.memory_max),
      systemMemory: mapMetricSummary(
        row.system_memory_min,
        row.system_memory_avg,
        row.system_memory_max,
      ),
      appMemoryBytes: mapMetricSummary(
        row.app_memory_bytes_min,
        row.app_memory_bytes_avg,
        row.app_memory_bytes_max,
      ),
      sparklineSamples,
      comparison: {
        fps: mapMetricComparison({
          min: row.fps_min,
          avg: row.fps_avg,
          max: row.fps_max,
          previousMin: row.previous_fps_min,
          previousAvg: row.previous_fps_avg,
          previousMax: row.previous_fps_max,
        }),
        cpu: mapMetricComparison({
          min: row.cpu_min,
          avg: row.cpu_avg,
          max: row.cpu_max,
          previousMin: row.previous_cpu_min,
          previousAvg: row.previous_cpu_avg,
          previousMax: row.previous_cpu_max,
        }),
        memory: mapMetricComparison({
          min: row.memory_min,
          avg: row.memory_avg,
          max: row.memory_max,
          previousMin: row.previous_memory_min,
          previousAvg: row.previous_memory_avg,
          previousMax: row.previous_memory_max,
        }),
        appMemoryBytes: mapMetricComparison({
          min: row.app_memory_bytes_min,
          avg: row.app_memory_bytes_avg,
          max: row.app_memory_bytes_max,
          previousMin: row.previous_app_memory_bytes_min,
          previousAvg: row.previous_app_memory_bytes_avg,
          previousMax: row.previous_app_memory_bytes_max,
        }),
      },
    };
  }

  private mapSample(row: SampleRow): AppPerformanceSampleDTO {
    return {
      sampledAt: row.sampled_at,
      uptimeMs: row.uptime_ms,
      captureElapsedMs: row.capture_elapsed_ms,
      route: row.route,
      fps: row.fps,
      systemCpuPercent: row.system_cpu_percent,
      appCpuPercent: row.app_cpu_percent,
      systemMemoryUsedPercent: row.system_memory_used_percent,
      systemMemoryTotalBytes: row.system_memory_total_bytes,
      systemMemoryFreeBytes: row.system_memory_free_bytes,
      appMemoryBytes: row.app_memory_bytes,
      appMemoryPercent: row.app_memory_percent,
      mainHeapUsedBytes: row.main_heap_used_bytes,
      rendererMemoryBytes: row.renderer_memory_bytes,
      rendererHeapUsedBytes: row.renderer_heap_used_bytes,
    };
  }

  private mapMarker(row: MarkerRow): AppPerformanceRouteMarkerDTO {
    return {
      id: row.id,
      route: row.route,
      label: row.label,
      markedAt: row.marked_at,
      elapsedMs: row.elapsed_ms,
    };
  }
}

function clampPositiveInteger(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

function normalizeOptionalLimit(value: number | undefined): number | null {
  if (value === undefined) return null;
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.floor(value);
}

function mapMetricSummary(
  min: number | null,
  avg: number | null,
  max: number | null,
) {
  return {
    min: normalizeNullableNumber(min),
    avg: normalizeNullableNumber(avg),
    max: normalizeNullableNumber(max),
  };
}

function mapMetricStats(
  current: number | null,
  min: number | null,
  avg: number | null,
  max: number | null,
): AppPerformanceMetricStats {
  return {
    current: normalizeNullableNumber(current),
    min: normalizeNullableNumber(min),
    avg: normalizeNullableNumber(avg),
    max: normalizeNullableNumber(max),
  };
}

function mapMetricComparison({
  min,
  avg,
  max,
  previousMin,
  previousAvg,
  previousMax,
}: {
  min: number | null;
  avg: number | null;
  max: number | null;
  previousMin: number | null;
  previousAvg: number | null;
  previousMax: number | null;
}): AppPerformanceMetricComparisonDTO {
  return {
    min: compareMetricValue(min, previousMin),
    avg: compareMetricValue(avg, previousAvg),
    max: compareMetricValue(max, previousMax),
  };
}

function compareMetricValue(
  value: number | null,
  previousValue: number | null,
): AppPerformanceMetricComparisonDirection {
  if (
    value === null ||
    previousValue === null ||
    !Number.isFinite(value) ||
    !Number.isFinite(previousValue)
  ) {
    return null;
  }

  if (value < previousValue) return "lower";
  if (value > previousValue) return "higher";
  return "same";
}

function normalizeNullableNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}
