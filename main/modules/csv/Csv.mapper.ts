import type { CsvExportSnapshotsRow } from "~/main/modules/database";

import type {
  CsvExportSnapshotDTO,
  CsvIntegrityStatus,
  SnapshotMetaDTO,
} from "./Csv.dto";

/**
 * Mappers convert between database rows and DTOs
 */
export class CsvMapper {
  static toSnapshotDTO(row: CsvExportSnapshotsRow): CsvExportSnapshotDTO {
    return {
      game: row.game,
      scope: row.scope,
      cardName: row.card_name,
      count: row.count,
      totalCount: row.total_count,
      exportedAt: row.exported_at,
      integrityStatus: row.integrity_status as CsvIntegrityStatus | null,
      integrityDetails: row.integrity_details,
    };
  }

  /**
   * Aggregate snapshot rows into a single SnapshotMetaDTO summary.
   * All rows are expected to share the same (game, scope, exported_at).
   */
  static toSnapshotMetaDTO(rows: CsvExportSnapshotsRow[]): SnapshotMetaDTO {
    if (rows.length === 0) {
      return {
        exists: false,
        exportedAt: null,
        snapshotTotal: 0,
        cardCount: 0,
      };
    }

    const first = rows[0];
    const snapshotTotal = rows.reduce((sum, r) => sum + r.count, 0);

    return {
      exists: true,
      exportedAt: first.exported_at,
      snapshotTotal,
      cardCount: rows.length,
    };
  }
}
