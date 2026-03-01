import { describe, expect, it } from "vitest";

import { maskPath } from "../mask-path";

describe("maskPath", () => {
  // ═══════════════════════════════════════════════════════════════════════════
  // Windows paths — anchor found
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Windows paths with anchor", () => {
    it("should mask user-specific segments for app-data paths", () => {
      const result = maskPath(
        "C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\soothsayer.db",
        ["soothsayer"],
      );
      expect(result).toBe("C:\\**\\soothsayer\\soothsayer.db");
      expect(result).not.toContain("seb");
      expect(result).not.toContain("Users");
      expect(result).not.toContain("AppData");
      expect(result).not.toContain("Roaming");
    });

    it("should mask directory paths (no trailing file)", () => {
      const result = maskPath("C:\\Users\\seb\\AppData\\Roaming\\soothsayer", [
        "soothsayer",
      ]);
      expect(result).toBe("C:\\**\\soothsayer");
      expect(result).not.toContain("seb");
    });

    it("should preserve backslash separators", () => {
      const result = maskPath(
        "C:\\Users\\test\\AppData\\Roaming\\soothsayer\\db.sqlite",
        ["soothsayer"],
      );
      expect(result).toContain("\\");
      expect(result).not.toContain("/");
    });

    it("should mask PoE1 client log paths via Steam", () => {
      const result = maskPath(
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt",
        ["Path of Exile", "Path of Exile 2"],
      );
      expect(result).toBe("C:\\**\\Path of Exile\\logs\\Client.txt");
      expect(result).not.toContain("Steam");
      expect(result).not.toContain("Program Files");
      expect(result).not.toContain("steamapps");
    });

    it("should mask PoE2 client log paths", () => {
      const result = maskPath("C:\\Games\\Path of Exile 2\\logs\\Client.txt", [
        "Path of Exile",
        "Path of Exile 2",
      ]);
      expect(result).toBe("C:\\**\\Path of Exile 2\\logs\\Client.txt");
      expect(result).not.toContain("Games");
    });

    it("should mask standalone PoE installation paths", () => {
      const result = maskPath(
        "D:\\Games\\Grinding Gear Games\\Path of Exile\\logs\\Client.txt",
        ["Path of Exile"],
      );
      expect(result).toBe("D:\\**\\Path of Exile\\logs\\Client.txt");
      expect(result).not.toContain("Grinding Gear Games");
    });

    it("should mask short PoE paths (e.g. C:\\PoE\\logs\\Client.txt)", () => {
      const result = maskPath("C:\\PoE\\logs\\Client.txt", ["PoE"]);
      expect(result).toBe("C:\\PoE\\logs\\Client.txt");
      // anchor at index 1 — nothing to mask
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Unix paths — anchor found
  // ═══════════════════════════════════════════════════════════════════════════

  describe("Unix paths with anchor", () => {
    it("should mask user-specific segments", () => {
      const result = maskPath("/home/seb/.config/soothsayer/soothsayer.db", [
        "soothsayer",
      ]);
      expect(result).toBe("/**/soothsayer/soothsayer.db");
      expect(result).not.toContain("seb");
      expect(result).not.toContain(".config");
      expect(result).not.toContain("home");
    });

    it("should mask directory paths", () => {
      const result = maskPath("/home/seb/.config/soothsayer", ["soothsayer"]);
      expect(result).toBe("/**/soothsayer");
      expect(result).not.toContain("seb");
    });

    it("should preserve forward-slash separators", () => {
      const result = maskPath("/home/test/.config/soothsayer/db.sqlite", [
        "soothsayer",
      ]);
      expect(result).toContain("/");
      expect(result).not.toContain("\\");
    });

    it("should mask Linux Steam PoE paths", () => {
      const result = maskPath(
        "/home/seb/.steam/steam/steamapps/common/Path of Exile/logs/Client.txt",
        ["Path of Exile", "Path of Exile 2"],
      );
      expect(result).toBe("/**/Path of Exile/logs/Client.txt");
      expect(result).not.toContain("seb");
      expect(result).not.toContain(".steam");
      expect(result).not.toContain("steamapps");
    });

    it("should mask macOS-style paths", () => {
      const result = maskPath(
        "/Users/seb/Library/Application Support/soothsayer/soothsayer.db",
        ["soothsayer"],
      );
      expect(result).toBe("/**/soothsayer/soothsayer.db");
      expect(result).not.toContain("seb");
      expect(result).not.toContain("Library");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Anchor matching behaviour
  // ═══════════════════════════════════════════════════════════════════════════

  describe("anchor matching", () => {
    it("should match anchors case-insensitively", () => {
      const result = maskPath(
        "C:\\Users\\seb\\AppData\\Roaming\\Soothsayer\\soothsayer.db",
        ["soothsayer"],
      );
      expect(result).toBe("C:\\**\\Soothsayer\\soothsayer.db");
      expect(result).not.toContain("seb");
    });

    it("should match uppercase anchors against lowercase path segments", () => {
      const result = maskPath("/home/seb/.config/soothsayer/data.db", [
        "SOOTHSAYER",
      ]);
      expect(result).toBe("/**/soothsayer/data.db");
    });

    it("should use the first matching anchor when multiple are provided", () => {
      const result = maskPath(
        "C:\\Program Files\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt",
        ["Path of Exile", "Path of Exile 2"],
      );
      expect(result).toBe("C:\\**\\Path of Exile\\logs\\Client.txt");
    });

    it("should prefer PoE2 anchor when PoE2 appears first in anchors list and matches", () => {
      // "Path of Exile 2" is listed first and matches the segment exactly
      const result = maskPath("C:\\Games\\Path of Exile 2\\logs\\Client.txt", [
        "Path of Exile 2",
        "Path of Exile",
      ]);
      expect(result).toBe("C:\\**\\Path of Exile 2\\logs\\Client.txt");
    });

    it("should anchor on the first occurrence scanning left-to-right", () => {
      const result = maskPath("/opt/soothsayer/data/soothsayer/soothsayer.db", [
        "soothsayer",
      ]);
      // First "soothsayer" at index 2 wins — keeps everything from there
      expect(result).toBe("/**/soothsayer/data/soothsayer/soothsayer.db");
    });

    it("should not match anchor as a substring of a segment", () => {
      // "soothsayer" should not match "soothsayer-backup"
      const result = maskPath("/home/seb/.config/soothsayer-backup/data.db", [
        "soothsayer",
      ]);
      // No anchor match → fallback
      expect(result).toBe("/**/soothsayer-backup/data.db");
      expect(result).not.toContain("seb");
    });

    it("should match segments with spaces in anchor names", () => {
      const result = maskPath(
        "C:\\Users\\seb\\Games\\Path of Exile\\logs\\Client.txt",
        ["Path of Exile"],
      );
      expect(result).toBe("C:\\**\\Path of Exile\\logs\\Client.txt");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Anchor at index 1 — nothing to mask
  // ═══════════════════════════════════════════════════════════════════════════

  describe("anchor at index 1 (no masking needed)", () => {
    it("should return Windows path unchanged when anchor is directly after root", () => {
      const result = maskPath("C:\\soothsayer\\soothsayer.db", ["soothsayer"]);
      expect(result).toBe("C:\\soothsayer\\soothsayer.db");
    });

    it("should return Unix path unchanged when anchor is directly after root", () => {
      const result = maskPath("/soothsayer/data.db", ["soothsayer"]);
      expect(result).toBe("/soothsayer/data.db");
    });

    it("should return single-segment Unix path unchanged", () => {
      const result = maskPath("/soothsayer", ["soothsayer"]);
      expect(result).toBe("/soothsayer");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Fallback — no anchor match
  // ═══════════════════════════════════════════════════════════════════════════

  describe("fallback (no anchor match)", () => {
    it("should keep root + ** + last two segments for long Unix paths", () => {
      const result = maskPath("/home/seb/.config/other-app/data.db", [
        "soothsayer",
      ]);
      expect(result).toBe("/**/other-app/data.db");
      expect(result).not.toContain("seb");
      expect(result).not.toContain("home");
      expect(result).not.toContain(".config");
    });

    it("should keep root + ** + last two segments for long Windows paths", () => {
      const result = maskPath(
        "C:\\Users\\seb\\SomeApp\\Config\\settings.json",
        ["soothsayer"],
      );
      expect(result).toBe("C:\\**\\Config\\settings.json");
      expect(result).not.toContain("seb");
      expect(result).not.toContain("SomeApp");
    });

    it("should return 3-segment paths unchanged (too short for fallback)", () => {
      // parts = ["", "some-app", "data.db"] → length 3, not > 3
      const result = maskPath("/some-app/data.db", ["soothsayer"]);
      expect(result).toBe("/some-app/data.db");
    });

    it("should return 2-segment Windows paths unchanged", () => {
      const result = maskPath("C:\\soothsayer.db", ["soothsayer"]);
      expect(result).toBe("C:\\soothsayer.db");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Edge cases & guard clauses
  // ═══════════════════════════════════════════════════════════════════════════

  describe("edge cases", () => {
    it("should return empty string unchanged", () => {
      expect(maskPath("", ["soothsayer"])).toBe("");
    });

    it("should return path unchanged when anchors array is empty", () => {
      expect(
        maskPath("C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\data.db", []),
      ).toBe("C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\data.db");
    });

    it("should handle a bare filename with no directory separators", () => {
      const result = maskPath("soothsayer.db", ["soothsayer"]);
      expect(result).toBe("soothsayer.db");
    });

    it("should handle root-only Unix path", () => {
      const result = maskPath("/", ["soothsayer"]);
      expect(result).toBe("/");
    });

    it("should handle root-only Windows path", () => {
      const result = maskPath("C:\\", ["soothsayer"]);
      expect(result).toBe("C:\\");
    });

    it("should handle path with trailing separator", () => {
      const result = maskPath(
        "C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\",
        ["soothsayer"],
      );
      // Trailing backslash creates an empty final segment; anchor still found
      expect(result).toBe("C:\\**\\soothsayer\\");
      expect(result).not.toContain("seb");
    });

    it("should handle path with trailing Unix separator", () => {
      const result = maskPath("/home/seb/.config/soothsayer/", ["soothsayer"]);
      expect(result).toBe("/**/soothsayer/");
      expect(result).not.toContain("seb");
    });

    it("should handle deeply nested paths", () => {
      const result = maskPath(
        "C:\\Users\\seb\\Documents\\Projects\\Games\\PoE\\Builds\\Path of Exile\\logs\\Client.txt",
        ["Path of Exile"],
      );
      expect(result).toBe("C:\\**\\Path of Exile\\logs\\Client.txt");
      expect(result).not.toContain("seb");
      expect(result).not.toContain("Documents");
      expect(result).not.toContain("Projects");
      expect(result).not.toContain("PoE");
      expect(result).not.toContain("Builds");
    });

    it("should handle paths with spaces in user directories", () => {
      const result = maskPath(
        "C:\\Users\\John Doe\\AppData\\Local\\soothsayer\\config.json",
        ["soothsayer"],
      );
      expect(result).toBe("C:\\**\\soothsayer\\config.json");
      expect(result).not.toContain("John Doe");
    });

    it("should handle paths with special characters in user directories", () => {
      const result = maskPath(
        "C:\\Users\\user.name-01\\AppData\\Roaming\\soothsayer\\data.db",
        ["soothsayer"],
      );
      expect(result).toBe("C:\\**\\soothsayer\\data.db");
      expect(result).not.toContain("user.name-01");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Real-world PoE path scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe("real-world PoE client paths", () => {
    const POE_ANCHORS = ["Path of Exile 2", "Path of Exile", "PoE", "PoE2"];

    it("should mask default Steam install path", () => {
      const result = maskPath(
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt",
        POE_ANCHORS,
      );
      expect(result).toBe("C:\\**\\Path of Exile\\logs\\Client.txt");
    });

    it("should mask custom Steam library path", () => {
      const result = maskPath(
        "D:\\SteamLibrary\\steamapps\\common\\Path of Exile\\logs\\Client.txt",
        POE_ANCHORS,
      );
      expect(result).toBe("D:\\**\\Path of Exile\\logs\\Client.txt");
    });

    it("should mask standalone PoE install", () => {
      const result = maskPath("C:\\Games\\PoE\\logs\\Client.txt", POE_ANCHORS);
      expect(result).toBe("C:\\**\\PoE\\logs\\Client.txt");
    });

    it("should mask PoE2 standalone install", () => {
      const result = maskPath(
        "C:\\Games\\Path of Exile 2\\logs\\Client.txt",
        POE_ANCHORS,
      );
      // "Path of Exile 2" appears before "Path of Exile" in anchors
      expect(result).toBe("C:\\**\\Path of Exile 2\\logs\\Client.txt");
    });

    it("should mask PoE2 Steam install", () => {
      const result = maskPath(
        "C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile 2\\logs\\Client.txt",
        POE_ANCHORS,
      );
      expect(result).toBe("C:\\**\\Path of Exile 2\\logs\\Client.txt");
    });

    it("should mask custom short PoE directory names", () => {
      const result = maskPath(
        "D:\\Users\\gamer\\Games\\PoE2\\logs\\Client.txt",
        POE_ANCHORS,
      );
      expect(result).toBe("D:\\**\\PoE2\\logs\\Client.txt");
      expect(result).not.toContain("gamer");
    });

    it("should fallback gracefully for unknown game directory names", () => {
      const result = maskPath(
        "C:\\Users\\seb\\Games\\Grinding Gear Games\\poe-client\\logs\\Client.txt",
        POE_ANCHORS,
      );
      // No anchor matches → fallback to last two segments
      expect(result).toBe("C:\\**\\logs\\Client.txt");
      expect(result).not.toContain("seb");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Real-world app-data path scenarios
  // ═══════════════════════════════════════════════════════════════════════════

  describe("real-world app-data paths", () => {
    const APP_ANCHORS = ["soothsayer"];

    it("should mask Windows AppData\\Roaming path", () => {
      const result = maskPath(
        "C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\soothsayer.db",
        APP_ANCHORS,
      );
      expect(result).toBe("C:\\**\\soothsayer\\soothsayer.db");
    });

    it("should mask Windows AppData\\Local path", () => {
      const result = maskPath(
        "C:\\Users\\seb\\AppData\\Local\\soothsayer\\cache\\data.json",
        APP_ANCHORS,
      );
      expect(result).toBe("C:\\**\\soothsayer\\cache\\data.json");
    });

    it("should mask Linux XDG config path", () => {
      const result = maskPath(
        "/home/seb/.config/soothsayer/soothsayer.db",
        APP_ANCHORS,
      );
      expect(result).toBe("/**/soothsayer/soothsayer.db");
    });

    it("should mask Linux XDG data path", () => {
      const result = maskPath(
        "/home/seb/.local/share/soothsayer/soothsayer.db",
        APP_ANCHORS,
      );
      expect(result).toBe("/**/soothsayer/soothsayer.db");
    });

    it("should mask macOS Application Support path", () => {
      const result = maskPath(
        "/Users/seb/Library/Application Support/soothsayer/soothsayer.db",
        APP_ANCHORS,
      );
      expect(result).toBe("/**/soothsayer/soothsayer.db");
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Separator preservation
  // ═══════════════════════════════════════════════════════════════════════════

  describe("separator preservation", () => {
    it("should never introduce forward slashes in Windows paths", () => {
      const result = maskPath(
        "C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\data.db",
        ["soothsayer"],
      );
      expect(result).not.toContain("/");
    });

    it("should never introduce backslashes in Unix paths", () => {
      const result = maskPath("/home/seb/.config/soothsayer/data.db", [
        "soothsayer",
      ]);
      expect(result).not.toContain("\\");
    });

    it("should preserve backslashes in fallback paths", () => {
      const result = maskPath("C:\\Users\\seb\\SomeApp\\Config\\data.json", [
        "nonexistent",
      ]);
      expect(result).not.toContain("/");
      expect(result).toContain("\\");
    });

    it("should preserve forward slashes in fallback paths", () => {
      const result = maskPath("/home/seb/.config/some-app/data.json", [
        "nonexistent",
      ]);
      expect(result).not.toContain("\\");
      expect(result).toContain("/");
    });
  });
});
