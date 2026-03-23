import DOMPurify from "dompurify";

/**
 * Allowed HTML tags for divination card reward/flavour text.
 * Only safe formatting tags are permitted — no scripts, iframes, forms, etc.
 */
const ALLOWED_TAGS = [
  "span",
  "br",
  "em",
  "strong",
  "b",
  "i",
  "u",
  "div",
  "p",
  "small",
  "sub",
  "sup",
];

/**
 * Allowed HTML attributes — only class and style for visual formatting.
 */
const ALLOWED_ATTR = ["class", "style"];

/**
 * Sanitize HTML string for safe use with `dangerouslySetInnerHTML`.
 *
 * Strips all potentially dangerous tags (`<script>`, `<img onerror=...>`,
 * `<svg onload=...>`, etc.) while preserving safe formatting tags used in
 * divination card reward and flavour text.
 *
 * @param dirty - The untrusted HTML string to sanitize
 * @returns A sanitized HTML string safe for rendering
 */
export function sanitizeHtml(dirty: string): string {
  if (!dirty) return "";

  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
  });
}
