import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

/**
 * Resolve a file from the @navali/poe1-divination-cards package.
 *
 * In development: uses require.resolve to find the package in node_modules.
 * In production (packaged): uses process.resourcesPath (files copied by
 * extraResource).
 */
/** Cached data directory path for dev mode — resolved once, reused thereafter. */
let _cachedDevDataDir: string | undefined;

export function resolvePoe1DataPath(
  relativePath: string,
  isPackaged: boolean,
  resourcesPath?: string,
): string {
  // Guard against path traversal
  if (
    /(?:^|[\\/])\.\.(?:[\\/]|$)/.test(relativePath) ||
    /^[\\/]/.test(relativePath)
  ) {
    throw new Error(`Invalid relative path: ${relativePath}`);
  }

  if (isPackaged && resourcesPath) {
    return join(resourcesPath, "poe1", relativePath);
  }

  // Development: locate the package via require.resolve (cached)
  if (!_cachedDevDataDir) {
    // NOTE: Use __filename instead of import.meta.url because Vite bundles
    // the main process as CJS (format: "cjs"), where import.meta becomes {}
    // and import.meta.url is undefined.
    const require = createRequire(__filename);
    // Resolve through the package's exported ./data/* path — ./package.json
    // is not in the exports map and would throw ERR_PACKAGE_PATH_NOT_EXPORTED.
    const cardsJson = require.resolve(
      "@navali/poe1-divination-cards/data/cards.json",
    );
    _cachedDevDataDir = dirname(cardsJson); // …/poe1-divination-cards/data
  }
  return join(_cachedDevDataDir, relativePath);
}

/**
 * Resolve the cards JSON path for a specific league.
 *
 * Tries `cards-<league>.json` first. Falls back to `cards.json` (the
 * full card set) if no league-specific file exists.
 */
export function resolvePoe1CardsJsonPath(
  league: string,
  isPackaged: boolean,
  resourcesPath?: string,
): string {
  // Guard against path traversal via league name
  if (/[/\\]/.test(league) || league.includes("..")) {
    throw new Error(`Invalid league name: ${league}`);
  }

  const leagueSpecific = resolvePoe1DataPath(
    `cards-${league}.json`,
    isPackaged,
    resourcesPath,
  );
  if (existsSync(leagueSpecific)) {
    return leagueSpecific;
  }
  // Fallback to the full card set
  return resolvePoe1DataPath("cards.json", isPackaged, resourcesPath);
}
