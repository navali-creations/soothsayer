// Re-exports card visual assets.
// All renderer components should import from here — never directly from
// the @navali/poe1-divination-cards package paths.

// Static images (frame & separator) — kept eager since they're always needed
export { default as cardFrame } from "@navali/poe1-divination-cards/data/Divination_card_frame.png";
export { default as cardSeparator } from "@navali/poe1-divination-cards/data/Divination_card_separator.png";

// Card art glob — lazy loaded on demand instead of eagerly importing ~464 modules at startup.
const cardImageLoaders = import.meta.glob<{ default: string }>(
  "/node_modules/@navali/poe1-divination-cards/data/images/*.png",
);

// Pre-build a Map<filename, loader> at module load time for O(1) lookup.
const loaderMap = new Map<string, () => Promise<{ default: string }>>();
for (const [key, loader] of Object.entries(cardImageLoaders)) {
  const filename = key.split("/").pop()!;
  loaderMap.set(filename, loader);
}

// In-memory cache of already-resolved image URLs.
const cache = new Map<string, string>();

/**
 * Get the URL for a card image. Returns the cached URL if available,
 * otherwise returns empty string. Use `loadCardImage` to trigger loading.
 */
export function getCardImage(artSrc: string): string {
  return cache.get(artSrc) ?? "";
}

/**
 * Load a card image asynchronously and cache the result.
 * Returns the image URL, or empty string if the image doesn't exist.
 */
export async function loadCardImage(artSrc: string): Promise<string> {
  if (cache.has(artSrc)) return cache.get(artSrc)!;
  const loader = loaderMap.get(artSrc);
  if (!loader) return "";
  const mod = await loader();
  const url = mod.default ?? "";
  cache.set(artSrc, url);
  return url;
}
