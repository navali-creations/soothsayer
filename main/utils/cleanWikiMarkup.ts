/**
 * Clean wiki markup from HTML strings.
 * Removes patterns like [[File:...]], [[...|...]], and specific hoverbox spans.
 *
 * @security This function is a **cosmetic text cleaner**, NOT a security
 * sanitizer. It does not strip `<script>` tags, event handlers, or other
 * XSS vectors. All output from this function MUST be passed through
 * DOMPurify (or equivalent) before being rendered via `dangerouslySetInnerHTML`.
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
      // Remove empty hoverbox__display spans (content was wiki markup that got removed above)
      .replace(
        /<span\s+class="hoverbox__display\s+c-item-hoverbox__display"\s*><\/span>/g,
        "",
      )
      // Unwrap hoverbox__activator spans, keeping their content
      .replace(
        /<span\s+class="hoverbox__activator\s+c-item-hoverbox__activator"\s*>(.*?)<\/span>/g,
        "$1",
      )
      // Unwrap hoverbox container spans, keeping their content
      .replace(
        /<span\s+class="hoverbox\s+c-item-hoverbox"\s*>(.*?)<\/span>/g,
        "$1",
      )
      // Clean up any double spaces or extra whitespace created by removals
      .replace(/\s+/g, " ")
      .trim()
  );
}
