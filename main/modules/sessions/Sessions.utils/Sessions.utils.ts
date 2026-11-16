import { type RawBuilder, sql } from "kysely";

import { type GameType, MAX_SESSION_INPUT_CHAOS } from "~/types/data-stores";

export const SESSION_DECK_PRICE_PREFIX = "session:stacked-deck-price:";

export const sessionDeckPriceKey = (sessionId: string) =>
  `${SESSION_DECK_PRICE_PREFIX}${sessionId}`;

export const gameDeckPriceKey = (game: GameType) =>
  `current-session:stacked-deck-price:${game}`;

export const cardPriceThresholdKey = (game: GameType) =>
  `current-session:hide-below-chaos:${game}`;

/** Metadata is persisted text, so validate it before using it as a price. */
export function parseSessionChaosSetting(value: unknown): number | null {
  if (typeof value !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return typeof parsed === "number" &&
      Number.isFinite(parsed) &&
      parsed >= 0 &&
      parsed <= MAX_SESSION_INPUT_CHAOS
      ? parsed
      : null;
  } catch {
    return null;
  }
}

/** Match parseSessionChaosSetting without allowing SQLite CAST to turn bad text into 0. */
export function sessionDeckPriceSql(): RawBuilder<number | null> {
  return sql<number | null>`(
    SELECT CASE WHEN json_valid(price.value) THEN
      CASE WHEN json_type(price.value) IN ('integer', 'real')
        AND CAST(price.value AS REAL) BETWEEN 0 AND ${MAX_SESSION_INPUT_CHAOS}
      THEN CAST(price.value AS REAL) END
    END
    FROM app_metadata AS price
    WHERE price.key = ${SESSION_DECK_PRICE_PREFIX} || s.id
  )`;
}

/** Queries using this helper join sessions s, session_summaries ss and snapshots snap. */
export function effectiveSessionDeckCostSql(): RawBuilder<number> {
  return sql<number>`COALESCE(ss.stacked_deck_chaos_cost, ${sessionDeckPriceSql()}, snap.stacked_deck_chaos_cost, 0)`;
}
