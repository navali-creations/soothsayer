export interface CardEntry {
  count: number;
  processedIds: string[];
}

export interface DivinationCardResult {
  totalCount: number;
  cards: Record<string, CardEntry>;
}

const CARD_DROP_LINE_PATTERN =
  /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}:\d{2} (\d+) \S+ \[INFO Client \d+\] : Card drawn from the deck: <divination>\{([^}\r\n]+)\}\r?$/;

/**
 * Parses client log lines to extract unique divination cards
 * @param logText - The raw log text from client.txt
 * @param previouslyProcessedIds - Set of IDs already processed (to avoid duplicates)
 * @returns Object with total count and card occurrences
 *
 * @example Client.txt div card output: 2025/12/01 02:07:01 219999828 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{The Doppelganger
 */
export function parseCards(
  logText: string,
  previouslyProcessedIds: { has(id: string): boolean } = new Set(),
): DivinationCardResult {
  const lines = logText.split("\n");
  const cardMap = new Map<string, Set<string>>(); // cardName -> Set of uniqueIds

  for (const line of lines) {
    // Client.txt is an external boundary. Parse the complete record shape so a
    // marker embedded in malformed text cannot supply a bogus deduplication ID.
    const cardMatch = CARD_DROP_LINE_PATTERN.exec(line);
    if (!cardMatch) {
      continue;
    }
    const uniqueId = cardMatch[1];
    const cardName = cardMatch[2];

    // Skip if already processed
    if (previouslyProcessedIds.has(uniqueId)) {
      continue;
    }

    // Add to card map
    if (!cardMap.has(cardName)) {
      cardMap.set(cardName, new Set());
    }
    cardMap.get(cardName)!.add(uniqueId);
  }

  // Convert to the required format
  const cards: Record<string, CardEntry> = {};
  for (const [cardName, idSet] of cardMap.entries()) {
    cards[cardName] = {
      count: idSet.size,
      processedIds: Array.from(idSet),
    };
  }

  const totalCount = Object.values(cards).reduce(
    (sum, entry) => sum + entry.count,
    0,
  );

  return {
    totalCount,
    cards,
  };
}
