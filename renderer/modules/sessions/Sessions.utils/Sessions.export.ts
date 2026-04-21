import type { SessionSummary } from "~/main/modules/sessions";

/**
 * Generate a rich CSV with full session metadata.
 *
 * Columns: Session Date, League, Duration (min), Decks Opened,
 *          Exchange Value (chaos), Stash Value (chaos),
 *          Net Profit (chaos), Chaos/Divine Ratio, Stacked Deck Cost (chaos)
 */
export function generateRichCsv(sessions: SessionSummary[]): string {
  const header =
    "Session Date,League,Duration (min),Decks Opened,Exchange Value (chaos),Stash Value (chaos),Net Profit (chaos),Chaos/Divine Ratio,Stacked Deck Cost (chaos)\n";

  const rows = sessions
    .map((s) => {
      const date = escapeCsvField(s.startedAt ?? "");
      const league = escapeCsvField(s.league ?? "");
      const duration = s.durationMinutes ?? "N/A";
      const decks = s.totalDecksOpened ?? 0;
      const exchangeValue = formatNum(s.totalExchangeValue);
      const stashValue = formatNum(s.totalStashValue);
      const netProfit = formatNum(s.totalExchangeNetProfit);
      const chaosRatio = formatNum(s.exchangeChaosToDivine);
      const deckCost = formatNum(s.stackedDeckChaosCost);

      return `${date},${league},${duration},${decks},${exchangeValue},${stashValue},${netProfit},${chaosRatio},${deckCost}`;
    })
    .join("\n");

  return header + rows;
}

/**
 * Generate a simple CSV aggregating card drops across sessions.
 *
 * Columns: Card Name, Amount
 */
export function generateSimpleCsv(cardDrops: Record<string, number>): string {
  const header = "name,amount\n";

  const rows = Object.entries(cardDrops)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, amount]) => `${escapeCsvField(name)},${amount}`)
    .join("\n");

  return header + rows;
}

function formatNum(value: number | null | undefined): string {
  if (value == null) return "N/A";
  return String(Math.round(value * 100) / 100);
}

function escapeCsvField(value: string): string {
  const sanitized = neutralizeFormulaCell(value);
  if (
    sanitized.includes(",") ||
    sanitized.includes('"') ||
    sanitized.includes("\n")
  ) {
    return `"${sanitized.replace(/"/g, '""')}"`;
  }
  return sanitized;
}

function neutralizeFormulaCell(value: string): string {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}
