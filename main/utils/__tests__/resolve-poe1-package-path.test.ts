import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:fs existsSync
const { mockExistsSync } = vi.hoisted(() => ({
  mockExistsSync: vi.fn(),
}));

vi.mock("node:fs", () => ({
  existsSync: mockExistsSync,
}));

// Mock node:module createRequire
const { mockRequireResolve } = vi.hoisted(() => ({
  mockRequireResolve: vi.fn(),
}));

vi.mock("node:module", () => ({
  createRequire: vi.fn(() => ({
    resolve: mockRequireResolve,
  })),
}));

import {
  resolvePoe1CardsJsonPath,
  resolvePoe1DataPath,
} from "../resolve-poe1-package-path";

describe("resolvePoe1DataPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: require.resolve returns a typical node_modules path
    // The resolver now resolves data/cards.json (an exported path) instead of package.json
    mockRequireResolve.mockReturnValue(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards.json",
    );
  });

  it("should resolve via require.resolve in development mode", () => {
    const result = resolvePoe1DataPath("cards.json", false);
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards.json",
    );
  });

  it("should resolve via resourcesPath when packaged", () => {
    const result = resolvePoe1DataPath("cards.json", true, "/app/resources");
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe("/app/resources/poe1/cards.json");
  });

  it("should resolve any relative path in development mode", () => {
    const result = resolvePoe1DataPath("images/SomeCard.png", false);
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe(
      "/project/node_modules/@navali/poe1-divination-cards/data/images/SomeCard.png",
    );
  });

  it("should resolve any relative path when packaged", () => {
    const result = resolvePoe1DataPath(
      "images/SomeCard.png",
      true,
      "C:/Users/test/resources",
    );
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe("C:/Users/test/resources/poe1/images/SomeCard.png");
  });
});

describe("resolvePoe1DataPath — path traversal rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireResolve.mockReturnValue(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards.json",
    );
  });

  it.each([
    ["../etc/passwd", "parent directory traversal"],
    ["..\\etc\\passwd", "backslash parent directory traversal"],
    ["images/../../secret.txt", "mid-path traversal"],
    ["images\\..\\..\\secret.txt", "mid-path backslash traversal"],
    ["..", "bare double-dot"],
  ])("should reject %s (%s)", (maliciousPath) => {
    expect(() => resolvePoe1DataPath(maliciousPath, false)).toThrow(
      "Invalid relative path",
    );
  });

  it.each([
    ["/etc/passwd", "unix absolute path"],
    ["\\Windows\\System32\\config", "windows absolute backslash path"],
  ])("should reject absolute path %s (%s)", (absolutePath) => {
    expect(() => resolvePoe1DataPath(absolutePath, false)).toThrow(
      "Invalid relative path",
    );
  });

  it.each([
    ["/etc/passwd", "unix absolute path (packaged)"],
    ["../secret.json", "traversal (packaged)"],
  ])("should reject %s when packaged (%s)", (maliciousPath) => {
    expect(() =>
      resolvePoe1DataPath(maliciousPath, true, "/app/resources"),
    ).toThrow("Invalid relative path");
  });
});

describe("resolvePoe1CardsJsonPath", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireResolve.mockReturnValue(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards.json",
    );
  });

  it("should return league-specific path when file exists", () => {
    mockExistsSync.mockReturnValue(true);
    const result = resolvePoe1CardsJsonPath("Keepers", false);
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards-Keepers.json",
    );
  });

  it("should fall back to cards.json when league-specific file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const result = resolvePoe1CardsJsonPath("UnknownLeague", false);
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards.json",
    );
  });

  it("should return league-specific path when packaged and file exists", () => {
    mockExistsSync.mockReturnValue(true);
    const result = resolvePoe1CardsJsonPath("Keepers", true, "/app/resources");
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe("/app/resources/poe1/cards-Keepers.json");
  });

  it("should fall back to cards.json when packaged and league file does not exist", () => {
    mockExistsSync.mockReturnValue(false);
    const result = resolvePoe1CardsJsonPath(
      "UnknownLeague",
      true,
      "/app/resources",
    );
    const normalized = result.replace(/\\/g, "/");
    expect(normalized).toBe("/app/resources/poe1/cards.json");
  });
});

describe("resolvePoe1CardsJsonPath — path traversal rejection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireResolve.mockReturnValue(
      "/project/node_modules/@navali/poe1-divination-cards/data/cards.json",
    );
  });

  it.each([
    ["../etc", "parent directory traversal"],
    ["..\\etc", "backslash parent directory traversal"],
    ["..", "bare double-dot"],
    ["League/../secret", "embedded traversal"],
  ])("should reject league name %s (%s)", (maliciousLeague) => {
    expect(() => resolvePoe1CardsJsonPath(maliciousLeague, false)).toThrow(
      "Invalid league name",
    );
  });

  it.each([
    ["League/Evil", "forward slash in league name"],
    ["League\\Evil", "backslash in league name"],
    ["/etc/passwd", "absolute path as league name"],
  ])("should reject league name with path separators: %s (%s)", (league) => {
    expect(() => resolvePoe1CardsJsonPath(league, false)).toThrow(
      "Invalid league name",
    );
  });

  it("should reject traversal in league name when packaged", () => {
    expect(() =>
      resolvePoe1CardsJsonPath("../secret", true, "/app/resources"),
    ).toThrow("Invalid league name");
  });
});
