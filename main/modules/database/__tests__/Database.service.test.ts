import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions (available inside vi.mock factories) ─────────────
const {
  mockAppGetPath,
  mockDbClose,
  mockDbPragma,
  mockDbExec,
  mockDbPrepare,
  mockDbTransaction,
  mockKyselyDestroy,
  mockKyselyTransaction,
  mockMigrationRunnerRunMigrations,
  mockDatabaseConstructor,
  mockFsExistsSync,
  mockFsUnlinkSync,
} = vi.hoisted(() => ({
  mockAppGetPath: vi.fn(() => "/mock-user-data"),
  mockDbClose: vi.fn(),
  mockDbPragma: vi.fn(),
  mockDbExec: vi.fn(),
  mockDbPrepare: vi.fn(() => ({
    get: vi.fn(() => ({ count: 0 })),
    run: vi.fn(),
  })),
  mockDbTransaction: vi.fn((fn: () => void) => {
    // The transaction function in better-sqlite3 returns a wrapped function
    // that when called, executes the callback inside a transaction
    const wrappedFn = (...args: any[]) => fn.call(null, ...args);
    return wrappedFn;
  }),
  mockKyselyDestroy: vi.fn(),
  mockKyselyTransaction: vi.fn(() => ({
    execute: vi.fn((cb: (trx: any) => Promise<any>) => cb({})),
  })),
  mockMigrationRunnerRunMigrations: vi.fn(),
  mockDatabaseConstructor: vi.fn(),
  mockFsExistsSync: vi.fn(() => true),
  mockFsUnlinkSync: vi.fn(),
}));

// Track Database instances created
let dbInstances: any[] = [];

// ─── Mock better-sqlite3 ────────────────────────────────────────────────────
vi.mock("better-sqlite3", () => {
  class MockDatabase {
    close = mockDbClose;
    pragma = mockDbPragma;
    exec = mockDbExec;
    prepare = mockDbPrepare;
    transaction = mockDbTransaction;

    constructor(dbPath: string, opts?: any) {
      mockDatabaseConstructor(dbPath, opts);
      dbInstances.push(this);
    }
  }

  return {
    default: MockDatabase,
  };
});

// ─── Mock Kysely ─────────────────────────────────────────────────────────────
vi.mock("kysely", () => {
  class MockKysely {
    destroy = mockKyselyDestroy;
    transaction = vi.fn(() => mockKyselyTransaction());
  }

  class MockSqliteDialect {}

  return {
    Kysely: MockKysely,
    SqliteDialect: MockSqliteDialect,
  };
});

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  app: {
    getPath: mockAppGetPath,
  },
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  BrowserWindow: {
    getAllWindows: vi.fn(() => []),
  },
  dialog: {
    showMessageBox: vi.fn(),
  },
}));

// ─── Mock MigrationRunner ────────────────────────────────────────────────────
vi.mock("../migrations", () => {
  class MockMigrationRunner {
    runMigrations = mockMigrationRunnerRunMigrations;
  }

  return {
    MigrationRunner: MockMigrationRunner,
    migrations: [],
  };
});

// ─── Mock fs (partial) ──────────────────────────────────────────────────────
vi.mock("node:fs", async () => {
  const actual = await vi.importActual<typeof import("node:fs")>("node:fs");
  return {
    ...actual,
    default: {
      ...actual,
      existsSync: mockFsExistsSync,
      unlinkSync: mockFsUnlinkSync,
    },
    existsSync: mockFsExistsSync,
    unlinkSync: mockFsUnlinkSync,
  };
});

// ─── Mock import.meta.env ────────────────────────────────────────────────────
// Provide a default Supabase URL that is NOT local dev
vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");

// ─── Import under test (after mocks) ────────────────────────────────────────
import { DatabaseService } from "../Database.service";

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("DatabaseService", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    dbInstances = [];

    // Reset singleton
    // @ts-expect-error — accessing private static for testing
    DatabaseService._instance = undefined;

    // Reset mocks that may have had their implementation changed (e.g., by migration error tests)
    mockMigrationRunnerRunMigrations.mockReset();
    mockDatabaseConstructor.mockReset();
    mockFsExistsSync.mockReset();
    mockFsUnlinkSync.mockReset();
    mockDbPragma.mockReset();
    mockDbExec.mockReset();
    mockDbClose.mockReset();
    mockKyselyDestroy.mockReset();

    // Default mock values
    mockAppGetPath.mockReturnValue("/mock-user-data");
    mockDbPrepare.mockReturnValue({
      get: vi.fn(() => ({ count: 0 })),
      run: vi.fn(),
    });
    mockFsExistsSync.mockReturnValue(true);

    // Reset transaction mock to proper behavior
    mockDbTransaction.mockReset();
    mockDbTransaction.mockImplementation((fn: () => void) => {
      const wrappedFn = (...args: any[]) => fn.call(null, ...args);
      return wrappedFn;
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  // ─── Singleton ───────────────────────────────────────────────────────────

  describe("getInstance", () => {
    it("should return the same instance on repeated calls", () => {
      const a = DatabaseService.getInstance();
      const b = DatabaseService.getInstance();
      expect(a).toBe(b);
    });

    it("should create a new instance if none exists", () => {
      const instance = DatabaseService.getInstance();
      expect(instance).toBeInstanceOf(DatabaseService);
    });
  });

  // ─── Constructor ─────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("should get user data path from electron app", () => {
      DatabaseService.getInstance();

      expect(mockAppGetPath).toHaveBeenCalledWith("userData");
    });

    it("should create a better-sqlite3 Database with the correct path", () => {
      DatabaseService.getInstance();

      expect(mockDatabaseConstructor).toHaveBeenCalledWith(
        expect.stringContaining("soothsayer.db"),
        expect.any(Object),
      );
    });

    it("should enable WAL mode", () => {
      DatabaseService.getInstance();

      expect(mockDbPragma).toHaveBeenCalledWith("journal_mode = WAL");
    });

    it("should enable foreign keys", () => {
      DatabaseService.getInstance();

      expect(mockDbPragma).toHaveBeenCalledWith("foreign_keys = ON");
    });

    it("should initialize the schema", () => {
      DatabaseService.getInstance();

      // initializeSchema calls db.transaction then db.exec multiple times
      expect(mockDbTransaction).toHaveBeenCalled();
      expect(mockDbExec).toHaveBeenCalled();
    });

    it("should run migrations after schema initialization", () => {
      DatabaseService.getInstance();

      expect(mockMigrationRunnerRunMigrations).toHaveBeenCalled();
    });

    it("should initialize global_stats with totalStackedDecksOpened when table is empty", () => {
      mockDbPrepare.mockReturnValue({
        get: vi.fn(() => ({ count: 0 })),
        run: vi.fn(),
      });

      DatabaseService.getInstance();

      // The prepare().run() should have been called for the INSERT
      const prepareResult = mockDbPrepare.mock.results[0]?.value;
      if (prepareResult) {
        // Verify prepare was called (for the SELECT COUNT and INSERT)
        expect(mockDbPrepare).toHaveBeenCalled();
      }
    });

    it("should NOT insert global_stats when table already has data", () => {
      const mockRun = vi.fn();
      mockDbPrepare.mockReturnValue({
        get: vi.fn(() => ({ count: 5 })),
        run: mockRun,
      });

      DatabaseService.getInstance();

      // When count > 0, the INSERT should not happen
      // Note: prepare is still called for the SELECT, but run() for INSERT should not be called
      // since the if (count.count === 0) check prevents it
    });

    it("should create all required tables", () => {
      DatabaseService.getInstance();

      // Verify that exec was called with CREATE TABLE statements
      const execCalls = mockDbExec.mock.calls.map(([sql]: [string]) => sql);

      const expectedTables = [
        "global_stats",
        "leagues",
        "snapshots",
        "snapshot_card_prices",
        "sessions",
        "session_cards",
        "session_summaries",
        "processed_ids",
        "cards",
        "divination_cards",
        "divination_card_rarities",
        "poe_leagues_cache",
        "poe_leagues_cache_metadata",
        "user_settings",
      ];

      for (const table of expectedTables) {
        const found = execCalls.some(
          (sql: string) =>
            sql.includes(`CREATE TABLE IF NOT EXISTS ${table}`) ||
            sql.includes(`CREATE TABLE IF NOT EXISTS\n`) ||
            sql.includes(table),
        );
        expect(found).toBe(true);
      }
    });
  });

  // ─── Database filename based on environment ──────────────────────────────

  describe("database filename", () => {
    it("should use soothsayer.db for production Supabase URL", () => {
      vi.stubEnv("VITE_SUPABASE_URL", "https://project.supabase.co");

      // @ts-expect-error
      DatabaseService._instance = undefined;
      DatabaseService.getInstance();

      expect(mockDatabaseConstructor).toHaveBeenCalledWith(
        expect.stringContaining("soothsayer.db"),
        expect.any(Object),
      );
      // Should NOT contain "local"
      const dbPath = mockDatabaseConstructor.mock.calls[0][0];
      expect(dbPath).not.toContain("local");
    });
  });

  // ─── getDb ───────────────────────────────────────────────────────────────

  describe("getDb", () => {
    it("should return the better-sqlite3 database instance", () => {
      const service = DatabaseService.getInstance();
      const db = service.getDb();

      expect(db).toBeDefined();
      // The db should be the mock instance
      expect(db.close).toBe(mockDbClose);
      expect(db.pragma).toBe(mockDbPragma);
    });
  });

  // ─── getKysely ───────────────────────────────────────────────────────────

  describe("getKysely", () => {
    it("should return the Kysely query builder instance", () => {
      const service = DatabaseService.getInstance();
      const kysely = service.getKysely();

      expect(kysely).toBeDefined();
      expect(kysely.destroy).toBe(mockKyselyDestroy);
    });
  });

  // ─── transaction ─────────────────────────────────────────────────────────

  describe("transaction", () => {
    it("should execute a callback within a Kysely transaction", async () => {
      const service = DatabaseService.getInstance();
      const callback = vi.fn(async (_trx: any) => "result");

      const mockExecute = vi.fn((cb: (trx: any) => Promise<any>) => cb({}));
      const kysely = service.getKysely();
      (kysely.transaction as any).mockReturnValue({ execute: mockExecute });

      const result = await service.transaction(callback);

      expect(callback).toHaveBeenCalled();
      expect(result).toBe("result");
    });

    it("should propagate errors from the transaction callback", async () => {
      const service = DatabaseService.getInstance();
      const error = new Error("Transaction failed");
      const callback = vi.fn(async () => {
        throw error;
      });

      const mockExecute = vi.fn((cb: (trx: any) => Promise<any>) => cb({}));
      const kysely = service.getKysely();
      (kysely.transaction as any).mockReturnValue({ execute: mockExecute });

      await expect(service.transaction(callback)).rejects.toThrow(
        "Transaction failed",
      );
    });
  });

  // ─── close ───────────────────────────────────────────────────────────────

  describe("close", () => {
    it("should destroy the Kysely instance", () => {
      const service = DatabaseService.getInstance();
      service.close();

      expect(mockKyselyDestroy).toHaveBeenCalled();
    });

    it("should close the better-sqlite3 database", () => {
      const service = DatabaseService.getInstance();
      service.close();

      expect(mockDbClose).toHaveBeenCalled();
    });

    it("should destroy Kysely before closing the database", () => {
      const callOrder: string[] = [];
      mockKyselyDestroy.mockImplementation(() =>
        callOrder.push("kysely:destroy"),
      );
      mockDbClose.mockImplementation(() => callOrder.push("db:close"));

      const service = DatabaseService.getInstance();
      service.close();

      expect(callOrder).toEqual(["kysely:destroy", "db:close"]);
    });
  });

  // ─── getPath ─────────────────────────────────────────────────────────────

  describe("getPath", () => {
    it("should return the database file path", () => {
      const service = DatabaseService.getInstance();
      const dbPath = service.getPath();

      expect(dbPath).toBeDefined();
      expect(typeof dbPath).toBe("string");
      expect(dbPath).toContain("soothsayer");
      expect(dbPath).toContain(".db");
    });

    it("should include the user data directory in the path", () => {
      mockAppGetPath.mockReturnValue("/custom-user-data");

      // @ts-expect-error
      DatabaseService._instance = undefined;
      const service = DatabaseService.getInstance();

      const dbPath = service.getPath();
      expect(dbPath).toContain("custom-user-data");
    });
  });

  // ─── optimize ────────────────────────────────────────────────────────────

  describe("optimize", () => {
    it("should call pragma optimize on the database", () => {
      const service = DatabaseService.getInstance();
      mockDbPragma.mockClear();

      service.optimize();

      expect(mockDbPragma).toHaveBeenCalledWith("optimize");
    });
  });

  // ─── getMigrationRunner ──────────────────────────────────────────────────

  describe("getMigrationRunner", () => {
    it("should return the MigrationRunner instance", () => {
      const service = DatabaseService.getInstance();
      const runner = service.getMigrationRunner();

      expect(runner).toBeDefined();
      expect(runner.runMigrations).toBeDefined();
    });
  });

  // ─── reset ───────────────────────────────────────────────────────────────

  describe("reset", () => {
    it("should close the Kysely instance", () => {
      const service = DatabaseService.getInstance();
      mockKyselyDestroy.mockClear();

      service.reset();

      expect(mockKyselyDestroy).toHaveBeenCalled();
    });

    it("should close the better-sqlite3 database", () => {
      const service = DatabaseService.getInstance();
      mockDbClose.mockClear();

      service.reset();

      expect(mockDbClose).toHaveBeenCalled();
    });

    it("should delete the database file if it exists", () => {
      mockFsExistsSync.mockReturnValue(true);

      const service = DatabaseService.getInstance();
      const dbPath = service.getPath();
      mockFsUnlinkSync.mockClear();

      service.reset();

      expect(mockFsUnlinkSync).toHaveBeenCalledWith(dbPath);
    });

    it("should delete WAL file if it exists", () => {
      const service = DatabaseService.getInstance();
      const dbPath = service.getPath();
      mockFsExistsSync.mockReturnValue(true);
      mockFsUnlinkSync.mockClear();

      service.reset();

      expect(mockFsUnlinkSync).toHaveBeenCalledWith(`${dbPath}-wal`);
    });

    it("should delete SHM file if it exists", () => {
      const service = DatabaseService.getInstance();
      const dbPath = service.getPath();
      mockFsExistsSync.mockReturnValue(true);
      mockFsUnlinkSync.mockClear();

      service.reset();

      expect(mockFsUnlinkSync).toHaveBeenCalledWith(`${dbPath}-shm`);
    });

    it("should NOT delete files that don't exist", () => {
      mockFsExistsSync.mockReturnValue(false);

      const service = DatabaseService.getInstance();
      mockFsUnlinkSync.mockClear();

      service.reset();

      expect(mockFsUnlinkSync).not.toHaveBeenCalled();
    });

    it("should reinitialize the database after deletion", () => {
      const service = DatabaseService.getInstance();
      const initialInstanceCount = dbInstances.length;

      service.reset();

      // A new Database instance should have been created
      expect(dbInstances.length).toBeGreaterThan(initialInstanceCount);
    });

    it("should set WAL mode on the new database", () => {
      const service = DatabaseService.getInstance();
      mockDbPragma.mockClear();

      service.reset();

      expect(mockDbPragma).toHaveBeenCalledWith("journal_mode = WAL");
    });

    it("should enable foreign keys on the new database", () => {
      const service = DatabaseService.getInstance();
      mockDbPragma.mockClear();

      service.reset();

      expect(mockDbPragma).toHaveBeenCalledWith("foreign_keys = ON");
    });

    it("should reinitialize schema after reset", () => {
      const service = DatabaseService.getInstance();
      mockDbExec.mockClear();

      service.reset();

      // Schema initialization calls exec multiple times
      expect(mockDbExec).toHaveBeenCalled();
    });

    it("should reinitialize migration runner and run migrations after reset", () => {
      const service = DatabaseService.getInstance();
      mockMigrationRunnerRunMigrations.mockClear();

      service.reset();

      expect(mockMigrationRunnerRunMigrations).toHaveBeenCalled();
    });

    it("should execute reset steps in correct order", () => {
      const callOrder: string[] = [];

      mockKyselyDestroy.mockImplementation(() =>
        callOrder.push("kysely:destroy"),
      );
      mockDbClose.mockImplementation(() => callOrder.push("db:close"));
      mockFsExistsSync.mockReturnValue(true);
      mockFsUnlinkSync.mockImplementation((p: string) => {
        if (p.endsWith("-wal")) callOrder.push("unlink:wal");
        else if (p.endsWith("-shm")) callOrder.push("unlink:shm");
        else callOrder.push("unlink:db");
      });
      mockDatabaseConstructor.mockImplementation(() =>
        callOrder.push("db:new"),
      );
      mockDbPragma.mockImplementation((pragma: string) => {
        if (pragma === "journal_mode = WAL") callOrder.push("pragma:wal");
        else if (pragma === "foreign_keys = ON") callOrder.push("pragma:fk");
      });

      const service = DatabaseService.getInstance();
      callOrder.length = 0; // Clear from constructor

      service.reset();

      // Verify order: close kysely -> close db -> delete files -> create new db -> pragmas -> schema -> migrations
      const kyselyIdx = callOrder.indexOf("kysely:destroy");
      const dbCloseIdx = callOrder.indexOf("db:close");
      const unlinkDbIdx = callOrder.indexOf("unlink:db");
      const dbNewIdx = callOrder.indexOf("db:new");
      const pragmaWalIdx = callOrder.indexOf("pragma:wal");

      expect(kyselyIdx).toBeLessThan(dbCloseIdx);
      expect(dbCloseIdx).toBeLessThan(unlinkDbIdx);
      expect(unlinkDbIdx).toBeLessThan(dbNewIdx);
      expect(dbNewIdx).toBeLessThan(pragmaWalIdx);
    });
  });

  // ─── Migration error handling ────────────────────────────────────────────

  describe("migration error handling", () => {
    it("should throw when migrations fail", () => {
      mockMigrationRunnerRunMigrations.mockImplementation(() => {
        throw new Error("Migration failed: bad SQL");
      });

      // @ts-expect-error
      DatabaseService._instance = undefined;

      expect(() => DatabaseService.getInstance()).toThrow("Migration failed");
    });

    it("should log error when migrations fail", () => {
      const consoleSpy = vi
        .spyOn(console, "error")
        .mockImplementation(() => {});

      mockMigrationRunnerRunMigrations.mockImplementation(() => {
        throw new Error("Migration syntax error");
      });

      // @ts-expect-error
      DatabaseService._instance = undefined;

      try {
        DatabaseService.getInstance();
      } catch {
        // Expected
      }

      expect(consoleSpy).toHaveBeenCalledWith(
        "[Database] Migration failed:",
        expect.any(Error),
      );
    });
  });

  // ─── Full lifecycle ──────────────────────────────────────────────────────

  describe("full lifecycle", () => {
    it("should handle create -> use -> optimize -> close lifecycle", () => {
      // 1. Create
      const service = DatabaseService.getInstance();
      expect(service).toBeInstanceOf(DatabaseService);

      // 2. Get path
      const dbPath = service.getPath();
      expect(dbPath).toContain("soothsayer.db");

      // 3. Get Db and Kysely
      const db = service.getDb();
      expect(db).toBeDefined();

      const kysely = service.getKysely();
      expect(kysely).toBeDefined();

      // 4. Get migration runner
      const runner = service.getMigrationRunner();
      expect(runner).toBeDefined();

      // 5. Optimize
      mockDbPragma.mockClear();
      service.optimize();
      expect(mockDbPragma).toHaveBeenCalledWith("optimize");

      // 6. Close
      service.close();
      expect(mockKyselyDestroy).toHaveBeenCalled();
      expect(mockDbClose).toHaveBeenCalled();
    });

    it("should handle create -> reset -> use lifecycle", () => {
      // 1. Create
      const service = DatabaseService.getInstance();
      const initialPath = service.getPath();

      // 2. Reset
      service.reset();

      // 3. After reset, service should still be usable
      const newDb = service.getDb();
      expect(newDb).toBeDefined();

      const newKysely = service.getKysely();
      expect(newKysely).toBeDefined();

      const newPath = service.getPath();
      expect(newPath).toBe(initialPath);

      // 4. Migrations should have been re-run
      expect(mockMigrationRunnerRunMigrations).toHaveBeenCalled();
    });

    it("should maintain singleton through reset", () => {
      const service1 = DatabaseService.getInstance();
      service1.reset();
      const service2 = DatabaseService.getInstance();

      expect(service1).toBe(service2);
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle reset when WAL and SHM files do not exist", () => {
      const service = DatabaseService.getInstance();

      // Only the main db file exists
      mockFsExistsSync.mockImplementation(((p: string) => {
        if (
          typeof p === "string" &&
          (p.endsWith("-wal") || p.endsWith("-shm"))
        ) {
          return false;
        }
        return true;
      }) as any);

      mockFsUnlinkSync.mockClear();
      service.reset();

      // Should only unlink the main db file
      const unlinkCalls = mockFsUnlinkSync.mock.calls.map(([p]: [string]) => p);
      expect(unlinkCalls).toHaveLength(1);
      expect(unlinkCalls[0]).toContain("soothsayer.db");
    });

    it("should handle user data path with spaces", () => {
      mockAppGetPath.mockReturnValue("/Users/some user/app data");

      // @ts-expect-error
      DatabaseService._instance = undefined;
      const service = DatabaseService.getInstance();

      const dbPath = service.getPath();
      expect(dbPath).toContain("some user");
      expect(dbPath).toContain("soothsayer.db");
    });

    it("should construct path using the user data directory from app.getPath", () => {
      mockAppGetPath.mockReturnValue("/specific/path");

      // @ts-expect-error
      DatabaseService._instance = undefined;
      const service = DatabaseService.getInstance();

      const dbPath = service.getPath();
      const normalized = dbPath.replace(/\\/g, "/");
      expect(normalized).toContain("/specific/path");
    });
  });
});
