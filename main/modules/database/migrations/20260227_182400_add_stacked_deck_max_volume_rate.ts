import type Database from "better-sqlite3";

import type { Migration } from "./Migration.interface";

/**
 * Migration: add stacked_deck_max_volume_rate to snapshots
 *
 * Adds column for:
 * - stacked_deck_max_volume_rate: The bulk exchange rate (decks per divine)
 *   observed by poe.ninja at snapshot time. This is the `maxVolumeRate` field
 *   from the poe.ninja Currency API for the "stacked-deck" line item.
 *
 *   When available, this is a better base rate for the sliding exchange model
 *   than the derived `floor(chaosToDivine / stackedDeckChaosCost)` because it
 *   reflects the actual volume-weighted rate traders are getting on the exchange.
 *
 *   NULL means the field was not available at snapshot creation time (e.g. older
 *   snapshots created before this migration). The renderer falls back to the
 *   derived rate when this is NULL.
 */
export const migration_20260227_182400_add_stacked_deck_max_volume_rate: Migration =
  {
    id: "20260227_182400_add_stacked_deck_max_volume_rate",
    description: "add stacked_deck_max_volume_rate to snapshots",

    up(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(snapshots)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (!existing.has("stacked_deck_max_volume_rate")) {
        db.exec(`
          ALTER TABLE snapshots ADD COLUMN stacked_deck_max_volume_rate REAL DEFAULT NULL
        `);
      }

      console.log(
        "[Migration] ✓ Applied: 20260227_182400_add_stacked_deck_max_volume_rate",
      );
    },

    down(db: Database.Database): void {
      const columns = db.prepare("PRAGMA table_info(snapshots)").all() as {
        name: string;
      }[];
      const existing = new Set(columns.map((c) => c.name));

      if (existing.has("stacked_deck_max_volume_rate")) {
        db.exec(
          `ALTER TABLE snapshots DROP COLUMN stacked_deck_max_volume_rate`,
        );
      }

      console.log(
        "[Migration] ✓ Rolled back: 20260227_182400_add_stacked_deck_max_volume_rate",
      );
    },
  };
