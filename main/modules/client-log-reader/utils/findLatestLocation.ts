import fs from "node:fs";

import { parseLocationLine } from "./parseCards";

const READ_BUFFER_SIZE = 64 * 1024;
const MAX_LOG_LINE_LENGTH = 4 * 1024;

/**
 * Scans Client.txt backwards and stops as soon as the most recent valid
 * location record is found. Memory use stays bounded even for very large log
 * files.
 */
export function findLatestLocation(filePath: string): string | null {
  let fd: number | null = null;

  try {
    fd = fs.openSync(filePath, "r");
    let position = fs.fstatSync(fd).size;
    let leadingFragment = Buffer.alloc(0);

    while (position > 0) {
      const bytesToRead = Math.min(READ_BUFFER_SIZE, position);
      position -= bytesToRead;

      const buffer = Buffer.allocUnsafe(bytesToRead);
      const bytesRead = fs.readSync(fd, buffer, 0, bytesToRead, position);
      const bytes = Buffer.concat([
        buffer.subarray(0, bytesRead),
        leadingFragment,
      ]);
      const lines: Buffer[] = [];
      let lineEnd = bytes.length;
      for (let index = bytes.length - 1; index >= 0; index--) {
        if (bytes[index] !== 0x0a) continue;
        lines.push(bytes.subarray(index + 1, lineEnd));
        lineEnd = index;
      }

      leadingFragment = bytes.subarray(0, lineEnd);
      if (leadingFragment.length > MAX_LOG_LINE_LENGTH) {
        leadingFragment = leadingFragment.subarray(
          leadingFragment.length - MAX_LOG_LINE_LENGTH,
        );
      }

      for (const line of lines) {
        const location = parseLocationLine(line.toString("utf8"));
        if (location) return location;
      }

      if (position === 0 && leadingFragment.length > 0) {
        return parseLocationLine(leadingFragment.toString("utf8"));
      }
    }

    return null;
  } catch {
    return null;
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch {
        // The descriptor may already have become invalid after log rotation.
      }
    }
  }
}
