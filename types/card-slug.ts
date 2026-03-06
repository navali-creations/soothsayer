/**
 * Shared card-slug utility.
 *
 * This is the **single source of truth** for converting a divination card
 * display name into a URL-friendly slug.  Both the main process and the
 * renderer must import from here so the slug logic can never diverge.
 *
 * Used for:
 * - Renderer route params (`/cards/$cardSlug`)
 * - Main-process slug → card resolution (`resolveCardBySlug`)
 * - poe.ninja `detailsId` derivation
 *
 * Examples:
 * - "House of Mirrors" → "house-of-mirrors"
 * - "The King's Heart" → "the-king-s-heart"
 * - "The Doctor"       → "the-doctor"
 * - "A Chilling Wind"  → "a-chilling-wind"
 * - "1000 Ribbons"     → "1000-ribbons"
 */
export function cardNameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
