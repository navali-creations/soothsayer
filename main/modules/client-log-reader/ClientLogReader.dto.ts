export interface HistoricalContextBackfillResult {
  status: "already-completed" | "completed" | "deferred";
  enrichedEvents: number;
}
