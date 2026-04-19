import { describe, expect, it } from "vitest";

import { migration_20260221_201500_add_prohibited_library } from "../../migrations/20260221_201500_add_prohibited_library";
import {
  createBaselineSchema,
  getColumnNames,
  setupMigrationDb,
} from "../migrations-shared";

describe("prohibited library migration idempotency", () => {
  const { getDb } = setupMigrationDb();

  it("should skip adding from_boss when column already exists on divination_cards", () => {
    const db = getDb();
    createBaselineSchema(db);

    migration_20260221_201500_add_prohibited_library.up(db);

    const before = getColumnNames(db, "divination_cards");
    expect(before).toContain("from_boss");

    expect(() =>
      migration_20260221_201500_add_prohibited_library.up(db),
    ).not.toThrow();

    const after = getColumnNames(db, "divination_cards");
    const count = after.filter((c) => c === "from_boss").length;
    expect(count).toBe(1);
  });

  it("should handle down() when from_boss column does not exist on divination_cards", () => {
    const db = getDb();
    createBaselineSchema(db);

    const before = getColumnNames(db, "divination_cards");
    expect(before).not.toContain("from_boss");

    expect(() =>
      migration_20260221_201500_add_prohibited_library.down(db),
    ).not.toThrow();

    const after = getColumnNames(db, "divination_cards");
    expect(after).not.toContain("from_boss");
    expect(after).toContain("name");
    expect(after).toContain("game");
  });

  it("should handle down() and preserve divination_cards data when from_boss is removed", () => {
    const db = getDb();
    createBaselineSchema(db);

    migration_20260221_201500_add_prohibited_library.up(db);

    db.prepare(
      "INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, game, data_hash, from_boss) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "card-1",
      "The Doctor",
      8,
      "desc",
      "<span>reward</span>",
      "art.png",
      "poe1",
      "hash1",
      1,
    );

    db.prepare(
      "INSERT INTO divination_cards (id, name, stack_size, description, reward_html, art_src, game, data_hash, from_boss) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)",
    ).run(
      "card-2",
      "Rain of Chaos",
      8,
      "desc",
      "<span>reward</span>",
      "art2.png",
      "poe1",
      "hash2",
      0,
    );

    migration_20260221_201500_add_prohibited_library.down(db);

    const rows = db
      .prepare(
        "SELECT name, stack_size, game FROM divination_cards ORDER BY name",
      )
      .all() as Array<{
      name: string;
      stack_size: number;
      game: string;
    }>;

    expect(rows).toHaveLength(2);
    expect(rows[0].name).toBe("Rain of Chaos");
    expect(rows[1].name).toBe("The Doctor");

    const columns = getColumnNames(db, "divination_cards");
    expect(columns).not.toContain("from_boss");
  });
});
