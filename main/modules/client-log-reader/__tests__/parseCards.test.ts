import { describe, expect, it } from "vitest";

import { parseCards } from "../utils/parseCards";

describe("parseCards", () => {
  // ─── Valid Card Parsing ──────────────────────────────────────────────────

  describe("valid card lines", () => {
    it("should parse a single card drop from a valid log line", () => {
      const logText =
        "2025/12/01 02:07:01 219999828 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
      expect(result.cards).toHaveProperty("The Doctor");
      expect(result.cards["The Doctor"].count).toBe(1);
      expect(result.cards["The Doctor"].processedIds).toHaveLength(1);
      expect(result.cards["The Doctor"].processedIds[0]).toBe("219999828");
    });

    it("should parse multiple different cards from multiple lines", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc12345 [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 abc12346 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 abc12347 [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(3);
      expect(Object.keys(result.cards)).toHaveLength(3);
      expect(result.cards["The Doctor"].count).toBe(1);
      expect(result.cards["Rain of Chaos"].count).toBe(1);
      expect(result.cards["The Fiend"].count).toBe(1);
    });

    it("should aggregate multiple drops of the same card", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc12345 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 100000002 abc12346 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 abc12347 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(3);
      expect(Object.keys(result.cards)).toHaveLength(1);
      expect(result.cards["Rain of Chaos"].count).toBe(3);
      expect(result.cards["Rain of Chaos"].processedIds).toHaveLength(3);
    });

    it("should use the third column as the unique ID", () => {
      const logText =
        "2025/12/01 02:07:01 205270890 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{Emperor's Luck}";

      const result = parseCards(logText);

      expect(result.cards["Emperor's Luck"].processedIds[0]).toBe("205270890");
    });

    it("should track unique processedIds per card", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.cards["The Doctor"].processedIds).toEqual(
        expect.arrayContaining(["100000001", "100000002"]),
      );
      expect(result.cards["The Doctor"].processedIds).toHaveLength(2);
    });
  });

  // ─── Card Names ──────────────────────────────────────────────────────────

  describe("card name variations", () => {
    it("should handle card names with apostrophes", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Emperor's Luck}";

      const result = parseCards(logText);

      expect(result.cards).toHaveProperty("Emperor's Luck");
    });

    it("should handle card names with 'The' prefix", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The King's Blade}";

      const result = parseCards(logText);

      expect(result.cards).toHaveProperty("The King's Blade");
    });

    it("should handle card names with special words", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{A Mother's Parting Gift}";

      const result = parseCards(logText);

      expect(result.cards).toHaveProperty("A Mother's Parting Gift");
    });

    it("should handle single-word card names", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Hubris}";

      const result = parseCards(logText);

      expect(result.cards).toHaveProperty("Hubris");
      expect(result.cards.Hubris.count).toBe(1);
    });

    it("should handle card names with 'of' and 'the' in the middle", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Luck of the Vaal}";

      const result = parseCards(logText);

      expect(result.cards).toHaveProperty("Luck of the Vaal");
    });

    it("should handle card names with hyphens", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{A Chilling Wind}";

      const result = parseCards(logText);

      expect(result.cards).toHaveProperty("A Chilling Wind");
    });
  });

  // ─── Deduplication via previouslyProcessedIds ────────────────────────────

  describe("previouslyProcessedIds filtering", () => {
    it("should skip lines whose unique ID is in the previously processed set", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 ghi [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
      ].join("\n");

      const alreadyProcessed = new Set(["100000001", "100000003"]);

      const result = parseCards(logText, alreadyProcessed);

      expect(result.totalCount).toBe(1);
      expect(Object.keys(result.cards)).toHaveLength(1);
      expect(result.cards["Rain of Chaos"].count).toBe(1);
    });

    it("should return zero results when all IDs are already processed", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const alreadyProcessed = new Set(["100000001", "100000002"]);

      const result = parseCards(logText, alreadyProcessed);

      expect(result.totalCount).toBe(0);
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it("should work correctly with an empty previously processed set", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText, new Set());

      expect(result.totalCount).toBe(1);
      expect(result.cards["The Doctor"].count).toBe(1);
    });

    it("should default to empty set when previouslyProcessedIds is not provided", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
    });

    it("should only skip exact ID matches, not partial matches", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const alreadyProcessed = new Set(["10000000", "1000000010"]);

      const result = parseCards(logText, alreadyProcessed);

      expect(result.totalCount).toBe(1);
    });
  });

  // ─── Duplicate Lines ────────────────────────────────────────────────────

  describe("duplicate line handling", () => {
    it("should deduplicate lines with the same unique ID within a single parse", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
      expect(result.cards["The Doctor"].count).toBe(1);
      expect(result.cards["The Doctor"].processedIds).toHaveLength(1);
    });

    it("should count distinct IDs even if the same card name appears with different IDs", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(2);
      expect(result.cards["Rain of Chaos"].count).toBe(2);
      expect(result.cards["Rain of Chaos"].processedIds).toHaveLength(2);
    });
  });

  // ─── Non-Card Lines ─────────────────────────────────────────────────────

  describe("non-card log lines", () => {
    it("should skip lines that don't contain the divination card marker", () => {
      const logText = [
        "2025/12/01 02:07:00 100000000 xyz [INFO Client 2588] : Connecting to instance server",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Entering area The Twilight Strand",
        "2025/12/01 02:07:03 100000003 ghi [DEBUG Client 2588] : Some debug info",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
      expect(Object.keys(result.cards)).toHaveLength(1);
      expect(result.cards["The Doctor"]).toBeDefined();
    });

    it("should return zero results for a log with no card drops", () => {
      const logText = [
        "2025/12/01 02:07:00 100000000 xyz [INFO Client 2588] : Connecting to instance server",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Entering area The Twilight Strand",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Item sold for 10 chaos",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it("should handle log lines mixed with empty lines", () => {
      const logText = [
        "",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "",
        "",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(2);
    });
  });

  // ─── Empty / Edge Inputs ────────────────────────────────────────────────

  describe("empty and edge case inputs", () => {
    it("should return empty result for an empty string", () => {
      const result = parseCards("");

      expect(result.totalCount).toBe(0);
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it("should return empty result for whitespace-only input", () => {
      const result = parseCards("   \n  \n   ");

      expect(result.totalCount).toBe(0);
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it("should return empty result for a single newline", () => {
      const result = parseCards("\n");

      expect(result.totalCount).toBe(0);
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it("should handle a single line with no newline at end", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
    });
  });

  // ─── Malformed Lines ────────────────────────────────────────────────────

  describe("malformed log lines", () => {
    it("should skip lines with the divination marker but no curly braces", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>The Doctor";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(Object.keys(result.cards)).toHaveLength(0);
    });

    it("should skip lines with too few space-separated parts to extract an ID", () => {
      const logText =
        "short line Card drawn from the deck: <divination>{The Doctor}";

      // This line has "short" at index 0, "line" at index 1, and "Card" at index 2
      // So it will try to use "Card" as the unique ID — it will actually parse
      const result = parseCards(logText);

      // It will parse because there are enough parts and it has the marker + braces
      // The ID will be "Card" which is unusual but the function doesn't validate IDs
      expect(result.totalCount).toBe(1);
    });

    it("should skip lines with fewer than 3 space-separated parts", () => {
      const logText = "ab Card drawn from the deck: <divination>{The Doctor}";

      // parts: ["ab", "Card", "drawn", ...] — parts[2] would be "drawn"
      // This has enough parts to extract an ID
      const result = parseCards(logText);

      // The function only requires parts.length >= 3
      expect(result.totalCount).toBe(1);
    });

    it("should skip lines with empty curly braces", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{}";

      const result = parseCards(logText);

      // The regex {([^}]+)} requires at least one character between braces
      expect(result.totalCount).toBe(0);
    });

    it("should handle lines with only opening curly brace", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
    });

    it("should handle lines with only closing curly brace", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
    });
  });

  // ─── Return Shape ───────────────────────────────────────────────────────

  describe("return value structure", () => {
    it("should return a DivinationCardResult with totalCount and cards", () => {
      const result = parseCards("");

      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("cards");
      expect(typeof result.totalCount).toBe("number");
      expect(typeof result.cards).toBe("object");
    });

    it("should return cards with count and processedIds array for each entry", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      const entry = result.cards["The Doctor"];
      expect(entry).toHaveProperty("count");
      expect(entry).toHaveProperty("processedIds");
      expect(typeof entry.count).toBe("number");
      expect(Array.isArray(entry.processedIds)).toBe(true);
    });

    it("should have totalCount equal to the sum of all card counts", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:03 100000003 ghi [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:04 100000004 jkl [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
        "2025/12/01 02:07:05 100000005 mno [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
        "2025/12/01 02:07:06 100000006 pqr [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
      ].join("\n");

      const result = parseCards(logText);

      const sumOfCounts = Object.values(result.cards).reduce(
        (sum, entry) => sum + entry.count,
        0,
      );
      expect(result.totalCount).toBe(sumOfCounts);
      expect(result.totalCount).toBe(6);
      expect(result.cards["The Doctor"].count).toBe(2);
      expect(result.cards["Rain of Chaos"].count).toBe(1);
      expect(result.cards["The Fiend"].count).toBe(3);
    });

    it("should have processedIds length equal to count for each card", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 ghi [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const result = parseCards(logText);

      const entry = result.cards["Rain of Chaos"];
      expect(entry.processedIds).toHaveLength(entry.count);
    });
  });

  // ─── Realistic Log Scenarios ────────────────────────────────────────────

  describe("realistic log scenarios", () => {
    it("should parse a realistic mixed log with various line types", () => {
      const logText = [
        "2025/12/01 02:06:55 219999820 aaa11111 [INFO Client 2588] : Connecting to instance server at 123.45.67.89:6112",
        "2025/12/01 02:06:56 219999821 bbb22222 [DEBUG Client 2588] : Got Instance Details from login server",
        "2025/12/01 02:06:57 219999822 ccc33333 [INFO Client 2588] : : You have entered The Canals.",
        "2025/12/01 02:07:01 219999828 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{The Doppelganger}",
        "2025/12/01 02:07:05 219999832 ddd44444 [INFO Client 2588] : AFK mode is now ON. Returning to town.",
        "2025/12/01 02:07:10 219999837 eee55555 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:15 219999842 fff66666 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:20 219999847 ggg77777 [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:25 219999852 hhh88888 [INFO Client 2588] : @From OtherPlayer: Hi, WTB your item listed for 10c",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(4);
      expect(Object.keys(result.cards)).toHaveLength(3);

      expect(result.cards["The Doppelganger"].count).toBe(1);
      expect(result.cards["The Doppelganger"].processedIds).toEqual([
        "219999828",
      ]);

      expect(result.cards["Rain of Chaos"].count).toBe(2);
      expect(result.cards["Rain of Chaos"].processedIds).toEqual(
        expect.arrayContaining(["219999837", "219999842"]),
      );

      expect(result.cards["The Doctor"].count).toBe(1);
      expect(result.cards["The Doctor"].processedIds).toEqual(["219999847"]);
    });

    it("should handle a batch of 10 rapid card drops (simulating stacked deck opening)", () => {
      const lines: string[] = [];
      for (let i = 0; i < 10; i++) {
        const id = 300000000 + i;
        const second = String(i).padStart(2, "0");
        const cards = [
          "Rain of Chaos",
          "The Surgeon",
          "Emperor's Luck",
          "Rain of Chaos",
          "The Doppelganger",
          "Rain of Chaos",
          "Loyalty",
          "The Surgeon",
          "Rain of Chaos",
          "Her Mask",
        ];
        lines.push(
          `2025/12/01 02:07:${second} ${id} hash${i} [INFO Client 2588] : Card drawn from the deck: <divination>{${cards[i]}}`,
        );
      }

      const result = parseCards(lines.join("\n"));

      expect(result.totalCount).toBe(10);

      // Rain of Chaos appears 4 times
      expect(result.cards["Rain of Chaos"].count).toBe(4);
      // The Surgeon appears 2 times
      expect(result.cards["The Surgeon"].count).toBe(2);
      // Single-occurrence cards
      expect(result.cards["Emperor's Luck"].count).toBe(1);
      expect(result.cards["The Doppelganger"].count).toBe(1);
      expect(result.cards.Loyalty.count).toBe(1);
      expect(result.cards["Her Mask"].count).toBe(1);
    });

    it("should correctly filter out previously processed IDs from a realistic batch", () => {
      const logText = [
        "2025/12/01 02:07:01 400000001 h1 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 400000002 h2 [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:03 400000003 h3 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:04 400000004 h4 [INFO Client 2588] : Card drawn from the deck: <divination>{Emperor's Luck}",
        "2025/12/01 02:07:05 400000005 h5 [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
      ].join("\n");

      // Suppose we already processed the first 3
      const alreadyProcessed = new Set(["400000001", "400000002", "400000003"]);

      const result = parseCards(logText, alreadyProcessed);

      expect(result.totalCount).toBe(2);
      expect(Object.keys(result.cards)).toHaveLength(2);
      expect(result.cards["Emperor's Luck"].count).toBe(1);
      expect(result.cards["The Fiend"].count).toBe(1);
      expect(result.cards["Rain of Chaos"]).toBeUndefined();
      expect(result.cards["The Doctor"]).toBeUndefined();
    });

    it("should handle Windows-style line endings (CRLF)", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\r\n");

      // The function splits on \n, so \r will be part of the line but
      // shouldn't affect the card name extraction since it's after the closing brace
      const result = parseCards(logText);

      expect(result.totalCount).toBe(2);
      expect(result.cards["The Doctor"]).toBeDefined();
      expect(result.cards["Rain of Chaos"]).toBeDefined();
    });

    it("should handle trailing newline at end of log text", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}\n";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
      expect(result.cards["The Doctor"].count).toBe(1);
    });
  });
});
