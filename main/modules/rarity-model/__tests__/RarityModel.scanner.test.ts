import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mock functions ──────────────────────────────────────────────────
const { mockGetPath, mockReaddir, mockStat, mockOpen } = vi.hoisted(() => ({
  mockGetPath: vi.fn(),
  mockReaddir: vi.fn(),
  mockStat: vi.fn(),
  mockOpen: vi.fn(),
}));

// ─── Mock Electron ───────────────────────────────────────────────────────────
vi.mock("electron", () => ({
  app: {
    getPath: mockGetPath,
  },
}));

// ─── Mock node:fs/promises ───────────────────────────────────────────────────
vi.mock("node:fs/promises", () => ({
  default: {
    readdir: mockReaddir,
    stat: mockStat,
    open: mockOpen,
  },
  readdir: mockReaddir,
  stat: mockStat,
  open: mockOpen,
}));

// ─── Import under test (after mocks) ────────────────────────────────────────
import { RarityModelScanner } from "../RarityModel.scanner";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeDirent(name: string, isFile: boolean) {
  return {
    name,
    isFile: () => isFile,
    isDirectory: () => !isFile,
    isBlockDevice: () => false,
    isCharacterDevice: () => false,
    isFIFO: () => false,
    isSocket: () => false,
    isSymbolicLink: () => false,
    path: "",
    parentPath: "",
  };
}

function makeFileHandle(content: string) {
  return {
    read: vi.fn(async (buffer: Buffer, offset: number, length: number) => {
      const bytes = Buffer.from(content, "utf-8");
      const bytesRead = Math.min(bytes.length, length);
      bytes.copy(buffer, offset, 0, bytesRead);
      return { bytesRead, buffer };
    }),
    close: vi.fn(async () => {}),
  };
}

function makeStatResult(
  overrides: Partial<{
    isDirectory: boolean;
    isFile: boolean;
    mtime: Date;
  }> = {},
) {
  return {
    isDirectory: () => overrides.isDirectory ?? false,
    isFile: () => overrides.isFile ?? true,
    mtime: overrides.mtime ?? new Date("2025-06-15T10:00:00Z"),
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("RarityModelScanner", () => {
  let scanner: RarityModelScanner;

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPath.mockReturnValue("C:\\Users\\TestUser\\Documents");
    scanner = new RarityModelScanner();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Directory Resolution
  // ═══════════════════════════════════════════════════════════════════════════

  describe("getFiltersDirectory", () => {
    it("should return the PoE1 documents directory path for poe1", () => {
      const result = scanner.getFiltersDirectory("poe1");
      expect(result).toContain("Documents");
      expect(result).toContain("My Games");
      expect(result).toContain("Path of Exile");
      expect(result).not.toContain("Path of Exile 2");
      expect(result).not.toContain("OnlineFilters");
    });

    it("should return the PoE2 documents directory path for poe2", () => {
      const result = scanner.getFiltersDirectory("poe2");
      expect(result).toContain("Documents");
      expect(result).toContain("My Games");
      expect(result).toContain("Path of Exile 2");
      expect(result).not.toContain("OnlineFilters");
    });

    it("should use app.getPath('documents') as the base", () => {
      mockGetPath.mockReturnValue("D:\\CustomDocs");
      const result = scanner.getFiltersDirectory("poe1");
      expect(result).toContain("D:\\CustomDocs");
      expect(mockGetPath).toHaveBeenCalledWith("documents");
    });
  });

  describe("getOnlineFiltersDirectory", () => {
    it("should return the PoE1 OnlineFilters subdirectory for poe1", () => {
      const result = scanner.getOnlineFiltersDirectory("poe1");
      expect(result).toContain("My Games");
      expect(result).toContain("Path of Exile");
      expect(result).not.toContain("Path of Exile 2");
      expect(result).toContain("OnlineFilters");
    });

    it("should return the PoE2 OnlineFilters subdirectory for poe2", () => {
      const result = scanner.getOnlineFiltersDirectory("poe2");
      expect(result).toContain("My Games");
      expect(result).toContain("Path of Exile 2");
      expect(result).toContain("OnlineFilters");
    });

    it("should be a subdirectory of the corresponding filters directory", () => {
      const filtersDir = scanner.getFiltersDirectory("poe1");
      const onlineDir = scanner.getOnlineFiltersDirectory("poe1");
      expect(onlineDir.startsWith(filtersDir)).toBe(true);

      const filtersDir2 = scanner.getFiltersDirectory("poe2");
      const onlineDir2 = scanner.getOnlineFiltersDirectory("poe2");
      expect(onlineDir2.startsWith(filtersDir2)).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Local Filter Scanning
  // ═══════════════════════════════════════════════════════════════════════════

  describe("scanLocalFilters", () => {
    it("should return empty array when directory does not exist", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT"));

      const result = await scanner.scanLocalFilters("poe1");
      expect(result).toEqual([]);
    });

    it("should return empty array when directory is not a directory", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: false }));

      const result = await scanner.scanLocalFilters("poe1");
      expect(result).toEqual([]);
    });

    it("should return empty array when directory is empty", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([]);

      const result = await scanner.scanLocalFilters("poe1");
      expect(result).toEqual([]);
    });

    it("should discover .filter files and extract metadata", async () => {
      const mtime = new Date("2025-07-01T15:30:00Z");

      // stat for directory check
      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        // stat for file metadata
        .mockResolvedValueOnce(makeStatResult({ mtime }));

      mockReaddir.mockResolvedValue([makeDirent("siege_0_Soft.filter", true)]);

      const result = await scanner.scanLocalFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterType).toBe("local");
      expect(result[0].filterName).toBe("siege_0_Soft");
      expect(result[0].lastUpdate).toBe(mtime.toISOString());
      expect(result[0].filePath).toContain("siege_0_Soft.filter");
    });

    it("should scan PoE2 directory when game is poe2", async () => {
      const mtime = new Date("2025-07-01T15:30:00Z");

      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        .mockResolvedValueOnce(makeStatResult({ mtime }));

      mockReaddir.mockResolvedValue([makeDirent("MyFilter.filter", true)]);

      const result = await scanner.scanLocalFilters("poe2");

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toContain("Path of Exile 2");
    });

    it("should handle multiple .filter files", async () => {
      const mtime1 = new Date("2025-07-01T15:30:00Z");
      const mtime2 = new Date("2025-07-02T10:00:00Z");

      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        .mockResolvedValueOnce(makeStatResult({ mtime: mtime1 }))
        .mockResolvedValueOnce(makeStatResult({ mtime: mtime2 }));

      mockReaddir.mockResolvedValue([
        makeDirent("NeverSink.filter", true),
        makeDirent("Custom.filter", true),
      ]);

      const result = await scanner.scanLocalFilters("poe1");

      expect(result).toHaveLength(2);
      expect(result.map((r) => r.filterName).sort()).toEqual(
        ["Custom", "NeverSink"].sort(),
      );
    });

    it("should ignore directories in the filter directory", async () => {
      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        .mockResolvedValueOnce(makeStatResult({ mtime: new Date() }));

      mockReaddir.mockResolvedValue([
        makeDirent("SomeFolder", false), // not a file
        makeDirent("actual.filter", true),
      ]);

      const result = await scanner.scanLocalFilters("poe1");

      // Should only discover actual.filter, not SomeFolder
      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("actual");
    });

    it("should ignore non-.filter files", async () => {
      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        .mockResolvedValueOnce(makeStatResult({ mtime: new Date() }));

      mockReaddir.mockResolvedValue([
        makeDirent("readme.txt", true),
        makeDirent("notes.md", true),
        makeDirent("valid.filter", true),
      ]);

      const result = await scanner.scanLocalFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("valid");
    });

    it("should handle .filter extension case-insensitively", async () => {
      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        .mockResolvedValueOnce(makeStatResult({ mtime: new Date() }))
        .mockResolvedValueOnce(makeStatResult({ mtime: new Date() }));

      mockReaddir.mockResolvedValue([
        makeDirent("Upper.FILTER", true),
        makeDirent("Mixed.Filter", true),
      ]);

      const result = await scanner.scanLocalFilters("poe1");

      expect(result).toHaveLength(2);
    });

    it("should gracefully skip files that fail to stat", async () => {
      mockStat
        .mockResolvedValueOnce(makeStatResult({ isDirectory: true }))
        .mockRejectedValueOnce(new Error("Permission denied"))
        .mockResolvedValueOnce(makeStatResult({ mtime: new Date() }));

      mockReaddir.mockResolvedValue([
        makeDirent("broken.filter", true),
        makeDirent("good.filter", true),
      ]);

      const result = await scanner.scanLocalFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("good");
    });

    it("should return empty array when readdir throws", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockRejectedValue(new Error("Access denied"));

      const result = await scanner.scanLocalFilters("poe1");
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Online Filter Scanning
  // ═══════════════════════════════════════════════════════════════════════════

  describe("scanOnlineFilters", () => {
    it("should return empty array when directory does not exist", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT"));

      const result = await scanner.scanOnlineFilters("poe1");
      expect(result).toEqual([]);
    });

    it("should return empty array when directory is empty", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([]);

      const result = await scanner.scanOnlineFilters("poe1");
      expect(result).toEqual([]);
    });

    it("should discover online filter files and extract metadata from headers", async () => {
      const headerContent = [
        "#Online Item Filter",
        "#name:AAAARanged",
        "#description:Some filter description",
        "#version:1.2.3",
        "#lastUpdate:2025-12-25T12:30:51Z",
      ].join("\n");

      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([makeDirent("abc123def456", true)]);
      mockOpen.mockResolvedValue(makeFileHandle(headerContent));

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterType).toBe("online");
      expect(result[0].filterName).toBe("AAAARanged");
      expect(result[0].lastUpdate).toBe("2025-12-25T12:30:51Z");
      expect(result[0].filePath).toContain("abc123def456");
    });

    it("should scan PoE2 online directory when game is poe2", async () => {
      const headerContent =
        "#name:Poe2Filter\n#lastUpdate:2025-07-01T00:00:00Z\n";

      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([makeDirent("onlinefilter1", true)]);
      mockOpen.mockResolvedValue(makeFileHandle(headerContent));

      const result = await scanner.scanOnlineFilters("poe2");

      expect(result).toHaveLength(1);
      expect(result[0].filePath).toContain("Path of Exile 2");
      expect(result[0].filePath).toContain("OnlineFilters");
    });

    it("should ignore files with extensions", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([
        makeDirent("readme.txt", true),
        makeDirent("config.json", true),
        makeDirent("validonlinefilter", true),
      ]);

      const headerContent = "#Online Item Filter\n#name:ValidFilter\n";
      mockOpen.mockResolvedValue(makeFileHandle(headerContent));

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("ValidFilter");
    });

    it("should ignore directories", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([
        makeDirent("somedir", false), // not a file
        makeDirent("validfilter", true),
      ]);

      const headerContent = "#name:ValidFilter\n";
      mockOpen.mockResolvedValue(makeFileHandle(headerContent));

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(1);
    });

    it("should use filename as fallback when #name header is missing", async () => {
      const headerContent = [
        "#Online Item Filter",
        "#version:1.0",
        "#lastUpdate:2025-06-01T00:00:00Z",
      ].join("\n");

      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([makeDirent("myfilterid", true)]);
      mockOpen.mockResolvedValue(makeFileHandle(headerContent));

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("myfilterid");
      expect(result[0].lastUpdate).toBe("2025-06-01T00:00:00Z");
    });

    it("should handle missing #lastUpdate gracefully", async () => {
      const headerContent = [
        "#Online Item Filter",
        "#name:FilterWithoutDate",
      ].join("\n");

      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([makeDirent("somefilter", true)]);
      mockOpen.mockResolvedValue(makeFileHandle(headerContent));

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("FilterWithoutDate");
      expect(result[0].lastUpdate).toBeNull();
    });

    it("should handle multiple online filters concurrently", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([
        makeDirent("filter1", true),
        makeDirent("filter2", true),
        makeDirent("filter3", true),
      ]);

      let callCount = 0;
      mockOpen.mockImplementation(async () => {
        callCount++;
        const content = `#name:Filter${callCount}\n#lastUpdate:2025-0${callCount}-01T00:00:00Z\n`;
        return makeFileHandle(content);
      });

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(3);
      // All should be online type
      expect(result.every((r) => r.filterType === "online")).toBe(true);
    });

    it("should gracefully skip files that fail to open", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockResolvedValue([
        makeDirent("broken", true),
        makeDirent("good", true),
      ]);

      let callCount = 0;
      mockOpen.mockImplementation(async () => {
        callCount++;
        if (callCount === 1) {
          throw new Error("Permission denied");
        }
        return makeFileHandle("#name:GoodFilter\n");
      });

      const result = await scanner.scanOnlineFilters("poe1");

      expect(result).toHaveLength(1);
      expect(result[0].filterName).toBe("GoodFilter");
    });

    it("should return empty array when readdir throws", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));
      mockReaddir.mockRejectedValue(new Error("Access denied"));

      const result = await scanner.scanOnlineFilters("poe1");
      expect(result).toEqual([]);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Combined Scanning (scanAll)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("scanAll", () => {
    it("should return empty array when both directories do not exist", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT"));

      const result = await scanner.scanAll("poe1");
      expect(result).toEqual([]);
    });

    it("should combine results from local and online directories", async () => {
      const localMtime = new Date("2025-07-01T10:00:00Z");

      // Path-aware stat: directory checks succeed, file stat returns mtime
      mockStat.mockImplementation(async (filePath: string) => {
        if (
          typeof filePath === "string" &&
          filePath.includes("OnlineFilters")
        ) {
          return makeStatResult({ isDirectory: true });
        }
        if (
          typeof filePath === "string" &&
          filePath.includes("Path of Exile") &&
          !filePath.includes("OnlineFilters")
        ) {
          if (filePath.endsWith("Path of Exile")) {
            return makeStatResult({ isDirectory: true });
          }
          return makeStatResult({ mtime: localMtime });
        }
        return makeStatResult({ isDirectory: true });
      });

      mockReaddir.mockImplementation(async (dirPath: string) => {
        if (typeof dirPath === "string" && dirPath.includes("OnlineFilters")) {
          return [makeDirent("onlinefilter1", true)];
        }
        return [makeDirent("MyFilter.filter", true)];
      });

      mockOpen.mockResolvedValue(
        makeFileHandle(
          "#name:OnlineFilter1\n#lastUpdate:2025-06-15T00:00:00Z\n",
        ),
      );

      const result = await scanner.scanAll("poe1");

      const localResults = result.filter((r) => r.filterType === "local");
      const onlineResults = result.filter((r) => r.filterType === "online");

      expect(localResults).toHaveLength(1);
      expect(onlineResults).toHaveLength(1);
    });

    it("should scan PoE2 directories when game is poe2", async () => {
      mockStat.mockImplementation(async (filePath: string) => {
        if (
          typeof filePath === "string" &&
          filePath.includes("Path of Exile 2")
        ) {
          return makeStatResult({ isDirectory: true });
        }
        throw new Error("ENOENT");
      });

      mockReaddir.mockResolvedValue([makeDirent("poe2filter.filter", true)]);
      mockStat.mockImplementation(async (filePath: string) => {
        if (typeof filePath === "string" && filePath.endsWith(".filter")) {
          return makeStatResult({ mtime: new Date() });
        }
        return makeStatResult({ isDirectory: true });
      });

      const result = await scanner.scanAll("poe2");

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.some((r) => r.filePath.includes("Path of Exile 2"))).toBe(
        true,
      );
    });

    it("should still return local filters if online directory does not exist", async () => {
      const mtime = new Date("2025-07-01T10:00:00Z");

      mockStat.mockImplementation(async (filePath: string) => {
        if (
          typeof filePath === "string" &&
          filePath.includes("OnlineFilters")
        ) {
          throw new Error("ENOENT");
        }
        if (typeof filePath === "string" && filePath.endsWith(".filter")) {
          return makeStatResult({ mtime });
        }
        return makeStatResult({ isDirectory: true });
      });

      mockReaddir.mockResolvedValue([makeDirent("MyFilter.filter", true)]);

      const result = await scanner.scanAll("poe1");

      expect(result.length).toBeGreaterThanOrEqual(1);
      expect(result.every((r) => r.filterType === "local")).toBe(true);
    });

    it("should still return online filters if local directory does not exist", async () => {
      mockStat.mockImplementation(async (filePath: string) => {
        if (
          typeof filePath === "string" &&
          filePath.includes("OnlineFilters")
        ) {
          return makeStatResult({ isDirectory: true });
        }
        if (
          typeof filePath === "string" &&
          filePath.includes("Path of Exile") &&
          !filePath.includes("OnlineFilters")
        ) {
          if (!filePath.endsWith(".filter")) {
            throw new Error("ENOENT");
          }
        }
        return makeStatResult({ isDirectory: true });
      });

      mockReaddir.mockResolvedValue([makeDirent("onlinefilter", true)]);

      mockOpen.mockResolvedValue(makeFileHandle("#name:OnlineFilter\n"));

      const result = await scanner.scanAll("poe1");

      expect(result.every((r) => r.filterType === "online")).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // extractLocalMetadata
  // ═══════════════════════════════════════════════════════════════════════════

  describe("extractLocalMetadata", () => {
    it("should extract name from filename without .filter extension", async () => {
      const mtime = new Date("2025-08-01T12:00:00Z");
      mockStat.mockResolvedValue(makeStatResult({ mtime }));

      const result = await scanner.extractLocalMetadata(
        "C:\\Users\\Test\\Documents\\My Games\\Path of Exile\\NeverSink.filter",
      );

      expect(result).not.toBeNull();
      expect(result!.filterName).toBe("NeverSink");
    });

    it("should use mtime as lastUpdate", async () => {
      const mtime = new Date("2025-08-15T08:30:00Z");
      mockStat.mockResolvedValue(makeStatResult({ mtime }));

      const result = await scanner.extractLocalMetadata(
        "C:\\path\\test.filter",
      );

      expect(result).not.toBeNull();
      expect(result!.lastUpdate).toBe(mtime.toISOString());
    });

    it("should set filterType to 'local'", async () => {
      mockStat.mockResolvedValue(makeStatResult({}));

      const result = await scanner.extractLocalMetadata("C:\\path\\x.filter");

      expect(result).not.toBeNull();
      expect(result!.filterType).toBe("local");
    });

    it("should preserve the full file path", async () => {
      const filePath =
        "C:\\Users\\Me\\Documents\\My Games\\Path of Exile\\siege.filter";
      mockStat.mockResolvedValue(makeStatResult({}));

      const result = await scanner.extractLocalMetadata(filePath);

      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(filePath);
    });

    it("should handle filenames with dots (e.g., v2.1.filter)", async () => {
      mockStat.mockResolvedValue(makeStatResult({}));

      const result = await scanner.extractLocalMetadata(
        "C:\\path\\NeverSink.v2.1.filter",
      );

      expect(result).not.toBeNull();
      expect(result!.filterName).toBe("NeverSink.v2.1");
    });

    it("should handle filenames with spaces", async () => {
      mockStat.mockResolvedValue(makeStatResult({}));

      const result = await scanner.extractLocalMetadata(
        "C:\\path\\My Custom Filter.filter",
      );

      expect(result).not.toBeNull();
      expect(result!.filterName).toBe("My Custom Filter");
    });

    it("should return null if stat throws", async () => {
      mockStat.mockRejectedValue(new Error("File not found"));

      const result = await scanner.extractLocalMetadata("C:\\path\\bad.filter");

      expect(result).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // extractOnlineMetadata
  // ═══════════════════════════════════════════════════════════════════════════

  describe("extractOnlineMetadata", () => {
    it("should extract name and lastUpdate from header lines", async () => {
      const content = [
        "#Online Item Filter",
        "#name:AAAARanged",
        "#description:Some desc",
        "#lastUpdate:2025-12-25T12:30:51Z",
      ].join("\n");

      mockOpen.mockResolvedValue(makeFileHandle(content));

      const result = await scanner.extractOnlineMetadata(
        "C:\\path\\OnlineFilters\\abc123",
      );

      expect(result).not.toBeNull();
      expect(result!.filterName).toBe("AAAARanged");
      expect(result!.lastUpdate).toBe("2025-12-25T12:30:51Z");
      expect(result!.filterType).toBe("online");
    });

    it("should use filename as fallback when #name is missing", async () => {
      const content = [
        "#Online Item Filter",
        "#lastUpdate:2025-06-01T00:00:00Z",
      ].join("\n");

      mockOpen.mockResolvedValue(makeFileHandle(content));

      const result = await scanner.extractOnlineMetadata(
        "C:\\path\\OnlineFilters\\myfilterid",
      );

      expect(result).not.toBeNull();
      expect(result!.filterName).toBe("myfilterid");
    });

    it("should handle empty file", async () => {
      mockOpen.mockResolvedValue(makeFileHandle(""));

      const result = await scanner.extractOnlineMetadata(
        "C:\\path\\OnlineFilters\\emptyfilter",
      );

      expect(result).not.toBeNull();
      expect(result!.filterName).toBe("emptyfilter");
      expect(result!.lastUpdate).toBeNull();
    });

    it("should return null if file cannot be opened", async () => {
      mockOpen.mockRejectedValue(new Error("Permission denied"));

      const result = await scanner.extractOnlineMetadata(
        "C:\\path\\OnlineFilters\\broken",
      );

      expect(result).toBeNull();
    });

    it("should set filterType to 'online'", async () => {
      mockOpen.mockResolvedValue(makeFileHandle("#name:Test\n"));

      const result = await scanner.extractOnlineMetadata(
        "C:\\path\\OnlineFilters\\test",
      );

      expect(result).not.toBeNull();
      expect(result!.filterType).toBe("online");
    });

    it("should preserve the full file path", async () => {
      const filePath =
        "C:\\Users\\Me\\Documents\\My Games\\Path of Exile\\OnlineFilters\\abc";
      mockOpen.mockResolvedValue(makeFileHandle("#name:Test\n"));

      const result = await scanner.extractOnlineMetadata(filePath);

      expect(result).not.toBeNull();
      expect(result!.filePath).toBe(filePath);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // parseOnlineHeader (static)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("parseOnlineHeader", () => {
    it("should extract #name and #lastUpdate from header lines", () => {
      const lines = [
        "#Online Item Filter",
        "#name:AAAARanged",
        "#description:A filter",
        "#lastUpdate:2025-12-25T12:30:51Z",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("AAAARanged");
      expect(result.lastUpdate).toBe("2025-12-25T12:30:51Z");
    });

    it("should return nulls when no header fields are present", () => {
      const lines = [
        "Show",
        '    BaseType == "Mirror of Kalandra"',
        "    SetFontSize 45",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBeNull();
      expect(result.lastUpdate).toBeNull();
    });

    it("should return nulls for empty lines array", () => {
      const result = RarityModelScanner.parseOnlineHeader([]);

      expect(result.name).toBeNull();
      expect(result.lastUpdate).toBeNull();
    });

    it("should handle name with spaces and special characters", () => {
      const lines = [
        "#name:My Filter (v2.1) - Updated!",
        "#lastUpdate:2025-01-01T00:00:00Z",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("My Filter (v2.1) - Updated!");
    });

    it("should handle extra whitespace around values", () => {
      const lines = [
        "#name:   SpacedName   ",
        "#lastUpdate:   2025-06-15T10:00:00Z   ",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("SpacedName");
      expect(result.lastUpdate).toBe("2025-06-15T10:00:00Z");
    });

    it("should handle name appearing before lastUpdate", () => {
      const lines = ["#name:First", "#lastUpdate:2025-01-01T00:00:00Z"];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("First");
      expect(result.lastUpdate).toBe("2025-01-01T00:00:00Z");
    });

    it("should handle lastUpdate appearing before name", () => {
      const lines = ["#lastUpdate:2025-01-01T00:00:00Z", "#name:Second"];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("Second");
      expect(result.lastUpdate).toBe("2025-01-01T00:00:00Z");
    });

    it("should use the first occurrence of each field", () => {
      const lines = [
        "#name:FirstName",
        "#name:SecondName",
        "#lastUpdate:2025-01-01T00:00:00Z",
        "#lastUpdate:2025-12-31T23:59:59Z",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("FirstName");
      expect(result.lastUpdate).toBe("2025-01-01T00:00:00Z");
    });

    it("should be case-insensitive for header field names", () => {
      const lines = ["#NAME:UpperCase", "#LASTUPDATE:2025-06-01T00:00:00Z"];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("UpperCase");
      expect(result.lastUpdate).toBe("2025-06-01T00:00:00Z");
    });

    it("should handle lines with leading/trailing whitespace", () => {
      const lines = [
        "  #name:Indented  ",
        "  #lastUpdate:2025-06-01T00:00:00Z  ",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("Indented");
      expect(result.lastUpdate).toBe("2025-06-01T00:00:00Z");
    });

    it("should handle mixed valid and invalid lines", () => {
      const lines = [
        "Show",
        "#name:ValidFilter",
        '    BaseType == "Some Item"',
        "#invalidHeader:value",
        "#lastUpdate:2025-03-15T14:00:00Z",
        "Hide",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBe("ValidFilter");
      expect(result.lastUpdate).toBe("2025-03-15T14:00:00Z");
    });

    it("should handle Windows-style line endings in values", () => {
      const lines = [
        "#name:WindowsFilter\r",
        "#lastUpdate:2025-06-01T00:00:00Z\r",
      ];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      // The trim() should handle \r at end
      expect(result.name).toBe("WindowsFilter");
      expect(result.lastUpdate).toBe("2025-06-01T00:00:00Z");
    });

    it("should not match lines without the # prefix", () => {
      const lines = ["name:NotAHeader", "lastUpdate:NotAHeader"];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      expect(result.name).toBeNull();
      expect(result.lastUpdate).toBeNull();
    });

    it("should handle empty name value", () => {
      const lines = ["#name:", "#lastUpdate:2025-01-01T00:00:00Z"];

      const result = RarityModelScanner.parseOnlineHeader(lines);

      // Empty string after trimming - regex requires at least one char after colon
      // The regex `.+` requires at least one character
      expect(result.name).toBeNull();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // readFirstLines
  // ═══════════════════════════════════════════════════════════════════════════

  describe("readFirstLines", () => {
    it("should return the first N lines of a file", async () => {
      const content = "line1\nline2\nline3\nline4\nline5\n";
      mockOpen.mockResolvedValue(makeFileHandle(content));

      const result = await scanner.readFirstLines("C:\\path\\file", 3);

      expect(result).toHaveLength(3);
      expect(result[0]).toBe("line1");
      expect(result[1]).toBe("line2");
      expect(result[2]).toBe("line3");
    });

    it("should return all lines if file has fewer lines than maxLines", async () => {
      const content = "only\ntwo\n";
      mockOpen.mockResolvedValue(makeFileHandle(content));

      const result = await scanner.readFirstLines("C:\\path\\file", 50);

      expect(result.length).toBeLessThanOrEqual(50);
      expect(result[0]).toBe("only");
      expect(result[1]).toBe("two");
    });

    it("should handle empty file", async () => {
      mockOpen.mockResolvedValue(makeFileHandle(""));

      const result = await scanner.readFirstLines("C:\\path\\file", 10);

      expect(result).toHaveLength(1);
      expect(result[0]).toBe("");
    });

    it("should handle Windows-style line endings (CRLF)", async () => {
      const content = "line1\r\nline2\r\nline3\r\n";
      mockOpen.mockResolvedValue(makeFileHandle(content));

      const result = await scanner.readFirstLines("C:\\path\\file", 3);

      expect(result[0]).toBe("line1");
      expect(result[1]).toBe("line2");
      expect(result[2]).toBe("line3");
    });

    it("should close file handle even on error", async () => {
      const handle = makeFileHandle("content");
      handle.read.mockRejectedValue(new Error("Read error"));
      mockOpen.mockResolvedValue(handle);

      await expect(
        scanner.readFirstLines("C:\\path\\file", 10),
      ).rejects.toThrow("Read error");

      expect(handle.close).toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // directoryExists
  // ═══════════════════════════════════════════════════════════════════════════

  describe("directoryExists", () => {
    it("should return true when path is a directory", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: true }));

      const result = await scanner.directoryExists("C:\\some\\dir");
      expect(result).toBe(true);
    });

    it("should return false when path is a file", async () => {
      mockStat.mockResolvedValue(makeStatResult({ isDirectory: false }));

      const result = await scanner.directoryExists("C:\\some\\file.txt");
      expect(result).toBe(false);
    });

    it("should return false when path does not exist", async () => {
      mockStat.mockRejectedValue(new Error("ENOENT"));

      const result = await scanner.directoryExists("C:\\nonexistent");
      expect(result).toBe(false);
    });

    it("should return false on permission error", async () => {
      mockStat.mockRejectedValue(new Error("EACCES"));

      const result = await scanner.directoryExists("C:\\restricted");
      expect(result).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // generateFilterId (static)
  // ═══════════════════════════════════════════════════════════════════════════

  describe("generateFilterId", () => {
    it("should generate a deterministic ID for a given path", () => {
      const id1 = RarityModelScanner.generateFilterId(
        "C:\\path\\to\\filter.filter",
      );
      const id2 = RarityModelScanner.generateFilterId(
        "C:\\path\\to\\filter.filter",
      );

      expect(id1).toBe(id2);
    });

    it("should generate different IDs for different paths", () => {
      const id1 = RarityModelScanner.generateFilterId(
        "C:\\path\\filter1.filter",
      );
      const id2 = RarityModelScanner.generateFilterId(
        "C:\\path\\filter2.filter",
      );

      expect(id1).not.toBe(id2);
    });

    it("should prefix IDs with 'filter_'", () => {
      const id = RarityModelScanner.generateFilterId("C:\\path\\test.filter");

      expect(id).toMatch(/^filter_[0-9a-f]{8}$/);
    });

    it("should normalize path separators (backslash and forward slash)", () => {
      const id1 = RarityModelScanner.generateFilterId("C:\\path\\to\\filter");
      const id2 = RarityModelScanner.generateFilterId("C:/path/to/filter");

      expect(id1).toBe(id2);
    });

    it("should be case-insensitive", () => {
      const id1 = RarityModelScanner.generateFilterId(
        "C:\\Path\\Filter.FILTER",
      );
      const id2 = RarityModelScanner.generateFilterId(
        "c:\\path\\filter.filter",
      );

      expect(id1).toBe(id2);
    });

    it("should handle long paths", () => {
      const longPath = `C:\\${"a".repeat(500)}\\filter.filter`;
      const id = RarityModelScanner.generateFilterId(longPath);

      expect(id).toMatch(/^filter_[0-9a-f]{8}$/);
    });
  });
});
