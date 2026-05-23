import { describe, expect, it } from "vitest";

import { migration_20260626_120000_add_filter_tier_styles } from "../../migrations/20260626_120000_add_filter_tier_styles";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("filter tier styles migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should handle repeated up() calls", () => {
    const db = getDb();
    createBaselineSchema(db);

    expect(() =>
      migration_20260626_120000_add_filter_tier_styles.up(db),
    ).not.toThrow();
    expect(() =>
      migration_20260626_120000_add_filter_tier_styles.up(db),
    ).not.toThrow();

    expect(getColumnNames(db, "filter_tier_styles")).toContain("filter_id");
  });

  it("should handle repeated down() calls", () => {
    const db = getDb();
    createBaselineSchema(db);

    expect(() =>
      migration_20260626_120000_add_filter_tier_styles.down(db),
    ).not.toThrow();
    expect(() =>
      migration_20260626_120000_add_filter_tier_styles.down(db),
    ).not.toThrow();
  });
});
