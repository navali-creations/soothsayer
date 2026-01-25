export interface CardEntry {
  count: number;
  processedIds: string[];
}

export interface DivinationCardResult {
  totalCount: number;
  cards: Record<string, CardEntry>;
}

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
  previouslyProcessedIds: Set<string> = new Set(),
): DivinationCardResult {
  const lines = logText.split("\n");
  const cardMap = new Map<string, Set<string>>(); // cardName -> Set of uniqueIds

  for (const line of lines) {
    // Skip lines that don't contain divination cards
    if (!line.includes("Card drawn from the deck: <divination>")) {
      continue;
    }

    // Extract card name from between {}
    const cardMatch = line.match(/{([^}]+)}/);
    if (!cardMatch) {
      continue;
    }
    const cardName = cardMatch[1];

    // Extract unique ID (third column - after date and time)
    const parts = line.split(" ");
    if (parts.length < 3) {
      continue;
    }
    const uniqueId = parts[2]; // The unique identifier like "205270890"

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
