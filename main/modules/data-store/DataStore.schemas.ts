// Simple card entry (for league and all-time stats)
type SimpleCardEntry = {
  count: number;
};

// Simple divination card stats (no processedIds)
type SimpleDivinationCardStats = {
  totalCount: number;
  cards: Record<string, SimpleCardEntry>;
  lastUpdated?: string;
};

export type { SimpleDivinationCardStats };
