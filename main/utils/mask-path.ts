/**
 * Masks the user-specific portion of a filesystem path by replacing
 * everything between the drive / root and a recognised "anchor" segment
 * with `**`.
 *
 * Anchors are matched case-insensitively against individual path segments.
 * The first anchor that appears (scanning left-to-right) wins, and
 * everything from the root up to (but not including) that segment is
 * collapsed into `<root>/**`.
 *
 * @example
 * // App-data style path — "soothsayer" is the anchor
 * maskPath("C:\\Users\\seb\\AppData\\Roaming\\soothsayer\\soothsayer.db", ["soothsayer"]);
 * // → "C:\\**\\soothsayer\\soothsayer.db"
 *
 * @example
 * // PoE client log — "Path of Exile" is the anchor
 * maskPath("C:\\Program Files (x86)\\Steam\\steamapps\\common\\Path of Exile\\logs\\Client.txt", ["Path of Exile", "Path of Exile 2"]);
 * // → "C:\\**\\Path of Exile\\logs\\Client.txt"
 *
 * @example
 * // Fallback when no anchor matches — keeps last two segments
 * maskPath("/home/seb/.local/share/unknown-app/data.db", ["soothsayer"]);
 * // → "/*&#42;/unknown-app/data.db"
 *
 * @param fullPath  Absolute filesystem path to mask.
 * @param anchors   One or more directory/file names that mark where the
 *                  "public" (non-sensitive) portion of the path begins.
 *                  Matched case-insensitively against individual segments.
 */
export function maskPath(fullPath: string, anchors: string[]): string {
  if (!fullPath || anchors.length === 0) return fullPath;

  const normalized = fullPath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  const sep = fullPath.includes("\\") ? "\\" : "/";

  // For Unix absolute paths parts[0] is "" — keep it as-is so join
  // naturally produces a leading separator (e.g. "" + "/" + "**" → "/**").
  const root = parts[0]; // "C:" on Windows, "" on Unix absolute

  const lowerAnchors = anchors.map((a) => a.toLowerCase());

  // Scan left-to-right for the first segment matching any anchor.
  // Start at index 1 to skip the root segment itself.
  let anchorIndex = -1;
  for (let i = 1; i < parts.length; i++) {
    if (lowerAnchors.includes(parts[i].toLowerCase())) {
      anchorIndex = i;
      break;
    }
  }

  // Only mask when there are segments to hide between root and anchor.
  // e.g. "C:\soothsayer" → anchorIndex 1, nothing between root and anchor.
  if (anchorIndex > 1) {
    const tail = parts.slice(anchorIndex);
    return [root, "**", ...tail].join(sep);
  }

  // Anchor found at index 1 (directly after root) — nothing to mask
  if (anchorIndex === 1) {
    return fullPath;
  }

  // Fallback: no anchor found — keep root + ** + last two segments
  if (parts.length > 3) {
    const tail = parts.slice(-2);
    return [root, "**", ...tail].join(sep);
  }

  return fullPath;
}
