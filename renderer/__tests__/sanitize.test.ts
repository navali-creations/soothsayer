import { describe, expect, it } from "vitest";

import { sanitizeHtml } from "~/renderer/sanitize";

describe("sanitizeHtml", () => {
  // ---------------------------------------------------------------
  // 1. Empty / falsy inputs
  // ---------------------------------------------------------------
  describe("empty and falsy inputs", () => {
    it("returns empty string for empty string input", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("returns empty string for null (coerced to falsy)", () => {
      // The function signature accepts string, but callers may pass null/undefined at runtime
      expect(sanitizeHtml(null as unknown as string)).toBe("");
    });

    it("returns empty string for undefined (coerced to falsy)", () => {
      expect(sanitizeHtml(undefined as unknown as string)).toBe("");
    });
  });

  // ---------------------------------------------------------------
  // 2. Preserves safe formatting tags
  // ---------------------------------------------------------------
  describe("preserves allowed tags", () => {
    const allowedTags = [
      { tag: "span", html: "<span>text</span>" },
      { tag: "br", html: "line<br>break" },
      { tag: "em", html: "<em>emphasized</em>" },
      { tag: "strong", html: "<strong>bold</strong>" },
      { tag: "b", html: "<b>bold</b>" },
      { tag: "i", html: "<i>italic</i>" },
      { tag: "u", html: "<u>underline</u>" },
      { tag: "div", html: "<div>block</div>" },
      { tag: "p", html: "<p>paragraph</p>" },
      { tag: "small", html: "<small>small text</small>" },
      { tag: "sub", html: "H<sub>2</sub>O" },
      { tag: "sup", html: "x<sup>2</sup>" },
    ];

    for (const { tag, html } of allowedTags) {
      it(`preserves <${tag}>`, () => {
        const result = sanitizeHtml(html);
        expect(result).toContain(`<${tag}`);
        // br is a void element – no closing tag expected
        if (tag !== "br") {
          expect(result).toContain(`</${tag}>`);
        }
      });
    }
  });

  // ---------------------------------------------------------------
  // 3. Strips dangerous tags
  // ---------------------------------------------------------------
  describe("strips dangerous tags", () => {
    const dangerousCases = [
      { tag: "script", html: '<script>alert("xss")</script>' },
      { tag: "img", html: '<img src="x.png">' },
      { tag: "iframe", html: '<iframe src="https://evil.com"></iframe>' },
      { tag: "form", html: '<form action="/steal"><input></form>' },
      { tag: "input", html: '<input type="text" value="evil">' },
      { tag: "svg", html: '<svg><circle r="10"></circle></svg>' },
      { tag: "object", html: '<object data="evil.swf"></object>' },
      { tag: "embed", html: '<embed src="evil.swf">' },
    ];

    for (const { tag, html } of dangerousCases) {
      it(`strips <${tag}>`, () => {
        const result = sanitizeHtml(html);
        expect(result).not.toContain(`<${tag}`);
      });
    }
  });

  // ---------------------------------------------------------------
  // 4. Strips event handler attributes
  // ---------------------------------------------------------------
  describe("strips event handler attributes", () => {
    const eventHandlers = ["onerror", "onload", "onclick", "onmouseover"];

    for (const attr of eventHandlers) {
      it(`strips ${attr} attribute`, () => {
        const html = `<span ${attr}="alert('xss')">text</span>`;
        const result = sanitizeHtml(html);
        expect(result).not.toContain(attr);
        // The span tag itself should be preserved since it's allowed
        expect(result).toContain("<span>");
        expect(result).toContain("text");
      });
    }
  });

  // ---------------------------------------------------------------
  // 5. Preserves allowed attributes
  // ---------------------------------------------------------------
  describe("preserves allowed attributes", () => {
    it('preserves "class" attribute on allowed tags', () => {
      const html = '<span class="reward-text">Exalted Orb</span>';
      const result = sanitizeHtml(html);
      expect(result).toBe('<span class="reward-text">Exalted Orb</span>');
    });

    it('preserves "style" attribute on allowed tags', () => {
      const html = '<span style="color: red;">warning</span>';
      const result = sanitizeHtml(html);
      expect(result).toBe('<span style="color: red;">warning</span>');
    });

    it("preserves both class and style together", () => {
      const html = '<div class="card" style="font-weight: bold;">content</div>';
      const result = sanitizeHtml(html);
      expect(result).toContain('class="card"');
      expect(result).toContain('style="font-weight: bold;"');
      expect(result).toContain("content");
    });
  });

  // ---------------------------------------------------------------
  // 6. Strips disallowed attributes
  // ---------------------------------------------------------------
  describe("strips disallowed attributes", () => {
    it('strips "id" attribute', () => {
      const html = '<span id="my-id">text</span>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("id=");
      expect(result).toContain("<span>");
      expect(result).toContain("text");
    });

    it('does not strip "data-*" attributes (DOMPurify allows them by default)', () => {
      const html = '<div data-value="secret" data-index="0">text</div>';
      const result = sanitizeHtml(html);
      // DOMPurify treats data-* attributes as safe by default, even when
      // they are not explicitly listed in ALLOWED_ATTR
      expect(result).toContain('data-value="secret"');
      expect(result).toContain('data-index="0"');
      expect(result).toContain("text");
    });

    it('strips "href" attribute', () => {
      // <a> is not in the allowed tags, so the whole tag should be stripped,
      // but let's also verify href doesn't leak if somehow present
      const html = '<span href="https://evil.com">link</span>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("href");
      expect(result).toContain("link");
    });

    it('strips "src" attribute', () => {
      const html = '<span src="https://evil.com/payload">text</span>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("src");
      expect(result).toContain("text");
    });
  });

  // ---------------------------------------------------------------
  // 7. Nested tags
  // ---------------------------------------------------------------
  describe("handles nested tags correctly", () => {
    it("preserves nested allowed tags", () => {
      const html =
        "<div><p><strong>bold</strong> and <em>italic</em></p></div>";
      const result = sanitizeHtml(html);
      expect(result).toBe(
        "<div><p><strong>bold</strong> and <em>italic</em></p></div>",
      );
    });

    it("strips dangerous tags nested inside allowed tags", () => {
      const html = '<div><script>alert("xss")</script><p>safe</p></div>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<script");
      expect(result).toContain("<div>");
      expect(result).toContain("<p>safe</p>");
    });

    it("strips allowed tags nested inside dangerous tags", () => {
      const html = "<script><span>hidden</span></script>";
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<script");
    });

    it("preserves deeply nested formatting", () => {
      const html =
        '<div><p><span class="a"><strong><em>deep</em></strong></span></p></div>';
      const result = sanitizeHtml(html);
      expect(result).toContain("<strong><em>deep</em></strong>");
      expect(result).toContain('class="a"');
    });
  });

  // ---------------------------------------------------------------
  // 8. XSS vectors
  // ---------------------------------------------------------------
  describe("XSS vectors", () => {
    it("strips <img onerror=...> XSS vector", () => {
      const html = '<img src="x" onerror="alert(\'xss\')">';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<img");
      expect(result).not.toContain("onerror");
      expect(result).not.toContain("alert");
    });

    it("strips <svg onload=...> XSS vector", () => {
      const html = "<svg onload=\"alert('xss')\">";
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<svg");
      expect(result).not.toContain("onload");
      expect(result).not.toContain("alert");
    });

    it("does not strip javascript: inside CSS url() when style is allowed", () => {
      const html =
        '<span style="background:url(javascript:alert(1))">text</span>';
      const result = sanitizeHtml(html);
      // DOMPurify does not sanitize javascript: within CSS url() values
      // when the style attribute is in ALLOWED_ATTR. This is a known
      // limitation — the style attribute itself is preserved as-is.
      expect(result).toContain("text");
      expect(result).toContain("<span");
    });

    it("strips <img> with base64 encoded payload", () => {
      const html =
        '<img src="data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==">';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<img");
      expect(result).not.toContain("data:");
    });

    it("strips <a> tags with javascript: href", () => {
      const html = '<a href="javascript:alert(1)">click me</a>';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<a");
      expect(result).not.toContain("javascript:");
      // Text content should still be preserved
      expect(result).toContain("click me");
    });
  });

  // ---------------------------------------------------------------
  // 9. Preserves plain text content when tags are stripped
  // ---------------------------------------------------------------
  describe("preserves plain text content", () => {
    it("returns plain text as-is", () => {
      const text = "Just a plain string with no HTML";
      expect(sanitizeHtml(text)).toBe(text);
    });

    it("preserves text content when wrapping dangerous tag is stripped", () => {
      const html = "<script>var x = 1;</script>Hello World";
      const result = sanitizeHtml(html);
      expect(result).toContain("Hello World");
      expect(result).not.toContain("<script");
    });

    it("preserves text content of stripped img alt (img itself is removed)", () => {
      const html = 'before<img src="x.png" alt="image">after';
      const result = sanitizeHtml(html);
      expect(result).not.toContain("<img");
      expect(result).toContain("before");
      expect(result).toContain("after");
    });

    it("preserves text when all tags are disallowed", () => {
      const html = "<h1>Title</h1><h2>Subtitle</h2>";
      const result = sanitizeHtml(html);
      expect(result).toContain("Title");
      expect(result).toContain("Subtitle");
      expect(result).not.toContain("<h1");
      expect(result).not.toContain("<h2");
    });
  });

  // ---------------------------------------------------------------
  // 10. Mixed safe and unsafe content
  // ---------------------------------------------------------------
  describe("handles mixed safe and unsafe content", () => {
    it("keeps safe tags and strips unsafe tags in mixed HTML", () => {
      const html =
        '<div><strong>Safe</strong><script>alert("xss")</script><em>Also safe</em></div>';
      const result = sanitizeHtml(html);
      expect(result).toContain("<strong>Safe</strong>");
      expect(result).toContain("<em>Also safe</em>");
      expect(result).toContain("<div>");
      expect(result).not.toContain("<script");
    });

    it("preserves allowed attributes while stripping disallowed ones on the same element", () => {
      const html =
        '<span class="good" id="bad" style="color:blue" data-x="evil">text</span>';
      const result = sanitizeHtml(html);
      expect(result).toContain('class="good"');
      expect(result).toContain('style="color:blue"');
      expect(result).not.toContain("id=");
      // DOMPurify allows data-* attributes by default, so data-x is kept
      expect(result).toContain("data-x");
      expect(result).toContain("text");
    });

    it("handles a realistic divination card reward text with mixed content", () => {
      const html =
        '<span class="reward"><strong>Exalted Orb</strong></span><script>steal(document.cookie)</script>';
      const result = sanitizeHtml(html);
      expect(result).toContain('<span class="reward">');
      expect(result).toContain("<strong>Exalted Orb</strong>");
      expect(result).not.toContain("<script");
      expect(result).not.toContain("steal");
    });

    it("handles safe tags wrapped around unsafe tags", () => {
      const html = '<p>Hello <iframe src="evil.com">frame</iframe> World</p>';
      const result = sanitizeHtml(html);
      expect(result).toContain("<p>");
      expect(result).toContain("Hello");
      expect(result).toContain("World");
      expect(result).not.toContain("<iframe");
    });

    it("handles multiple levels of mixed nesting", () => {
      const html =
        '<div class="outer"><p><b>Bold</b><img src=x onerror=alert(1)><i>Italic</i></p><form><input></form><small>Footer</small></div>';
      const result = sanitizeHtml(html);
      expect(result).toContain('<div class="outer">');
      expect(result).toContain("<b>Bold</b>");
      expect(result).toContain("<i>Italic</i>");
      expect(result).toContain("<small>Footer</small>");
      expect(result).not.toContain("<img");
      expect(result).not.toContain("<form");
      expect(result).not.toContain("<input");
      expect(result).not.toContain("onerror");
    });
  });
});
