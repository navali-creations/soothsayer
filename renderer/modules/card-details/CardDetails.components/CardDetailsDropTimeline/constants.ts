// ─── Constants ─────────────────────────────────────────────────────────────

/** Approximate league duration when only start_date is known (4 months). */
export const DEFAULT_LEAGUE_DURATION_MS = 4 * 30 * 24 * 60 * 60 * 1000;

/** Height of the main chart area. */
export const CHART_HEIGHT = 220;

/** Height of the overview chart (bars + line + brush). */
export const OVERVIEW_HEIGHT = 80;

/** Height of the brush. */
export const BRUSH_HEIGHT = 30;

/** Fixed bar width in pixels — bars are always exactly this wide. */
export const BAR_WIDTH = 4;

/** Unique IDs for SVG gradient definitions used in the main chart. */
export const GRADIENT_ID_BAR = "dropTimelineBarGradient";
export const GRADIENT_ID_AREA = "dropTimelineAreaGradient";

/**
 * Minimum gap (ms) between the end of one league and the start of the next
 * to insert a zigzag break marker.
 */
export const MIN_GAP_FOR_BREAK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
