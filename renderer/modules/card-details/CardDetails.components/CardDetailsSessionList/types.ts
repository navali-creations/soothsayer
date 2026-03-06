// ─── Sort Types ────────────────────────────────────────────────────────────
// These types are shared between the main process (repository/service)
// and the renderer (UI components).

/** Sortable columns for the card details session list. */
export type SessionSortColumn =
  | "date"
  | "league"
  | "found"
  | "duration"
  | "decks";

/** Sort direction. */
export type SessionSortDirection = "asc" | "desc";

/** Combined sort state for the session list. */
export interface SessionSortState {
  column: SessionSortColumn;
  direction: SessionSortDirection;
}
