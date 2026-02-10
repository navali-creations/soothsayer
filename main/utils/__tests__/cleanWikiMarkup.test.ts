import { describe, expect, it } from "vitest";

import { cleanWikiMarkup } from "../cleanWikiMarkup";

describe("cleanWikiMarkup", () => {
  // ─── Null / Undefined / Empty Handling ─────────────────────────────────────

  describe("null, undefined, and empty input", () => {
    it("should return empty string for null input", () => {
      expect(cleanWikiMarkup(null)).toBe("");
    });

    it("should return empty string for undefined input", () => {
      expect(cleanWikiMarkup(undefined)).toBe("");
    });

    it("should return empty string for empty string input", () => {
      expect(cleanWikiMarkup("")).toBe("");
    });

    it("should return trimmed result for whitespace-only input", () => {
      expect(cleanWikiMarkup("   ")).toBe("");
    });
  });

  // ─── Passthrough (No Markup) ───────────────────────────────────────────────

  describe("passthrough for plain text", () => {
    it("should return plain text unchanged", () => {
      expect(cleanWikiMarkup("Hello World")).toBe("Hello World");
    });

    it("should return HTML without wiki markup unchanged", () => {
      expect(cleanWikiMarkup("<span>Headhunter</span>")).toBe(
        "<span>Headhunter</span>",
      );
    });

    it("should return complex HTML unchanged when no wiki markup present", () => {
      const html = '<span class="rare">Mirror of Kalandra</span>';
      expect(cleanWikiMarkup(html)).toBe(html);
    });

    it("should preserve single brackets", () => {
      expect(cleanWikiMarkup("[not wiki markup]")).toBe("[not wiki markup]");
    });
  });

  // ─── [[File:...]] Removal ──────────────────────────────────────────────────

  describe("[[File:...]] image reference removal", () => {
    it("should remove a simple [[File:...]] reference", () => {
      expect(cleanWikiMarkup("[[File:something.png]]")).toBe("");
    });

    it("should remove [[File:...]] with size parameters", () => {
      expect(cleanWikiMarkup("[[File:icon.png|32px]]")).toBe("");
    });

    it("should remove [[File:...]] with multiple parameters", () => {
      expect(cleanWikiMarkup("[[File:item.png|32px|link=Something]]")).toBe("");
    });

    it("should remove [[File:...]] embedded in other text", () => {
      expect(cleanWikiMarkup("Before [[File:icon.png|16px]] After")).toBe(
        "Before After",
      );
    });

    it("should remove multiple [[File:...]] references", () => {
      expect(
        cleanWikiMarkup(
          "[[File:a.png|32px]] text [[File:b.png|16px]] more text",
        ),
      ).toBe("text more text");
    });

    it("should remove [[File:...]] with complex path", () => {
      expect(
        cleanWikiMarkup(
          "[[File:Inventory/Items/Currency/CurrencyRerollRare.png|32px]]",
        ),
      ).toBe("");
    });
  });

  // ─── [[ItemName|DisplayText]] Pattern ──────────────────────────────────────

  describe("[[ItemName|DisplayText]] link pattern", () => {
    it("should keep only the display text from [[Link|Display]] patterns", () => {
      expect(cleanWikiMarkup("[[Headhunter|Headhunter]]")).toBe("Headhunter");
    });

    it("should keep display text when link and display differ", () => {
      expect(cleanWikiMarkup("[[Some_Internal_Page|Visible Text]]")).toBe(
        "Visible Text",
      );
    });

    it("should handle multiple [[Link|Display]] patterns in one string", () => {
      expect(cleanWikiMarkup("[[ItemA|Item A]] and [[ItemB|Item B]]")).toBe(
        "Item A and Item B",
      );
    });

    it("should handle [[Link|Display]] with HTML around it", () => {
      expect(cleanWikiMarkup("<span>[[Headhunter|Headhunter]]</span>")).toBe(
        "<span>Headhunter</span>",
      );
    });

    it("should handle [[Link|Display]] where display text has spaces", () => {
      expect(cleanWikiMarkup("[[The_Doctors_Page|The Doctor]]")).toBe(
        "The Doctor",
      );
    });
  });

  // ─── [[SimpleLink]] Pattern ────────────────────────────────────────────────

  describe("[[SimpleLink]] pattern (no pipe)", () => {
    it("should remove brackets from [[SimpleLink]]", () => {
      expect(cleanWikiMarkup("[[Headhunter]]")).toBe("Headhunter");
    });

    it("should remove brackets from [[Multi Word Link]]", () => {
      expect(cleanWikiMarkup("[[Mirror of Kalandra]]")).toBe(
        "Mirror of Kalandra",
      );
    });

    it("should handle multiple [[SimpleLink]] patterns", () => {
      expect(cleanWikiMarkup("[[Item A]] and [[Item B]]")).toBe(
        "Item A and Item B",
      );
    });

    it("should handle [[SimpleLink]] embedded in HTML", () => {
      expect(cleanWikiMarkup("<em>[[Chaos Orb]]</em>")).toBe(
        "<em>Chaos Orb</em>",
      );
    });
  });

  // ─── Combined Patterns ────────────────────────────────────────────────────

  describe("combined wiki markup patterns", () => {
    it("should handle File refs + Link|Display + SimpleLink together", () => {
      const input =
        "[[File:icon.png|32px]] [[Headhunter|Headhunter]] is a [[Unique Item]]";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("Headhunter is a Unique Item");
    });

    it("should handle a realistic reward_html string", () => {
      const input =
        "[[File:Inventory/Items/Belts/HeadhunterBelt.png|32px]] [[Headhunter|Headhunter]]";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("Headhunter");
    });

    it("should handle a realistic flavour_html string", () => {
      const input =
        "[[File:something.png|16px]] The [[Exile|exile]] ventured into the [[Wraeclast|unknown]]";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("The exile ventured into the unknown");
    });

    it("should handle multiple File refs followed by text", () => {
      const input = "[[File:a.png|16px]][[File:b.png|16px]] Some reward text";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("Some reward text");
    });
  });

  // ─── Whitespace Normalization ──────────────────────────────────────────────

  describe("whitespace normalization", () => {
    it("should collapse multiple spaces into a single space", () => {
      expect(cleanWikiMarkup("Hello    World")).toBe("Hello World");
    });

    it("should collapse spaces left after removing [[File:...]]", () => {
      const input = "Before  [[File:icon.png|32px]]  After";
      const result = cleanWikiMarkup(input);

      expect(result).toBe("Before After");
    });

    it("should trim leading and trailing whitespace", () => {
      expect(cleanWikiMarkup("  Hello World  ")).toBe("Hello World");
    });

    it("should handle tabs and newlines by collapsing them", () => {
      expect(cleanWikiMarkup("Hello\t\n  World")).toBe("Hello World");
    });

    it("should produce clean output with no double spaces after complex cleanup", () => {
      const input =
        "  [[File:a.png|32px]]  [[Headhunter|Headhunter]]  is  great  ";
      const result = cleanWikiMarkup(input);

      expect(result).not.toContain("  ");
      expect(result).toBe("Headhunter is great");
    });
  });

  // ─── Edge Cases ────────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle nested-looking brackets gracefully", () => {
      // This isn't valid wiki markup, but the function should handle it
      const result = cleanWikiMarkup("[[outer [[inner]] text]]");
      // The regex is greedy-minimal with [^\]], so it should handle this
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle empty brackets [[]]", () => {
      const result = cleanWikiMarkup("[[]]");
      // [^\]]+ requires at least one char, so [[]] won't match the pattern
      expect(result).toBe("[[]]");
    });

    it("should handle pipe with empty display text [[Link|]]", () => {
      // The regex [[([^\]|]+)\|([^\]]+)]] requires at least one char after pipe
      const result = cleanWikiMarkup("text [[Link|]] more");
      expect(typeof result).toBe("string");
    });

    it("should handle string with only wiki markup", () => {
      expect(cleanWikiMarkup("[[File:only.png|32px]]")).toBe("");
    });

    it("should not modify strings with single brackets", () => {
      expect(cleanWikiMarkup("[single] brackets")).toBe("[single] brackets");
    });

    it("should handle very long card descriptions", () => {
      const longText = `${"A ".repeat(500)}[[Headhunter|Headhunter]]`;
      const result = cleanWikiMarkup(longText);

      expect(result).toContain("Headhunter");
      expect(result).not.toContain("[[");
      expect(result).not.toContain("]]");
    });

    it("should handle File references with special characters in filename", () => {
      expect(cleanWikiMarkup("[[File:Item's_Icon (v2).png|32px]]")).toBe("");
    });

    it("should handle consecutive wiki patterns without spaces", () => {
      const input = "[[File:a.png]][[Item|Display]][[Simple]]";
      const result = cleanWikiMarkup(input);

      expect(result).toBe("DisplaySimple");
    });
  });

  // ─── Real-World Divination Card Data ───────────────────────────────────────

  describe("real-world divination card data", () => {
    it("should clean a typical reward_html with file + item link", () => {
      const input =
        "[[File:Inventory/Items/Belts/HeadhunterBelt.png|32px|link=Headhunter]] [[Headhunter|Headhunter]]";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("Headhunter");
    });

    it("should clean reward_html with multiple item references", () => {
      const input =
        "[[File:Exalted_Orb.png|32px]] 10x [[Exalted Orb|Exalted Orb]]";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("10x Exalted Orb");
    });

    it("should clean flavour text with wiki links", () => {
      const input =
        "The [[Vaal|Vaal]] empire fell to its own hubris, but its [[Corruption|corruption]] remains.";

      const result = cleanWikiMarkup(input);

      expect(result).toBe(
        "The Vaal empire fell to its own hubris, but its corruption remains.",
      );
    });

    it("should handle reward_html that is just plain HTML", () => {
      const input = '<span class="tc -default">Headhunter Leather Belt</span>';

      const result = cleanWikiMarkup(input);

      expect(result).toBe(input);
    });

    it("should handle reward_html with simple links and no files", () => {
      const input = "[[Mirror of Kalandra]]";

      const result = cleanWikiMarkup(input);

      expect(result).toBe("Mirror of Kalandra");
    });
  });
});
