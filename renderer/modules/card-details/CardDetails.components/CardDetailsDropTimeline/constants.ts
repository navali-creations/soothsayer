// ─── Constants ─────────────────────────────────────────────────────────────

/** Height of the main chart area. */
export const CHART_HEIGHT = 220;

/** Height of the overview brush. */
export const OVERVIEW_HEIGHT = 38;

/** Height of the brush. */
export const BRUSH_HEIGHT = 30;

/** Fixed bar width in pixels — bars are always exactly this wide. */
export const BAR_WIDTH = 4;

export const MIN_BRUSH_DATA_POINTS = 5;

export const MIN_ZOOM_WINDOW = 5;

export const ZOOM_STEP = 3;

export const MIN_LEAGUE_MARKER_DOMAIN_PADDING_MS = 24 * 60 * 60 * 1000;

export const LEAGUE_MARKER_DOMAIN_PADDING_RATIO = 0.03;

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export const LEAGUE_VIEW_MARKER_PADDING_MS = ONE_DAY_MS;

export const LEADING_BOUNDARY_GAP_OFFSET_MS = 3 * ONE_DAY_MS;

export const TRAILING_BOUNDARY_GAP_OFFSET_MS = 2 * ONE_DAY_MS;

export const BOUNDARY_GAP_MATCH_TOLERANCE_MS = 60 * 1000;

/**
 * Minimum inactivity gap (ms) between consecutive real points
 * to insert a zigzag break marker.
 */
export const MIN_GAP_FOR_BREAK_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
