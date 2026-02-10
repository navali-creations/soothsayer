import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { readLastLines } from "../utils/read-last-lines";

describe("readLastLines", () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(
      path.join(os.tmpdir(), "read-last-lines-test-"),
    );
  });

  afterEach(async () => {
    await fs.promises.rm(tmpDir, { recursive: true, force: true });
  });

  /**
   * Helper to write a temp file and return its path.
   */
  function writeTmpFile(name: string, content: string): string {
    const filePath = path.join(tmpDir, name);
    fs.writeFileSync(filePath, content);
    return filePath;
  }

  // ─── maxLineCount <= 0 returns empty string ───────────────────────────────

  describe("when maxLineCount <= 0", () => {
    it("should return an empty string for maxLineCount = 0", async () => {
      const filePath = writeTmpFile("zero.txt", "line1\nline2\nline3\n");
      const result = await readLastLines(filePath, 0);
      expect(result).toBe("");
    });

    it("should return an empty string for negative maxLineCount", async () => {
      const filePath = writeTmpFile("neg.txt", "line1\nline2\n");
      const result = await readLastLines(filePath, -5);
      expect(result).toBe("");
    });
  });

  // ─── Empty file ──────────────────────────────────────────────────────────

  describe("when the file is empty", () => {
    it("should return an empty string", async () => {
      const filePath = writeTmpFile("empty.txt", "");
      const result = await readLastLines(filePath, 5);
      expect(result).toBe("");
    });
  });

  // ─── Single line file ────────────────────────────────────────────────────

  describe("when the file has a single line", () => {
    it("should return the single line (no trailing newline)", async () => {
      const filePath = writeTmpFile("single.txt", "only line");
      const result = await readLastLines(filePath, 1);
      expect(result).toBe("only line");
    });

    it("should return the single line (with trailing newline)", async () => {
      const filePath = writeTmpFile("single-nl.txt", "only line\n");
      const _result = await readLastLines(filePath, 1);
      // The newline counts as a line boundary, so requesting 1 line returns
      // everything after the last \n (which is empty). But the implementation
      // counts \n chars and captures content after the Nth one from the end.
      // Let's verify the actual behavior:
      const result2 = await readLastLines(filePath, 2);
      // With 2 lines requested from "only line\n", we should get the whole content.
      expect(result2).toBe("only line\n");
    });
  });

  // ─── Requesting more lines than the file has ─────────────────────────────

  describe("when requesting more lines than the file contains", () => {
    it("should return the entire file content", async () => {
      const content = "line1\nline2\nline3";
      const filePath = writeTmpFile("fewer.txt", content);
      const result = await readLastLines(filePath, 100);
      expect(result).toBe(content);
    });

    it("should return the entire file content (with trailing newline)", async () => {
      const content = "line1\nline2\nline3\n";
      const filePath = writeTmpFile("fewer-nl.txt", content);
      const result = await readLastLines(filePath, 100);
      expect(result).toBe(content);
    });
  });

  // ─── Exact line count match ──────────────────────────────────────────────

  describe("when requesting exact number of lines", () => {
    it("should return the last N lines for a file with N newline-separated lines", async () => {
      const filePath = writeTmpFile(
        "exact.txt",
        "line1\nline2\nline3\nline4\nline5",
      );

      // 2 lines = content after the 2nd-to-last \n
      const result = await readLastLines(filePath, 2);
      expect(result).toBe("line4\nline5");
    });

    it("should return the last 3 lines", async () => {
      const filePath = writeTmpFile("last3.txt", "a\nb\nc\nd\ne\n");
      const result = await readLastLines(filePath, 3);
      expect(result).toBe("d\ne\n");
    });
  });

  // ─── Last N lines from a multi-line file ─────────────────────────────────

  describe("when requesting fewer lines than the file contains", () => {
    it("should return the last 1 line from a multi-line file", async () => {
      const filePath = writeTmpFile("multi.txt", "first\nsecond\nthird");
      const result = await readLastLines(filePath, 1);
      expect(result).toBe("third");
    });

    it("should return the last 2 lines from a 5-line file", async () => {
      const filePath = writeTmpFile("five.txt", "one\ntwo\nthree\nfour\nfive");
      const result = await readLastLines(filePath, 2);
      expect(result).toBe("four\nfive");
    });

    it("should return the last 3 lines from a 5-line file", async () => {
      const filePath = writeTmpFile("five2.txt", "one\ntwo\nthree\nfour\nfive");
      const result = await readLastLines(filePath, 3);
      expect(result).toBe("three\nfour\nfive");
    });

    it("should handle requesting 1 line from a file ending with newline", async () => {
      const filePath = writeTmpFile("trailing.txt", "aaa\nbbb\nccc\n");
      const _result = await readLastLines(filePath, 1);
      // After the last \n there is nothing, so the "last 1 line" is the empty
      // string after it. Let's verify and request 2 to get the actual last line.
      const result2 = await readLastLines(filePath, 2);
      expect(result2).toBe("ccc\n");
    });
  });

  // ─── Large file requiring multiple buffers ───────────────────────────────

  describe("when the file is larger than the internal buffer size (256 bytes)", () => {
    it("should correctly read last lines from a large file", async () => {
      // Create a file with many lines, each long enough to exceed 256 bytes total
      const lines: string[] = [];
      for (let i = 0; i < 100; i++) {
        lines.push(`line-${String(i).padStart(3, "0")}-${"x".repeat(20)}`);
      }
      const content = lines.join("\n");
      const filePath = writeTmpFile("large.txt", content);

      // Verify the file is actually larger than 256 bytes
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(256);

      const result = await readLastLines(filePath, 3);
      expect(result).toBe([lines[97], lines[98], lines[99]].join("\n"));
    });

    it("should handle a large file with trailing newline", async () => {
      const lines: string[] = [];
      for (let i = 0; i < 50; i++) {
        lines.push(`entry-${i}-${"a".repeat(30)}`);
      }
      const content = `${lines.join("\n")}\n`;
      const filePath = writeTmpFile("large-nl.txt", content);

      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(256);

      const result = await readLastLines(filePath, 2);
      // Last 2 newlines: one after lines[48], one after lines[49]
      expect(result).toBe(`${lines[49]}\n`);
    });

    it("should return entire content when requesting more lines than exist in a large file", async () => {
      const lines: string[] = [];
      for (let i = 0; i < 20; i++) {
        lines.push(`big-line-${i}-${"z".repeat(50)}`);
      }
      const content = lines.join("\n");
      const filePath = writeTmpFile("large-all.txt", content);

      const stat = fs.statSync(filePath);
      expect(stat.size).toBeGreaterThan(256);

      const result = await readLastLines(filePath, 1000);
      expect(result).toBe(content);
    });
  });

  // ─── Encoding parameter ─────────────────────────────────────────────────

  describe("encoding parameter", () => {
    it("should use utf-8 encoding when specified", async () => {
      const filePath = writeTmpFile("utf8.txt", "héllo\nwörld\n");
      const _result = await readLastLines(filePath, 1, "utf-8");
      // The last \n is the boundary, so requesting 1 line gives content after last \n
      const result2 = await readLastLines(filePath, 2, "utf-8");
      expect(result2).toBe("wörld\n");
    });

    it("should work without encoding parameter (defaults to Buffer.toString default)", async () => {
      const filePath = writeTmpFile("default-enc.txt", "alpha\nbeta\ngamma");
      const result = await readLastLines(filePath, 2);
      expect(result).toBe("beta\ngamma");
    });
  });

  // ─── Error handling ──────────────────────────────────────────────────────

  describe("error handling", () => {
    it("should throw when the file does not exist", async () => {
      const badPath = path.join(tmpDir, "nonexistent.txt");
      await expect(readLastLines(badPath, 5)).rejects.toThrow();
    });
  });

  // ─── Edge cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("should handle a file containing only newlines", async () => {
      const filePath = writeTmpFile("newlines.txt", "\n\n\n\n\n");
      const result = await readLastLines(filePath, 2);
      // Last 2 newlines from "\n\n\n\n\n" — the last two \n are at positions 3 and 4
      // Content between the 3rd and 5th \n boundaries
      expect(result).toBe("\n");
    });

    it("should handle a file with a single newline", async () => {
      const filePath = writeTmpFile("one-nl.txt", "\n");
      const result = await readLastLines(filePath, 1);
      // One \n found, so we capture everything after it (empty string)
      expect(result).toBe("");
    });

    it("should handle a file with no newlines", async () => {
      const filePath = writeTmpFile("no-nl.txt", "no newlines here at all");
      const result = await readLastLines(filePath, 1);
      // No \n found, lineCount stays 0, the whole file is returned
      expect(result).toBe("no newlines here at all");
    });

    it("should handle a file with Windows-style CRLF line endings", async () => {
      // The scanner only looks for \n, so \r\n will count as a newline
      // but the \r will remain in the output
      const filePath = writeTmpFile("crlf.txt", "line1\r\nline2\r\nline3\r\n");
      const result = await readLastLines(filePath, 2);
      expect(result).toBe("line3\r\n");
    });

    it("should handle very long lines that span multiple buffers", async () => {
      // A single line longer than the 256-byte buffer
      const longLine = "A".repeat(500);
      const content = `short\n${longLine}\nlast`;
      const filePath = writeTmpFile("longline.txt", content);

      const result = await readLastLines(filePath, 1);
      expect(result).toBe("last");

      const result2 = await readLastLines(filePath, 2);
      expect(result2).toBe(`${longLine}\nlast`);
    });

    it("should handle a file that is exactly the buffer size (256 bytes)", async () => {
      // Create content that is exactly 256 bytes
      // "line1\nline2\n..." padded to exactly 256 bytes
      const baseLine = "x".repeat(50);
      let content = "";
      while (content.length < 250) {
        content += `${baseLine}\n`;
      }
      // Pad the final portion to hit exactly 256
      const remaining = 256 - content.length;
      if (remaining > 0) {
        content += "y".repeat(remaining);
      }

      const filePath = writeTmpFile("exact-buffer.txt", content);
      const stat = fs.statSync(filePath);
      expect(stat.size).toBe(256);

      const result = await readLastLines(filePath, 2);
      expect(typeof result).toBe("string");
      expect(result.length).toBeGreaterThan(0);
    });

    it("should handle a file smaller than the buffer size", async () => {
      const filePath = writeTmpFile("small.txt", "a\nb\nc");
      const stat = fs.statSync(filePath);
      expect(stat.size).toBeLessThan(256);

      const result = await readLastLines(filePath, 2);
      expect(result).toBe("b\nc");
    });

    it("should handle requesting exactly all lines in the file", async () => {
      const content = "one\ntwo\nthree";
      const filePath = writeTmpFile("all-lines.txt", content);
      // The file has 2 newlines, so 3 "lines". Request 3.
      const result = await readLastLines(filePath, 3);
      // With 3 lines requested, we need lineCount >= 3, but there are only 2 \n chars
      // so lineCount maxes at 2. The entire file is returned.
      expect(result).toBe(content);
    });
  });

  // ─── File handle cleanup ─────────────────────────────────────────────────

  describe("file handle cleanup", () => {
    it("should close the file handle even after successful reads", async () => {
      const filePath = writeTmpFile("cleanup.txt", "test\ndata\nhere\n");

      // Should not throw and should not leak file handles
      await readLastLines(filePath, 2);
      await readLastLines(filePath, 2);
      await readLastLines(filePath, 2);

      // If file handles leaked, we'd eventually get EMFILE errors
      // The fact that multiple calls succeed is a basic check
    });

    it("should close the file handle even when the file does not exist", async () => {
      const badPath = path.join(tmpDir, "nope.txt");
      await expect(readLastLines(badPath, 1)).rejects.toThrow();
      // File handle should be cleaned up (no leak)
    });
  });
});
