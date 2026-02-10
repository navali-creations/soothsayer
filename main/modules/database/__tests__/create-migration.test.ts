import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ──────────────────────────────────────────────────────────
const {
  mockWriteFileSync,
  mockExistsSync,
  mockDirname,
  mockJoin,
  mockFileURLToPath,
} = vi.hoisted(() => ({
  mockWriteFileSync: vi.fn(),
  mockExistsSync: vi.fn(() => false),
  mockDirname: vi.fn(() => "/mock/migrations"),
  mockJoin: vi.fn((...parts: string[]) => parts.join("/")),
  mockFileURLToPath: vi.fn(() => "/mock/migrations/create-migration.ts"),
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
  writeFileSync: mockWriteFileSync,
}));

vi.mock("node:path", () => ({
  dirname: mockDirname,
  join: mockJoin,
}));

vi.mock("node:url", () => ({
  fileURLToPath: mockFileURLToPath,
}));

// ─── Import the real function under test ─────────────────────────────────────
import { createMigration, main } from "../migrations/create-migration";

// ─── Assertion helpers ───────────────────────────────────────────────────────

/**
 * Generates the expected timestamp string from a Date, mirroring the source logic.
 */
function expectedTimestamp(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${year}${month}${day}_${hours}${minutes}${seconds}`;
}

/**
 * Sanitizes a description the same way the source does.
 */
function expectedSanitize(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("create-migration", () => {
  const FIXED_DATE = new Date(2025, 0, 15, 14, 30, 22); // 2025-01-15 14:30:22
  const FIXED_TIMESTAMP = "20250115_143022";

  let mockExit: ReturnType<typeof vi.spyOn>;
  let consoleSpy: {
    log: ReturnType<typeof vi.spyOn>;
    error: ReturnType<typeof vi.spyOn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockExistsSync.mockReturnValue(false);

    // Mock process.exit to throw so we can catch early exits
    mockExit = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as unknown as (code?: number) => never);

    // Spy on console output
    consoleSpy = {
      log: vi.spyOn(console, "log").mockImplementation(() => {}),
      error: vi.spyOn(console, "error").mockImplementation(() => {}),
    };

    // Mock Date to return a fixed timestamp
    vi.useFakeTimers();
    vi.setSystemTime(FIXED_DATE);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  /**
   * Calls createMigration and catches process.exit throws.
   * Returns true if it completed normally, false if process.exit was called.
   */
  function run(description: string): boolean {
    try {
      createMigration(description);
      return true;
    } catch {
      return false;
    }
  }

  // ─── Successful creation ──────────────────────────────────────────────────

  describe("successful creation", () => {
    it("should write a migration file with the correct filename", () => {
      run("add_user_preferences");

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toBe(
        `/mock/migrations/${FIXED_TIMESTAMP}_add_user_preferences.ts`,
      );
    });

    it("should write the file with utf-8 encoding", () => {
      run("add_table");

      const [, , encoding] = mockWriteFileSync.mock.calls[0];
      expect(encoding).toBe("utf-8");
    });

    it("should check if the file already exists before writing", () => {
      run("add_table");

      expect(mockExistsSync).toHaveBeenCalledBefore(mockWriteFileSync);
      expect(mockExistsSync).toHaveBeenCalledWith(
        `/mock/migrations/${FIXED_TIMESTAMP}_add_table.ts`,
      );
    });

    it("should use join(__dirname, filename) for the filepath", () => {
      run("my_migration");

      expect(mockJoin).toHaveBeenCalledWith(
        "/mock/migrations",
        `${FIXED_TIMESTAMP}_my_migration.ts`,
      );
    });

    it("should log success message after writing", () => {
      run("add_column");

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining("Migration created successfully"),
      );
    });

    it("should log the filename", () => {
      run("add_column");

      expect(consoleSpy.log).toHaveBeenCalledWith(
        expect.stringContaining(`${FIXED_TIMESTAMP}_add_column.ts`),
      );
    });

    it("should log next steps instructions", () => {
      run("add_column");

      const allLogs = consoleSpy.log.mock.calls
        .map((c: any[]) => c[0])
        .join("\n");
      expect(allLogs).toContain("Next steps");
      expect(allLogs).toContain("up()");
      expect(allLogs).toContain("down()");
      expect(allLogs).toContain("index.ts");
    });

    it("should log the variable name for import in next steps", () => {
      run("add_table");

      const allLogs = consoleSpy.log.mock.calls
        .map((c: any[]) => c[0])
        .join("\n");
      expect(allLogs).toContain(`migration_${FIXED_TIMESTAMP}_add_table`);
    });

    it("should log tips section", () => {
      run("add_table");

      const allLogs = consoleSpy.log.mock.calls
        .map((c: any[]) => c[0])
        .join("\n");
      expect(allLogs).toContain("Tips");
      expect(allLogs).toContain("transaction");
      expect(allLogs).toContain("rollback");
    });

    it("should not call process.exit on success", () => {
      run("add_table");

      expect(mockExit).not.toHaveBeenCalled();
    });
  });

  // ─── Template content ────────────────────────────────────────────────────

  describe("template content", () => {
    function getWrittenTemplate(): string {
      return mockWriteFileSync.mock.calls[0][1] as string;
    }

    it("should include the better-sqlite3 import", () => {
      run("add_table");
      expect(getWrittenTemplate()).toContain(
        'import type Database from "better-sqlite3"',
      );
    });

    it("should include the Migration interface import", () => {
      run("add_table");
      expect(getWrittenTemplate()).toContain(
        'import type { Migration } from "./Migration.interface"',
      );
    });

    it("should export a const with the correct variable name", () => {
      run("add_table");
      expect(getWrittenTemplate()).toContain(
        `export const migration_${FIXED_TIMESTAMP}_add_table: Migration`,
      );
    });

    it("should include the correct migration ID", () => {
      run("add_table");
      expect(getWrittenTemplate()).toContain(
        `id: "${FIXED_TIMESTAMP}_add_table"`,
      );
    });

    it("should include a human-readable description (underscores to spaces)", () => {
      run("add_user_preferences");
      expect(getWrittenTemplate()).toContain(
        'description: "add user preferences"',
      );
    });

    it("should include up() and down() methods", () => {
      run("add_table");
      const template = getWrittenTemplate();
      expect(template).toContain("up(db: Database.Database): void");
      expect(template).toContain("down(db: Database.Database): void");
    });

    it("should include console.log statements for applied and rolled back", () => {
      run("add_table");
      const template = getWrittenTemplate();
      expect(template).toContain(
        `[Migration] ✓ Applied: ${FIXED_TIMESTAMP}_add_table`,
      );
      expect(template).toContain(
        `[Migration] ✓ Rolled back: ${FIXED_TIMESTAMP}_add_table`,
      );
    });

    it("should include example SQL comments", () => {
      run("add_table");
      const template = getWrittenTemplate();
      expect(template).toContain("CREATE TABLE");
      expect(template).toContain("ALTER TABLE");
      expect(template).toContain("CREATE INDEX");
      expect(template).toContain("DROP TABLE");
      expect(template).toContain("DROP INDEX");
    });

    it("should include the migration description in the JSDoc comment", () => {
      run("add_user_avatar");
      expect(getWrittenTemplate()).toContain("Migration: add user avatar");
    });

    it("should produce a template that looks like valid TypeScript", () => {
      run("add_table");
      const template = getWrittenTemplate();
      // Check structural elements
      expect(template).toContain("import type");
      expect(template).toContain("export const");
      expect(template).toContain(": Migration = {");
      expect(template).toContain("};");
    });
  });

  // ─── Timestamp generation ────────────────────────────────────────────────

  describe("timestamp generation", () => {
    it("should format the date as YYYYMMDD_HHMMSS", () => {
      run("test");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(FIXED_TIMESTAMP);
    });

    it("should zero-pad single-digit months and days", () => {
      vi.setSystemTime(new Date(2025, 0, 5, 3, 7, 9)); // Jan 5, 03:07:09
      run("test");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("20250105_030709");
    });

    it("should handle midnight (00:00:00)", () => {
      vi.setSystemTime(new Date(2025, 5, 15, 0, 0, 0));
      run("test");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("20250615_000000");
    });

    it("should handle end of day (23:59:59)", () => {
      vi.setSystemTime(new Date(2025, 11, 31, 23, 59, 59));
      run("test");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("20251231_235959");
    });

    it("should use different timestamps for different dates", () => {
      vi.setSystemTime(new Date(2024, 5, 1, 12, 0, 0));
      run("first");
      const [filepath1] = mockWriteFileSync.mock.calls[0];

      vi.setSystemTime(new Date(2025, 5, 1, 12, 0, 0));
      mockWriteFileSync.mockClear();
      run("second");
      const [filepath2] = mockWriteFileSync.mock.calls[0];

      expect(filepath1).not.toBe(filepath2);
    });
  });

  // ─── Description sanitization ────────────────────────────────────────────

  describe("description sanitization", () => {
    it("should lowercase the description", () => {
      run("ADD_TABLE");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("add_table");
      expect(filepath).not.toContain("ADD_TABLE");
    });

    it("should replace non-alphanumeric characters with underscores", () => {
      run("add user table!");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("add_user_table");
    });

    it("should replace multiple consecutive non-alphanumeric chars with single underscore", () => {
      run("add---user___table");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("add_user_table");
    });

    it("should strip leading and trailing underscores", () => {
      run("---add_table---");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_table.ts`);
    });

    it("should handle already-clean snake_case input", () => {
      run("add_user_preferences");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_user_preferences.ts`);
    });

    it("should handle mixed case with spaces and special chars", () => {
      run("Add User's Email!!");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("add_user_s_email");
    });
  });

  // ─── Error handling ──────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should exit with code 1 when description is empty", () => {
      run("");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("should log usage instructions when description is empty", () => {
      run("");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Migration description is required"),
      );
      const allLogs = consoleSpy.log.mock.calls
        .map((c: any[]) => c[0])
        .join("\n");
      expect(allLogs).toContain("Usage:");
      expect(allLogs).toContain("Examples:");
    });

    it("should exit with code 1 when description has no alphanumeric characters", () => {
      run("---!!!---");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("should log error about alphanumeric requirement when sanitized is empty", () => {
      run("@#$%^&*");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("at least one alphanumeric character"),
      );
    });

    it("should exit with code 1 when file already exists", () => {
      mockExistsSync.mockReturnValue(true);
      run("add_user_preferences");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("should log error with filename when file already exists", () => {
      mockExistsSync.mockReturnValue(true);
      run("add_table");
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Migration file already exists"),
      );
    });

    it("should not write file when description is empty", () => {
      run("");
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("should not write file when description sanitizes to empty", () => {
      run("@#$%^&*");
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("should not write file when file already exists", () => {
      mockExistsSync.mockReturnValue(true);
      run("existing_migration");
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });

    it("should exit with code 1 when writeFileSync throws", () => {
      mockWriteFileSync.mockImplementationOnce(() => {
        throw new Error("Disk full");
      });

      run("add_table");

      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("Error writing migration file"),
        expect.any(Error),
      );
    });
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle a single character description", () => {
      run("x");
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_x.ts`);
    });

    it("should handle a very long description", () => {
      const longDesc = "a".repeat(200);
      run(longDesc);
      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_${longDesc}.ts`);
    });

    it("should handle description with only numbers", () => {
      run("123");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_123.ts`);
    });

    it("should handle description with leading special chars", () => {
      run("---add_table");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_table.ts`);
    });

    it("should handle description with trailing special chars", () => {
      run("add_table---");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_table.ts`);
    });

    it("should handle uppercase description", () => {
      run("ADD_TABLE");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_table.ts`);
    });

    it("should handle mixed case with spaces", () => {
      run("Add User Table");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_user_table.ts`);
    });

    it("should handle description with consecutive underscores becoming single", () => {
      run("add___table");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_table.ts`);
    });

    it("should handle description with unicode characters (stripped)", () => {
      run("add_émojis_🎉");
      const [filepath] = mockWriteFileSync.mock.calls[0];
      // Unicode chars are non-alphanumeric, replaced by underscores, then trimmed
      expect(filepath).toContain(`${FIXED_TIMESTAMP}_add_mojis.ts`);
    });

    it("should use the correct base directory from join", () => {
      run("test");
      expect(mockJoin).toHaveBeenCalledWith(
        "/mock/migrations",
        `${FIXED_TIMESTAMP}_test.ts`,
      );
    });
  });

  // ─── Human-readable description in template ──────────────────────────────

  describe("human-readable description in template", () => {
    function getWrittenTemplate(): string {
      return mockWriteFileSync.mock.calls[0][1] as string;
    }

    it("should convert underscores to spaces", () => {
      run("add_user_preferences");
      expect(getWrittenTemplate()).toContain(
        'description: "add user preferences"',
      );
    });

    it("should handle single word (no underscores)", () => {
      run("migration");
      expect(getWrittenTemplate()).toContain('description: "migration"');
    });

    it("should handle multi-word description from spaces", () => {
      run("create new index");
      // "create new index" → sanitized: "create_new_index" → human: "create new index"
      expect(getWrittenTemplate()).toContain('description: "create new index"');
    });
  });

  // ─── Full pipeline ────────────────────────────────────────────────────────

  describe("full pipeline", () => {
    function getWrittenTemplate(): string {
      return mockWriteFileSync.mock.calls[0][1] as string;
    }

    it("should produce a complete, coherent migration file", () => {
      vi.setSystemTime(new Date(2024, 11, 25, 8, 0, 0)); // Dec 25, 2024 08:00:00
      run("add_christmas_table");

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);

      const [filepath, template] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("20241225_080000_add_christmas_table.ts");

      // Verify all key parts are present and consistent
      expect(template).toContain('import type Database from "better-sqlite3"');
      expect(template).toContain(
        'import type { Migration } from "./Migration.interface"',
      );
      expect(template).toContain("Migration: add christmas table");
      expect(template).toContain(
        "export const migration_20241225_080000_add_christmas_table: Migration",
      );
      expect(template).toContain('id: "20241225_080000_add_christmas_table"');
      expect(template).toContain('description: "add christmas table"');
      expect(template).toContain("up(db: Database.Database): void");
      expect(template).toContain("down(db: Database.Database): void");
    });

    it("should produce different templates for different descriptions", () => {
      run("add_table");
      const template1 = getWrittenTemplate();

      mockWriteFileSync.mockClear();
      run("drop_column");
      const template2 = getWrittenTemplate();

      expect(template1).not.toBe(template2);
      expect(template1).toContain("add_table");
      expect(template2).toContain("drop_column");
    });

    it("should produce different files for same description with different timestamps", () => {
      vi.setSystemTime(new Date(2025, 0, 1, 0, 0, 0));
      run("add_table");
      const [filepath1] = mockWriteFileSync.mock.calls[0];

      vi.setSystemTime(new Date(2025, 0, 1, 0, 0, 1)); // 1 second later
      mockWriteFileSync.mockClear();
      run("add_table");
      const [filepath2] = mockWriteFileSync.mock.calls[0];

      expect(filepath1).toContain("20250101_000000_add_table");
      expect(filepath2).toContain("20250101_000001_add_table");
    });
  });

  // ─── Assertion helper verification ────────────────────────────────────────

  describe("assertion helpers match source logic", () => {
    it("expectedTimestamp should produce the same timestamp as the source", () => {
      const date = new Date(2025, 0, 15, 14, 30, 22);
      expect(expectedTimestamp(date)).toBe("20250115_143022");
    });

    it("expectedTimestamp should zero-pad correctly", () => {
      const date = new Date(2025, 0, 5, 3, 7, 9);
      expect(expectedTimestamp(date)).toBe("20250105_030709");
    });

    it("expectedSanitize should lowercase", () => {
      expect(expectedSanitize("HELLO")).toBe("hello");
    });

    it("expectedSanitize should replace special chars", () => {
      expect(expectedSanitize("hello world!")).toBe("hello_world");
    });

    it("expectedSanitize should strip leading/trailing underscores", () => {
      expect(expectedSanitize("---hello---")).toBe("hello");
    });

    it("expectedSanitize should return empty for purely non-alphanumeric", () => {
      expect(expectedSanitize("---!!!---")).toBe("");
    });

    it("expectedSanitize should collapse multiple separators", () => {
      expect(expectedSanitize("a---b___c")).toBe("a_b_c");
    });
  });

  // ─── main() CLI entry point ───────────────────────────────────────────────

  describe("main() CLI entry point", () => {
    let originalArgv: string[];

    beforeEach(() => {
      originalArgv = process.argv;
    });

    afterEach(() => {
      process.argv = originalArgv;
    });

    it("should exit with code 1 when no description is provided in argv", () => {
      process.argv = ["node", "create-migration.ts"];

      expect(() => main()).toThrow("process.exit called");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(consoleSpy.error).toHaveBeenCalledWith(
        expect.stringContaining("No description provided"),
      );
    });

    it("should log usage instructions when no description is provided", () => {
      process.argv = ["node", "create-migration.ts"];

      expect(() => main()).toThrow("process.exit called");

      const allLogs = consoleSpy.log.mock.calls
        .map((c: any[]) => c[0])
        .join("\n");
      expect(allLogs).toContain("Usage:");
      expect(allLogs).toContain("pnpm migration:create");
      expect(allLogs).toContain("Example:");
    });

    it("should call createMigration with the description from argv", () => {
      process.argv = ["node", "create-migration.ts", "add_users_table"];

      main();

      expect(mockWriteFileSync).toHaveBeenCalledTimes(1);
      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("add_users_table.ts");
    });

    it("should use the first argument after the script as the description", () => {
      process.argv = [
        "node",
        "create-migration.ts",
        "first_arg",
        "ignored_arg",
      ];

      main();

      const [filepath] = mockWriteFileSync.mock.calls[0];
      expect(filepath).toContain("first_arg");
      expect(filepath).not.toContain("ignored_arg");
    });

    it("should exit with code 1 when argv has only the node and script entries", () => {
      process.argv = ["node", "script.ts"];

      expect(() => main()).toThrow("process.exit called");
      expect(mockExit).toHaveBeenCalledWith(1);
      expect(mockWriteFileSync).not.toHaveBeenCalled();
    });
  });
});
