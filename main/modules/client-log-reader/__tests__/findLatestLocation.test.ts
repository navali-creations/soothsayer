import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { findLatestLocation } from "../utils/findLatestLocation";

describe("findLatestLocation", () => {
  let directory: string;

  beforeEach(() => {
    directory = fs.mkdtempSync(path.join(os.tmpdir(), "soothsayer-location-"));
  });

  afterEach(() => {
    fs.rmSync(directory, { recursive: true, force: true });
  });

  function writeLog(content: string): string {
    const filePath = path.join(directory, "Client.txt");
    fs.writeFileSync(filePath, content, "utf8");
    return filePath;
  }

  it("returns the newest valid location", () => {
    const filePath = writeLog(
      [
        "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.",
        "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}",
        "2026/03/14 10:27:00 249522782 cffb06dd [INFO Client 21244] : You have entered The Rogue Harbour.",
      ].join("\n"),
    );

    expect(findLatestLocation(filePath)).toBe("The Rogue Harbour");
  });

  it("parses a location when the log has no trailing newline", () => {
    const filePath = writeLog(
      "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.",
    );

    expect(findLatestLocation(filePath)).toBe("Atlas Hideout");
  });

  it("handles UTF-8 locations across a read-buffer boundary", () => {
    const latest =
      "2026/03/14 10:27:00 249522782 cffb06dd [INFO Client 21244] : You have entered Karui Shores — Épilogue.";
    const paddingLength = 64 * 1024 - Buffer.byteLength(latest, "utf8") + 2;
    const filePath = writeLog(`${"x".repeat(paddingLength)}\n${latest}\n`);

    expect(findLatestLocation(filePath)).toBe("Karui Shores — Épilogue");
  });

  it("scans beyond the previous 8 MiB cutoff", () => {
    const location =
      "2026/03/14 10:21:55 249265968 cffb06dd [INFO Client 21244] : You have entered Atlas Hideout.";
    const filePath = writeLog(
      `${location}\n${"x".repeat(8 * 1024 * 1024 + 64 * 1024)}\n`,
    );

    expect(findLatestLocation(filePath)).toBe("Atlas Hideout");
  });

  it("returns null for missing files and logs without a location", () => {
    expect(findLatestLocation(path.join(directory, "missing.txt"))).toBeNull();
    expect(findLatestLocation(writeLog(""))).toBeNull();
    expect(findLatestLocation(writeLog("\n"))).toBeNull();
    expect(
      findLatestLocation(
        writeLog(
          "2026/03/14 10:26:12 249522781 cffb06dd [INFO Client 21244] : Card drawn from the deck: <divination>{The Scholar}",
        ),
      ),
    ).toBeNull();
  });
});
