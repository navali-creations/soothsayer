import { describe, expect, it } from "vitest";

import type { CsvExportSnapshotsRow } from "~/main/modules/database";

import { CsvIntegrityStatus } from "../Csv.dto";
import { CsvMapper } from "../Csv.mapper";

describe("CsvMapper", () => {
  // ─── toSnapshotDTO ──────────────────────────────────────────────────────

  describe("toSnapshotDTO", () => {
    it("should map all fields from a database row to a DTO", () => {
      const row: CsvExportSnapshotsRow = {
        id: 1,
        game: "poe1",
        scope: "all-time",
        card_name: "The Doctor",
        count: 5,
        total_count: 12,
        exported_at: "2025-06-01T10:00:00.000Z",
        integrity_status: "pass",
        integrity_details: '{"allTimeVsGlobal":"ok"}',
        created_at: "2025-06-01T09:00:00.000Z",
        updated_at: "2025-06-01T10:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto).toEqual({
        game: "poe1",
        scope: "all-time",
        cardName: "The Doctor",
        count: 5,
        totalCount: 12,
        exportedAt: "2025-06-01T10:00:00.000Z",
        integrityStatus: CsvIntegrityStatus.Pass,
        integrityDetails: '{"allTimeVsGlobal":"ok"}',
      });
    });

    it("should convert snake_case card_name to camelCase cardName", () => {
      const row: CsvExportSnapshotsRow = {
        id: 2,
        game: "poe2",
        scope: "Settlers",
        card_name: "Rain of Chaos",
        count: 7,
        total_count: 7,
        exported_at: "2025-06-02T12:00:00.000Z",
        integrity_status: null,
        integrity_details: null,
        created_at: "2025-06-02T12:00:00.000Z",
        updated_at: "2025-06-02T12:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto.cardName).toBe("Rain of Chaos");
    });

    it("should map null integrity_status to null", () => {
      const row: CsvExportSnapshotsRow = {
        id: 3,
        game: "poe1",
        scope: "all-time",
        card_name: "The Nurse",
        count: 2,
        total_count: 2,
        exported_at: "2025-06-01T10:00:00.000Z",
        integrity_status: null,
        integrity_details: null,
        created_at: "2025-06-01T10:00:00.000Z",
        updated_at: "2025-06-01T10:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto.integrityStatus).toBeNull();
      expect(dto.integrityDetails).toBeNull();
    });

    it("should correctly cast integrity_status 'warn' from string", () => {
      const row: CsvExportSnapshotsRow = {
        id: 4,
        game: "poe1",
        scope: "all-time",
        card_name: "House of Mirrors",
        count: 1,
        total_count: 1,
        exported_at: "2025-06-01T10:00:00.000Z",
        integrity_status: "warn",
        integrity_details: '{"processedIdsMismatch":true}',
        created_at: "2025-06-01T10:00:00.000Z",
        updated_at: "2025-06-01T10:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto.integrityStatus).toBe(CsvIntegrityStatus.Warn);
    });

    it("should correctly cast integrity_status 'fail' from string", () => {
      const row: CsvExportSnapshotsRow = {
        id: 5,
        game: "poe1",
        scope: "all-time",
        card_name: "The Fiend",
        count: 1,
        total_count: 1,
        exported_at: "2025-06-01T10:00:00.000Z",
        integrity_status: "fail",
        integrity_details: '{"tamperingDetected":true}',
        created_at: "2025-06-01T10:00:00.000Z",
        updated_at: "2025-06-01T10:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto.integrityStatus).toBe(CsvIntegrityStatus.Fail);
    });

    it("should map total_count to totalCount", () => {
      const row: CsvExportSnapshotsRow = {
        id: 6,
        game: "poe1",
        scope: "Settlers",
        card_name: "The Doctor",
        count: 3,
        total_count: 42,
        exported_at: "2025-06-01T10:00:00.000Z",
        integrity_status: null,
        integrity_details: null,
        created_at: "2025-06-01T10:00:00.000Z",
        updated_at: "2025-06-01T10:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto.totalCount).toBe(42);
    });

    it("should map exported_at to exportedAt", () => {
      const row: CsvExportSnapshotsRow = {
        id: 7,
        game: "poe2",
        scope: "all-time",
        card_name: "The Doctor",
        count: 1,
        total_count: 1,
        exported_at: "2025-12-25T00:00:00.000Z",
        integrity_status: null,
        integrity_details: null,
        created_at: "2025-12-25T00:00:00.000Z",
        updated_at: "2025-12-25T00:00:00.000Z",
      };

      const dto = CsvMapper.toSnapshotDTO(row);

      expect(dto.exportedAt).toBe("2025-12-25T00:00:00.000Z");
    });
  });

  // ─── toSnapshotMetaDTO ──────────────────────────────────────────────────

  describe("toSnapshotMetaDTO", () => {
    it("should return exists: false for an empty array", () => {
      const meta = CsvMapper.toSnapshotMetaDTO([]);

      expect(meta).toEqual({
        exists: false,
        exportedAt: null,
        snapshotTotal: 0,
        cardCount: 0,
      });
    });

    it("should aggregate a single row correctly", () => {
      const rows: CsvExportSnapshotsRow[] = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 5,
          total_count: 5,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
      ];

      const meta = CsvMapper.toSnapshotMetaDTO(rows);

      expect(meta).toEqual({
        exists: true,
        exportedAt: "2025-06-01T10:00:00.000Z",
        snapshotTotal: 5,
        cardCount: 1,
      });
    });

    it("should sum counts across multiple rows", () => {
      const rows: CsvExportSnapshotsRow[] = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 5,
          total_count: 12,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          game: "poe1",
          scope: "all-time",
          card_name: "Rain of Chaos",
          count: 7,
          total_count: 12,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
      ];

      const meta = CsvMapper.toSnapshotMetaDTO(rows);

      expect(meta).toEqual({
        exists: true,
        exportedAt: "2025-06-01T10:00:00.000Z",
        snapshotTotal: 12, // 5 + 7
        cardCount: 2,
      });
    });

    it("should use the exported_at of the first row", () => {
      const rows: CsvExportSnapshotsRow[] = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 5,
          total_count: 8,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
        {
          id: 2,
          game: "poe1",
          scope: "all-time",
          card_name: "Rain of Chaos",
          count: 3,
          total_count: 8,
          exported_at: "2025-06-02T14:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-02T14:00:00.000Z",
          updated_at: "2025-06-02T14:00:00.000Z",
        },
      ];

      const meta = CsvMapper.toSnapshotMetaDTO(rows);

      // Uses first row's exported_at
      expect(meta.exportedAt).toBe("2025-06-01T10:00:00.000Z");
    });

    it("should handle many rows with varying counts", () => {
      const rows: CsvExportSnapshotsRow[] = [];
      let total = 0;
      for (let i = 0; i < 50; i++) {
        const count = i + 1;
        total += count;
        rows.push({
          id: i + 1,
          game: "poe1",
          scope: "all-time",
          card_name: `Card ${i}`,
          count,
          total_count: 0, // doesn't affect the aggregation
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        });
      }

      const meta = CsvMapper.toSnapshotMetaDTO(rows);

      expect(meta.exists).toBe(true);
      expect(meta.snapshotTotal).toBe(total); // 1+2+...+50 = 1275
      expect(meta.cardCount).toBe(50);
    });

    it("should handle rows with zero counts", () => {
      const rows: CsvExportSnapshotsRow[] = [
        {
          id: 1,
          game: "poe1",
          scope: "all-time",
          card_name: "The Doctor",
          count: 0,
          total_count: 0,
          exported_at: "2025-06-01T10:00:00.000Z",
          integrity_status: null,
          integrity_details: null,
          created_at: "2025-06-01T10:00:00.000Z",
          updated_at: "2025-06-01T10:00:00.000Z",
        },
      ];

      const meta = CsvMapper.toSnapshotMetaDTO(rows);

      expect(meta).toEqual({
        exists: true,
        exportedAt: "2025-06-01T10:00:00.000Z",
        snapshotTotal: 0,
        cardCount: 1,
      });
    });
  });
});
