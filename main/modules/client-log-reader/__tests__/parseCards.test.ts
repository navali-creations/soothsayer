import { describe, expect, it } from "vitest";

import {
  type CardDropEvent,
  parseCards,
  parseClientLogLine,
  parseLocationLine,
} from "../utils/parseCards";

function groupEventsByCard(events: readonly CardDropEvent[]) {
  const grouped: Record<string, { count: number; processedIds: string[] }> = {};
  for (const event of events) {
    grouped[event.cardName] ??= { count: 0, processedIds: [] };
    const entry = grouped[event.cardName];
    entry.count++;
    entry.processedIds.push(event.processedId);
  }
  return grouped;
}

describe("parseCards", () => {
  describe("drop context", () => {
    it("applies the latest location to subsequent card events in order", () => {
      const result = parseCards(
        [
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.",
          "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}",
          "2026/03/14 10:27:00 249522782 cffb06dd [INFO Client 21244] : You have entered The Rogue Harbour.",
          "2026/03/14 10:28:00 249522783 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{Rain of Chaos}",
        ].join("\n"),
      );

      expect(
        result.events.map(({ cardName, location }) => ({
          cardName,
          location,
        })),
      ).toEqual([
        { cardName: "The Scholar", location: "Atlas Hideout" },
        { cardName: "Rain of Chaos", location: "The Rogue Harbour" },
      ]);
      expect(result.lastLocation).toBe("The Rogue Harbour");
    });

    it("uses the initial location when the appended chunk has no area line", () => {
      const result = parseCards(
        "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}",
        new Set(),
        "Atlas Hideout",
      );

      expect(result.events[0].location).toBe("Atlas Hideout");
      expect(result.events[0].localMinute).toBe(10 * 60 + 26);
      expect(result.events[0].utcOffsetMinutes).toBe(
        0 - new Date(2026, 2, 14, 10, 26, 12).getTimezoneOffset(),
      );
      expect(result.events[0].droppedAt).toBe(
        new Date(2026, 2, 14, 10, 26, 12).toISOString(),
      );
    });

    it("deduplicates a source event ID globally across card names", () => {
      const result = parseCards(
        [
          "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}",
          "2026/03/14 10:26:13 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{Rain of Chaos}",
        ].join("\n"),
      );

      expect(result.totalCount).toBe(1);
      expect(result.events).toHaveLength(1);
      expect(groupEventsByCard(result.events)).not.toHaveProperty(
        "Rain of Chaos",
      );
    });

    it("parses both observed location message forms", () => {
      expect(
        parseLocationLine(
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.",
        ),
      ).toBe("Atlas Hideout");
      expect(
        parseLocationLine(
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : : You have entered Atlas Hideout.",
        ),
      ).toBe("Atlas Hideout");
    });

    it("rejects malformed timestamps and location messages", () => {
      expect(
        parseLocationLine(
          "2026/02/30 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.",
        ),
      ).toBeNull();
      expect(
        parseLocationLine(
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout",
        ),
      ).toBeNull();
      expect(
        parseLocationLine(
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered  .",
        ),
      ).toBeNull();
      expect(
        parseClientLogLine(
          "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered  .",
          null,
        ),
      ).toBeNull();
      expect(parseClientLogLine("not a log line", null)).toBeNull();
    });
  });

  // ─── Valid Card Parsing ──────────────────────────────────────────────────

  describe("valid card lines", () => {
    it("should parse a single card drop from a valid log line", () => {
      const logText =
        "2025/12/01 02:07:01 219999828 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
      expect(groupEventsByCard(result.events)).toHaveProperty("The Doctor");
      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(1);
      expect(
        groupEventsByCard(result.events)["The Doctor"].processedIds,
      ).toHaveLength(1);
      expect(
        groupEventsByCard(result.events)["The Doctor"].processedIds[0],
      ).toBe("219999828");
    });

    it("should parse multiple different cards from multiple lines", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc12345 [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 abc12346 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 abc12347 [INFO Client 2588] : Card drawn from the deck: <divination>{The Fiend}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(3);
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(3);
      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(1);
      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(1);
      expect(groupEventsByCard(result.events)["The Fiend"].count).toBe(1);
    });

    it("should aggregate multiple drops of the same card", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc12345 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 100000002 abc12346 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 abc12347 [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(3);
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(1);
      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(3);
      expect(
        groupEventsByCard(result.events)["Rain of Chaos"].processedIds,
      ).toHaveLength(3);
    });

    it("should extract the numeric event ID from the validated log prefix", () => {
      const logText =
        "2025/12/01 02:07:01 205270890 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{Emperor's Luck}";

      const result = parseCards(logText);

      expect(
        groupEventsByCard(result.events)["Emperor's Luck"].processedIds[0],
      ).toBe("205270890");
    });

    it("should track unique processedIds per card", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
      ].join("\n");

      const result = parseCards(logText);

      expect(
        groupEventsByCard(result.events)["The Doctor"].processedIds,
      ).toEqual(expect.arrayContaining(["100000001", "100000002"]));
      expect(
        groupEventsByCard(result.events)["The Doctor"].processedIds,
      ).toHaveLength(2);
    });
  });

  // ─── Card Names ──────────────────────────────────────────────────────────

  describe("card name variations", () => {
    it("should handle card names with apostrophes", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Emperor's Luck}";

      const result = parseCards(logText);

      expect(groupEventsByCard(result.events)).toHaveProperty("Emperor's Luck");
    });

    it("should handle card names with 'The' prefix", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The King's Blade}";

      const result = parseCards(logText);

      expect(groupEventsByCard(result.events)).toHaveProperty(
        "The King's Blade",
      );
    });

    it("should handle card names with special words", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{A Mother's Parting Gift}";

      const result = parseCards(logText);

      expect(groupEventsByCard(result.events)).toHaveProperty(
        "A Mother's Parting Gift",
      );
    });

    it("should handle single-word card names", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Hubris}";

      const result = parseCards(logText);

      expect(groupEventsByCard(result.events)).toHaveProperty("Hubris");
      expect(groupEventsByCard(result.events).Hubris.count).toBe(1);
    });

    it("should handle card names with 'of' and 'the' in the middle", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Luck of the Vaal}";

      const result = parseCards(logText);

      expect(groupEventsByCard(result.events)).toHaveProperty(
        "Luck of the Vaal",
      );
    });

    it("should handle card names with hyphens", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{A Chilling Wind}";

      const result = parseCards(logText);

      expect(groupEventsByCard(result.events)).toHaveProperty(
        "A Chilling Wind",
      );
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
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(1);
      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(1);
    });

    it("should return zero results when all IDs are already processed", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const alreadyProcessed = new Set(["100000001", "100000002"]);

      const result = parseCards(logText, alreadyProcessed);

      expect(result.totalCount).toBe(0);
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(0);
    });

    it("should work correctly with an empty previously processed set", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText, new Set());

      expect(result.totalCount).toBe(1);
      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(1);
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
      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(1);
      expect(
        groupEventsByCard(result.events)["The Doctor"].processedIds,
      ).toHaveLength(1);
    });

    it("should count distinct IDs even if the same card name appears with different IDs", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(2);
      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(2);
      expect(
        groupEventsByCard(result.events)["Rain of Chaos"].processedIds,
      ).toHaveLength(2);
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
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(1);
      expect(groupEventsByCard(result.events)["The Doctor"]).toBeDefined();
    });

    it("should return zero results for a log with no card drops", () => {
      const logText = [
        "2025/12/01 02:07:00 100000000 xyz [INFO Client 2588] : Connecting to instance server",
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Entering area The Twilight Strand",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Item sold for 10 chaos",
      ].join("\n");

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(0);
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
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(0);
    });

    it("should return empty result for whitespace-only input", () => {
      const result = parseCards("   \n  \n   ");

      expect(result.totalCount).toBe(0);
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(0);
    });

    it("should return empty result for a single newline", () => {
      const result = parseCards("\n");

      expect(result.totalCount).toBe(0);
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(0);
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
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(0);
    });

    it("should skip a marker embedded in text without a client-log prefix", () => {
      const logText =
        "short line Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(groupEventsByCard(result.events)).toEqual({});
    });

    it("should skip lines with a non-numeric event ID", () => {
      const logText =
        "2025/12/01 02:07:01 event-id abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(groupEventsByCard(result.events)).toEqual({});
    });

    it("should skip lines with an invalid timestamp prefix", () => {
      const logText =
        "2025-12-01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(groupEventsByCard(result.events)).toEqual({});
    });

    it("should skip lines without the client context", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(0);
      expect(groupEventsByCard(result.events)).toEqual({});
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
    it("should return a DivinationCardResult with totalCount and events", () => {
      const result = parseCards("");

      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("events");
      expect(result).toHaveProperty("lastLocation");
      expect(typeof result.totalCount).toBe("number");
      expect(result.events).toBeInstanceOf(Array);
    });

    it("should return an event for each unique card drop", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}";

      const result = parseCards(logText);

      expect(result.events).toEqual([
        expect.objectContaining({
          cardName: "The Doctor",
          processedId: "100000001",
        }),
      ]);
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

      const sumOfCounts = Object.values(
        groupEventsByCard(result.events),
      ).reduce((sum, entry) => sum + entry.count, 0);
      expect(result.totalCount).toBe(sumOfCounts);
      expect(result.totalCount).toBe(6);
      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(2);
      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(1);
      expect(groupEventsByCard(result.events)["The Fiend"].count).toBe(3);
    });

    it("should have processedIds length equal to count for each card", () => {
      const logText = [
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:02 100000002 def [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
        "2025/12/01 02:07:03 100000003 ghi [INFO Client 2588] : Card drawn from the deck: <divination>{Rain of Chaos}",
      ].join("\n");

      const result = parseCards(logText);

      const entry = groupEventsByCard(result.events)["Rain of Chaos"];
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
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(3);

      expect(groupEventsByCard(result.events)["The Doppelganger"].count).toBe(
        1,
      );
      expect(
        groupEventsByCard(result.events)["The Doppelganger"].processedIds,
      ).toEqual(["219999828"]);

      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(2);
      expect(
        groupEventsByCard(result.events)["Rain of Chaos"].processedIds,
      ).toEqual(expect.arrayContaining(["219999837", "219999842"]));

      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(1);
      expect(
        groupEventsByCard(result.events)["The Doctor"].processedIds,
      ).toEqual(["219999847"]);
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
      expect(groupEventsByCard(result.events)["Rain of Chaos"].count).toBe(4);
      // The Surgeon appears 2 times
      expect(groupEventsByCard(result.events)["The Surgeon"].count).toBe(2);
      // Single-occurrence cards
      expect(groupEventsByCard(result.events)["Emperor's Luck"].count).toBe(1);
      expect(groupEventsByCard(result.events)["The Doppelganger"].count).toBe(
        1,
      );
      expect(groupEventsByCard(result.events).Loyalty.count).toBe(1);
      expect(groupEventsByCard(result.events)["Her Mask"].count).toBe(1);
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
      expect(Object.keys(groupEventsByCard(result.events))).toHaveLength(2);
      expect(groupEventsByCard(result.events)["Emperor's Luck"].count).toBe(1);
      expect(groupEventsByCard(result.events)["The Fiend"].count).toBe(1);
      expect(groupEventsByCard(result.events)["Rain of Chaos"]).toBeUndefined();
      expect(groupEventsByCard(result.events)["The Doctor"]).toBeUndefined();
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
      expect(groupEventsByCard(result.events)["The Doctor"]).toBeDefined();
      expect(groupEventsByCard(result.events)["Rain of Chaos"]).toBeDefined();
    });

    it("should handle trailing newline at end of log text", () => {
      const logText =
        "2025/12/01 02:07:01 100000001 abc [INFO Client 2588] : Card drawn from the deck: <divination>{The Doctor}\n";

      const result = parseCards(logText);

      expect(result.totalCount).toBe(1);
      expect(groupEventsByCard(result.events)["The Doctor"].count).toBe(1);
    });
  });
});
