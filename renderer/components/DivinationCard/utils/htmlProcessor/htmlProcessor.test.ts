import { describe, expect, it } from "vitest";

import { processRewardHtml } from "./htmlProcessor";

describe("processRewardHtml", () => {
  describe("empty/falsy input", () => {
    it("returns empty string unchanged", () => {
      expect(processRewardHtml("")).toBe("");
    });

    it("returns null unchanged", () => {
      expect(processRewardHtml(null as unknown as string)).toBeNull();
    });

    it("returns undefined unchanged", () => {
      expect(processRewardHtml(undefined as unknown as string)).toBeUndefined();
    });
  });

  describe("replaces class with inline style for known PoE classes", () => {
    it("replaces -currency class", () => {
      const input = '<span class="-currency">Exalted Orb</span>';
      const expected =
        '<span style="color: rgb(170,158,130)">Exalted Orb</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces -unique class", () => {
      const input = '<span class="-unique">Headhunter</span>';
      const expected = '<span style="color: rgb(175,96,37)">Headhunter</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces -corrupted class", () => {
      const input = '<span class="-corrupted">Corrupted</span>';
      const expected = '<span style="color: rgb(210,0,0)">Corrupted</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces -magic class", () => {
      const input = '<span class="-magic">Magic Item</span>';
      const expected =
        '<span style="color: rgb(136,136,255)">Magic Item</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces -rare class", () => {
      const input = '<span class="-rare">Rare Item</span>';
      const expected = '<span style="color: rgb(255,255,119)">Rare Item</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces -gem class", () => {
      const input = '<span class="-gem">Enlighten</span>';
      const expected = '<span style="color: rgb(27,162,155)">Enlighten</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces -divination class", () => {
      const input = '<span class="-divination">The Doctor</span>';
      const expected = '<span style="color: rgb(14,186,255)">The Doctor</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });
  });

  describe("handles multiple classes in one attribute", () => {
    it("uses the first matching - prefixed class", () => {
      const input =
        '<span class="-currency -default">Mirror of Kalandra</span>';
      const expected =
        '<span style="color: rgb(170,158,130)">Mirror of Kalandra</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("uses -unique when it appears first among - prefixed classes", () => {
      const input = '<span class="-unique -corrupted">Corrupted Unique</span>';
      const expected =
        '<span style="color: rgb(175,96,37)">Corrupted Unique</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("skips non-dash-prefixed classes and uses first dash-prefixed class", () => {
      const input = '<span class="reward -rare highlight">Rare Amulet</span>';
      const expected =
        '<span style="color: rgb(255,255,119)">Rare Amulet</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });
  });

  describe("handles class with no - prefix classes", () => {
    it("falls back to default color when no classes start with -", () => {
      const input = '<span class="reward highlight">Some Text</span>';
      const expected = '<span style="color: rgb(200,200,200)">Some Text</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("falls back to default color for a single non-dash class", () => {
      const input = '<span class="plain">Plain Text</span>';
      const expected =
        '<span style="color: rgb(200,200,200)">Plain Text</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });
  });

  describe("handles multiple class attributes in the same HTML string", () => {
    it("replaces all class attributes independently", () => {
      const input =
        '<span class="-currency">Orb</span> and <span class="-unique">Headhunter</span>';
      const expected =
        '<span style="color: rgb(170,158,130)">Orb</span> and <span style="color: rgb(175,96,37)">Headhunter</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("replaces three class attributes in a row", () => {
      const input =
        '<span class="-gem">Gem</span><span class="-rare">Rare</span><span class="-corrupted">Corrupted</span>';
      const expected =
        '<span style="color: rgb(27,162,155)">Gem</span><span style="color: rgb(255,255,119)">Rare</span><span style="color: rgb(210,0,0)">Corrupted</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });
  });

  describe("preserves non-class HTML attributes", () => {
    it("keeps id attribute intact", () => {
      const input = '<span id="reward" class="-currency">Orb</span>';
      const expected =
        '<span id="reward" style="color: rgb(170,158,130)">Orb</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("keeps data attributes intact", () => {
      const input =
        '<span data-item="orb" class="-unique" data-count="3">Item</span>';
      const expected =
        '<span data-item="orb" style="color: rgb(175,96,37)" data-count="3">Item</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("does not alter HTML without class attributes", () => {
      const input = '<span id="test" data-value="42">No class here</span>';
      expect(processRewardHtml(input)).toBe(input);
    });
  });

  describe("handles realistic PoE reward HTML", () => {
    it("processes a currency reward span", () => {
      const input =
        '<span class="-currency -default">1x Mirror of Kalandra</span>';
      const expected =
        '<span style="color: rgb(170,158,130)">1x Mirror of Kalandra</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("processes a complex reward with nested elements", () => {
      const input =
        '<span class="-default">5x </span><span class="-currency">Exalted Orb</span>';
      const expected =
        '<span style="color: rgb(127,127,127)">5x </span><span style="color: rgb(170,158,130)">Exalted Orb</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("processes a corrupted unique item", () => {
      const input =
        '<span class="-unique">Headhunter</span> <span class="-corrupted">(Corrupted)</span>';
      const expected =
        '<span style="color: rgb(175,96,37)">Headhunter</span> <span style="color: rgb(210,0,0)">(Corrupted)</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });

    it("processes an enchanted item", () => {
      const input = '<span class="-enchanted">Enchanted Helmet</span>';
      const expected =
        '<span style="color: rgb(184,218,242)">Enchanted Helmet</span>';
      expect(processRewardHtml(input)).toBe(expected);
    });
  });
});
