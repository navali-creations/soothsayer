import { existsSync } from "node:fs";
import { join, resolve } from "node:path";

/**
 * Maximum number of parent directories to traverse when searching for
 * the project root.  Five levels is more than enough for the deepest
 * Forge/Vite build output (`.vite/build/`  →  project root is 2 up).
 */
const MAX_WALK_DEPTH = 5;

/**
 * Resolve an individual file that should exist somewhere above `startPath`.
 *
 * This is a convenience wrapper around a parent-directory walk that looks
 * for a specific **file** (as opposed to a directory marker).  Useful for
 * one-off assets like `CHANGELOG.md` that live at the project root but
 * aren't inside a predictable subdirectory.
 *
 * @param startPath  The initial path — typically `app.getAppPath()`.
 * @param filePath   The relative file path to search for, e.g.
 *                   `"CHANGELOG.md"` or `"renderer/assets/audio/drop.wav"`.
 * @returns The absolute path to the file if found, otherwise
 *          `join(startPath, filePath)` as a fallback.
 *
 * @example
 * ```ts
 * const changelog = resolveDevFile(app.getAppPath(), "CHANGELOG.md");
 * const content   = readFileSync(changelog, "utf-8");
 * ```
 */
export function resolveDevFile(startPath: string, filePath: string): string {
  const direct = join(startPath, filePath);
  if (existsSync(direct)) return direct;

  let candidate = startPath;
  for (let i = 0; i < MAX_WALK_DEPTH; i++) {
    const parent = resolve(candidate, "..");
    if (parent === candidate) break; // filesystem root
    candidate = parent;
    const attempt = join(candidate, filePath);
    if (existsSync(attempt)) return attempt;
  }

  // Fall back so the caller gets a clear ENOENT with the original path
  return direct;
}
