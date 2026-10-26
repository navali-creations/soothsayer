export interface CardDropEvent {
  cardName: string;
  processedId: string;
  droppedAt: string;
  localMinute: number;
  utcOffsetMinutes: number;
  location: string | null;
}

export interface DivinationCardResult {
  totalCount: number;
  events: CardDropEvent[];
  lastLocation: string | null;
}

const CLIENT_LOG_LINE_PATTERN =
  /^(\d{4})\/(\d{2})\/(\d{2}) (\d{2}):(\d{2}):(\d{2}) (\d+) \S+ \[INFO Client \d+\] : (.+)\r?$/;
const CARD_DROP_MESSAGE_PATTERN =
  /^Card drawn from the deck: <divination>\{([^}\r\n]+)\}$/;
const LOCATION_MESSAGE_PATTERN = /^:?[ ]?You have entered ([^\r\n]{1,200})\.$/;

function parseLocationMessage(message: string): string | null {
  const location = LOCATION_MESSAGE_PATTERN.exec(message)?.[1].trim();
  return location || null;
}

interface ParsedClientLogLine {
  timestamp: Date;
  processedId: string;
  message: string;
}

export type ClientLogRecord =
  | { type: "location"; location: string }
  | { type: "card"; event: CardDropEvent };

function parseClientLogLinePrefix(line: string): ParsedClientLogLine | null {
  const match = CLIENT_LOG_LINE_PATTERN.exec(line);
  if (!match) return null;

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const timestamp = new Date(year, month - 1, day, hour, minute, second);

  if (
    timestamp.getFullYear() !== year ||
    timestamp.getMonth() !== month - 1 ||
    timestamp.getDate() !== day ||
    timestamp.getHours() !== hour ||
    timestamp.getMinutes() !== minute ||
    timestamp.getSeconds() !== second
  ) {
    return null;
  }

  return {
    timestamp,
    processedId: match[7],
    message: match[8],
  };
}

export function parseLocationLine(line: string): string | null {
  const parsed = parseClientLogLinePrefix(line);
  if (!parsed) return null;

  return parseLocationMessage(parsed.message);
}

export function parseClientLogLine(
  line: string,
  currentLocation: string | null,
): ClientLogRecord | null {
  const parsed = parseClientLogLinePrefix(line);
  if (!parsed) return null;

  const location = parseLocationMessage(parsed.message);
  if (location) {
    return { type: "location", location };
  }

  const cardMatch = CARD_DROP_MESSAGE_PATTERN.exec(parsed.message);
  if (!cardMatch) return null;

  return {
    type: "card",
    event: {
      cardName: cardMatch[1],
      processedId: parsed.processedId,
      droppedAt: parsed.timestamp.toISOString(),
      localMinute:
        parsed.timestamp.getHours() * 60 + parsed.timestamp.getMinutes(),
      utcOffsetMinutes: 0 - parsed.timestamp.getTimezoneOffset(),
      location: currentLocation,
    },
  };
}

/**
 * Parses client log lines to extract unique divination cards
 * @param logText - The raw log text from client.txt
 * @param previouslyProcessedIds - Set of IDs already processed (to avoid duplicates)
 * @returns Parsed card events, their total count, and the latest location
 *
 * @example Client.txt div card output: 2025/12/01 02:07:01 219999828 cff945bb [INFO Client 2588] : Card drawn from the deck: <divination>{The Doppelganger
 */
export function parseCards(
  logText: string,
  previouslyProcessedIds: { has(id: string): boolean } = new Set(),
  initialLocation: string | null = null,
): DivinationCardResult {
  const lines = logText.split("\n");
  const events: CardDropEvent[] = [];
  const seenIds = new Set<string>();
  let currentLocation = initialLocation;

  for (const line of lines) {
    const record = parseClientLogLine(line, currentLocation);
    if (!record) continue;

    if (record.type === "location") {
      currentLocation = record.location;
      continue;
    }

    const { processedId } = record.event;

    // Skip if already processed
    if (previouslyProcessedIds.has(processedId) || seenIds.has(processedId)) {
      continue;
    }
    seenIds.add(processedId);
    events.push(record.event);
  }

  return {
    totalCount: events.length,
    events,
    lastLocation: currentLocation,
  };
}
