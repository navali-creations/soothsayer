import { describe, expect, it } from "vitest";

import { migration_20260213_204200_add_filter_tables_and_rarity_source } from "../../migrations/20260213_204200_add_filter_tables_and_rarity_source";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("filter migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle down() when selected_filter_id column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    db.exec(`
        ALTER TABLE user_settings DROP COLUMN selected_filter_id
      `);

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("selected_filter_id");
    expect(columns).toContain("rarity_source");

    expect(() =>
      migration_20260213_204200_add_filter_tables_and_rarity_source.down(db),
    ).not.toThrow();

    const afterColumns = getColumnNames(db, "user_settings");
    expect(afterColumns).not.toContain("selected_filter_id");
    expect(afterColumns).not.toContain("rarity_source");
  });

  it("should handle down() when rarity_source column does not exist", () => {
    const db = getDb();
    createBaselineSchema(db);

    db.exec(`
        ALTER TABLE user_settings DROP COLUMN selected_filter_id
      `);
    db.exec(`
        ALTER TABLE user_settings DROP COLUMN rarity_source
      `);

    const columns = getColumnNames(db, "user_settings");
    expect(columns).not.toContain("rarity_source");
    expect(columns).not.toContain("selected_filter_id");

    expect(() =>
      migration_20260213_204200_add_filter_tables_and_rarity_source.down(db),
    ).not.toThrow();
  });
});
