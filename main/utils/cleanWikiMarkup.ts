/**
 * Clean wiki markup from HTML strings
 * Removes patterns like [[File:...]] and [[...]]
 */
export function cleanWikiMarkup(html: string | null | undefined): string {
  if (!html) return "";

  return (
    html
      // Remove [[File: ... ]] image references (both small and large versions)
      .replace(/\[\[File:[^\]]+\]\]/g, "")
      // Remove [[ItemName|ItemName]] patterns, keeping only the display text
      .replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, "$2")
      // Remove any remaining [[...]] brackets
      .replace(/\[\[([^\]]+)\]\]/g, "$1")
      // Clean up any double spaces or extra whitespace created by removals
      .replace(/\s+/g, " ")
      .trim()
  );
}
