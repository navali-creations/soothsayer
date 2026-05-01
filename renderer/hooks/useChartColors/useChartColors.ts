import { useCallback, useLayoutEffect, useState } from "react";

/**
 * Resolved theme colors for canvas and SVG chart rendering.
 *
 * SVG `fill` and `stroke` attributes cannot process CSS custom property
 * functions like `oklch(var(...))` or `color-mix(...)` — they need actual
 * color values. This hook reads the computed DaisyUI v5 CSS variables
 * (`--color-base-content`, `--color-primary`, etc.) from the DOM and
 * converts them into usable color strings with various opacity levels.
 *
 * DaisyUI v5 stores full color values (e.g. `#e9ddf0`) rather than raw
 * oklch components, so we parse them into RGBA-compatible strings.
 *
 * Re-resolves automatically when the theme changes (observed via
 * MutationObserver on `<html>` attributes).
 */

export interface ChartColors {
  // ─── Base content (text / tick labels / grid lines) ──────────────
  /** Base content at full opacity */
  bc100: string;
  /** Base content at 50% — secondary text */
  bc50: string;
  /** Base content at 40% — tick labels */
  bc40: string;
  /** Base content at 35% — tick labels (charts) */
  bc35: string;
  /** Base content at 30% — axis label text */
  bc30: string;
  /** Base content at 20% — very subtle elements */
  bc20: string;
  /** Base content at 15% — volume axis ticks */
  bc15: string;
  /** Base content at 12% — brush outline */
  bc12: string;
  /** Base content at 10% — axis strokes */
  bc10: string;
  /** Base content at 8% — grid lines */
  bc08: string;
  /** Base content at 7% — volume bars */
  bc07: string;
  /** Base content at 6% — subtle grid */
  bc06: string;
  /** Base content at 5% — very subtle strokes */
  bc05: string;

  // ─── Primary color ───────────────────────────────────────────────
  /** Primary at full opacity */
  primary: string;
  /** Primary at 60% — bar fills */
  primary60: string;
  /** Primary at 30% — gradient start */
  primary30: string;
  /** Primary at 15% — area fill */
  primary15: string;
  /** Primary at 8% — brush slide */
  primary08: string;
  /** Primary at 2% — gradient end */
  primary02: string;

  // ─── Base backgrounds ────────────────────────────────────────────
  /** Base-100 — deepest background */
  b1: string;
  /** Base-200 — card backgrounds */
  b2: string;
  /** Base-300 — elevated surfaces */
  b3: string;

  // ─── Semantic colors ───────────────────────────────────────────────
  /** Success at full opacity */
  success: string;
  /** Success at 50% — stroke for confidence bands */
  success50: string;
  /** Success at 30% — gradient start for optimistic band */
  success30: string;
  /** Success at 5% — gradient end */
  success05: string;
  /** Info at full opacity */
  info: string;
  /** Info at 80% — expected line gradient start */
  info80: string;
  /** Info at 30% — expected line gradient end */
  info30: string;
  /** Warning at full opacity */
  warning: string;
  /** Warning at 50% — pessimistic line stroke */
  warning50: string;

  /** Secondary at full opacity */
  secondary: string;
  /** Secondary at 60% */
  secondary60: string;
  /** Secondary at 30% */
  secondary30: string;
}

/**
 * Parse any CSS color value into an [r, g, b] tuple (0–255) by leveraging
 * a temporary canvas context. This handles hex, rgb(), oklch(), hsl(), etc.
 */
function parseColor(cssColor: string): [number, number, number] {
  const trimmed = cssColor.trim();
  if (!trimmed) return [255, 255, 255]; // fallback to white

  // Use an off-screen canvas to resolve any CSS color format
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return [255, 255, 255];

    ctx.clearRect(0, 0, 1, 1);
    ctx.fillStyle = trimmed;
    ctx.fillRect(0, 0, 1, 1);
    const imageData = ctx.getImageData(0, 0, 1, 1).data;
    return [imageData[0], imageData[1], imageData[2]];
  } catch {
    return [255, 255, 255];
  }
}

function rgba(rgb: [number, number, number], alpha?: number): string {
  const [r, g, b] = rgb;
  if (alpha !== undefined && alpha < 1) {
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }
  return `rgb(${r}, ${g}, ${b})`;
}

function readColors(): ChartColors {
  const style = getComputedStyle(document.documentElement);

  // DaisyUI v5 variable names
  const bcRaw = style.getPropertyValue("--color-base-content");
  const pRaw = style.getPropertyValue("--color-primary");
  const b1Raw = style.getPropertyValue("--color-base-100");
  const b2Raw = style.getPropertyValue("--color-base-200");
  const b3Raw = style.getPropertyValue("--color-base-300");
  const suRaw = style.getPropertyValue("--color-success");
  const inRaw = style.getPropertyValue("--color-info");
  const waRaw = style.getPropertyValue("--color-warning");
  const seRaw = style.getPropertyValue("--color-secondary");

  // Parse into RGB tuples
  const bc = parseColor(bcRaw);
  const p = parseColor(pRaw);
  const b1 = parseColor(b1Raw);
  const b2 = parseColor(b2Raw);
  const b3 = parseColor(b3Raw);
  const su = parseColor(suRaw);
  const inf = parseColor(inRaw);
  const wa = parseColor(waRaw);
  const se = parseColor(seRaw);

  return {
    // Base content at various opacities
    bc100: rgba(bc),
    bc50: rgba(bc, 0.5),
    bc40: rgba(bc, 0.4),
    bc35: rgba(bc, 0.35),
    bc30: rgba(bc, 0.3),
    bc20: rgba(bc, 0.2),
    bc15: rgba(bc, 0.15),
    bc12: rgba(bc, 0.12),
    bc10: rgba(bc, 0.1),
    bc08: rgba(bc, 0.08),
    bc07: rgba(bc, 0.07),
    bc06: rgba(bc, 0.06),
    bc05: rgba(bc, 0.05),

    // Primary
    primary: rgba(p),
    primary60: rgba(p, 0.6),
    primary30: rgba(p, 0.3),
    primary15: rgba(p, 0.15),
    primary08: rgba(p, 0.08),
    primary02: rgba(p, 0.02),

    // Backgrounds
    b1: rgba(b1),
    b2: rgba(b2),
    b3: rgba(b3),

    // Semantic
    success: rgba(su),
    success50: rgba(su, 0.5),
    success30: rgba(su, 0.3),
    success05: rgba(su, 0.05),
    info: rgba(inf),
    info80: rgba(inf, 0.8),
    info30: rgba(inf, 0.3),
    warning: rgba(wa),
    warning50: rgba(wa, 0.5),

    secondary: rgba(se),
    secondary60: rgba(se, 0.6),
    secondary30: rgba(se, 0.3),
  };
}

export function useChartColors(): ChartColors {
  const [colors, setColors] = useState<ChartColors>(readColors);

  const refresh = useCallback(() => {
    setColors(readColors());
  }, []);

  useLayoutEffect(() => {
    // Re-read when theme changes. DaisyUI applies theme via data-theme
    // attribute on <html>, so we watch for attribute mutations.
    const observer = new MutationObserver(() => {
      // Small delay to let CSS variables settle after attribute change
      requestAnimationFrame(refresh);
    });

    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme", "class"],
    });

    return () => observer.disconnect();
  }, [refresh]);

  return colors;
}
