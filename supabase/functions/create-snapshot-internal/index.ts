import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

type SnapshotGame = "poe1" | "poe2";

interface SnapshotRequestBody {
  game: SnapshotGame;
  leagueId: string;
}

interface SnapshotRpcResult {
  id: string;
  league_id: string;
  fetched_at: string;
  exchange_chaos_to_divine: number | null;
  stacked_deck_chaos_cost: number | null;
  stacked_deck_max_volume_rate?: number | null;
}

import { responseJson } from "../_shared/utils.ts";

const DEFAULT_CHAOS_TO_DIVINE_RATIO = 100;
const DEFAULT_POE_NINJA_FETCH_TIMEOUT_MS = 15_000;
const MAX_LEAGUE_ID_LENGTH = 128;
const MAX_REQUEST_BODY_BYTES = 4_096;

class RequestValidationError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === "number";
}

function isSnapshotRpcResult(value: unknown): value is SnapshotRpcResult {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.id === "string" &&
    typeof value.league_id === "string" &&
    typeof value.fetched_at === "string" &&
    isNullableNumber(value.exchange_chaos_to_divine) &&
    isNullableNumber(value.stacked_deck_chaos_cost) &&
    (value.stacked_deck_max_volume_rate === undefined ||
      isNullableNumber(value.stacked_deck_max_volume_rate))
  );
}

async function readSnapshotRequest(req: Request): Promise<SnapshotRequestBody> {
  const contentLength = Number(req.headers.get("content-length") ?? "0");
  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_REQUEST_BODY_BYTES
  ) {
    throw new RequestValidationError(413, "Request body too large");
  }

  const rawBody = await req.text();
  if (new TextEncoder().encode(rawBody).byteLength > MAX_REQUEST_BODY_BYTES) {
    throw new RequestValidationError(413, "Request body too large");
  }

  if (!rawBody.trim()) {
    throw new RequestValidationError(
      400,
      "Missing required parameters: game, leagueId",
    );
  }

  let body: unknown;
  try {
    body = JSON.parse(rawBody);
  } catch {
    throw new RequestValidationError(400, "Invalid JSON request body");
  }

  if (!isRecord(body)) {
    throw new RequestValidationError(400, "Invalid request body");
  }

  const { game, leagueId } = body;
  if (typeof game !== "string" || typeof leagueId !== "string") {
    throw new RequestValidationError(
      400,
      "Missing required parameters: game, leagueId",
    );
  }

  if (game !== "poe1" && game !== "poe2") {
    throw new RequestValidationError(
      400,
      "Invalid game: expected poe1 or poe2",
    );
  }

  const trimmedLeagueId = leagueId.trim();
  if (!trimmedLeagueId) {
    throw new RequestValidationError(
      400,
      "Missing required parameters: game, leagueId",
    );
  }

  if (trimmedLeagueId.length > MAX_LEAGUE_ID_LENGTH) {
    throw new RequestValidationError(400, "leagueId is too long");
  }

  return { game, leagueId: trimmedLeagueId };
}

function getPoeNinjaFetchTimeoutMs(): number {
  const configured = Number(Deno.env.get("POE_NINJA_FETCH_TIMEOUT_MS"));
  return Number.isFinite(configured) && configured > 0
    ? configured
    : DEFAULT_POE_NINJA_FETCH_TIMEOUT_MS;
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const timeoutMs = getPoeNinjaFetchTimeoutMs();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`poe.ninja request timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function roundToTwoDecimals(value: number): number {
  return Math.round(value * 100) / 100;
}

function formatRawValue(value: unknown): string {
  if (value === undefined) return "undefined";
  if (value === null) return "null";
  if (typeof value === "number")
    return Number.isNaN(value) ? "NaN" : `${value}`;
  if (typeof value === "string") return `"${value}"`;
  if (typeof value === "boolean") return `${value}`;

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function formatErrorReason(reason: unknown): string {
  return reason instanceof Error ? reason.message : formatRawValue(reason);
}

function logMalformedPrice(
  tag: string,
  {
    source,
    index,
    cardName,
    reason,
    rawChaosValue,
    rawDivineValue,
    chaosToDivineRatio,
  }: {
    source: string;
    index: number | null;
    cardName: unknown;
    reason: string;
    rawChaosValue: unknown;
    rawDivineValue: unknown;
    chaosToDivineRatio?: number;
  },
): void {
  console.warn(
    `${tag} Malformed ${source} price row skipped: ` +
      `index=${index ?? "n/a"}, ` +
      `card=${formatRawValue(cardName)}, ` +
      `reason=${reason}, ` +
      `chaosValue=${formatRawValue(rawChaosValue)}, ` +
      `divineValue=${formatRawValue(rawDivineValue)}, ` +
      `ratio=${chaosToDivineRatio ?? "n/a"}`,
  );
}

function deriveDivineValue(
  chaosValue: number,
  explicitDivineValue: unknown,
  chaosToDivineRatio: number,
): number | null {
  const divineValue = toFiniteNumber(explicitDivineValue);
  if (divineValue !== null) {
    return roundToTwoDecimals(divineValue);
  }

  if (!Number.isFinite(chaosToDivineRatio) || chaosToDivineRatio <= 0) {
    return null;
  }

  return roundToTwoDecimals(chaosValue / chaosToDivineRatio);
}

Deno.serve(async (req) => {
  try {
    if (req.method === "OPTIONS") {
      return responseJson({
        status: 200,
        body: null,
        headers: {
          "Access-Control-Allow-Methods": "POST, OPTIONS",
        },
      });
    }

    if (req.method !== "POST") {
      return responseJson({
        status: 405,
        body: { error: "Method not allowed" },
      });
    }

    const secret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("INTERNAL_CRON_SECRET");

    if (!expectedSecret) {
      console.error("INTERNAL_CRON_SECRET is not configured");
      return responseJson({
        status: 500,
        body: { error: "Server misconfigured" },
      });
    }

    const encoder = new TextEncoder();
    const secretBytes = encoder.encode(secret ?? "");
    const expectedBytes = encoder.encode(expectedSecret);

    let isValid = false;
    if (secretBytes.byteLength === expectedBytes.byteLength) {
      const key = await crypto.subtle.importKey(
        "raw",
        new Uint8Array(32),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
      );
      const [macA, macB] = await Promise.all([
        crypto.subtle.sign("HMAC", key, secretBytes),
        crypto.subtle.sign("HMAC", key, expectedBytes),
      ]);
      const a = new Uint8Array(macA);
      const b = new Uint8Array(macB);
      let diff = 0;
      for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
      isValid = diff === 0;
    }

    if (!isValid) {
      return responseJson({ status: 401, body: { error: "Unauthorized" } });
    }

    let requestBody: SnapshotRequestBody;
    try {
      requestBody = await readSnapshotRequest(req);
    } catch (error) {
      if (error instanceof RequestValidationError) {
        return responseJson({
          status: error.status,
          body: { error: error.message },
        });
      }
      throw error;
    }
    const { game, leagueId } = requestBody;

    // Build a tag for every log line so concurrent invocations are traceable
    const tag = `[${game}/${leagueId}]`;

    console.log(`${tag} Creating snapshot...`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // 1. Find league
    const { data: league, error: leagueError } = await supabase
      .from("poe_leagues")
      .select("id, name")
      .eq("game", game)
      .eq("league_id", leagueId)
      .single();

    if (leagueError || !league) {
      console.error(`${tag} League not found: ${leagueId}`);
      return responseJson({ status: 404, body: { error: "League not found" } });
    }

    console.log(
      `${tag} Resolved league: id=${league.id}, name="${league.name}"`,
    );

    // 2. Fetch independent poe.ninja sources in parallel.
    const gamePrefix = game === "poe2" ? "poe2" : "poe1";
    const exchangeUrl = `https://poe.ninja/${gamePrefix}/api/economy/exchange/current/overview?league=${encodeURIComponent(
      league.name,
    )}&type=DivinationCard`;
    const currencyUrl = `https://poe.ninja/${gamePrefix}/api/economy/exchange/current/overview?league=${encodeURIComponent(
      league.name,
    )}&type=Currency`;

    console.log(`${tag} Fetching exchange API: ${exchangeUrl}`);
    console.log(`${tag} Fetching currency API: ${currencyUrl}`);

    const exchangeRequest = fetchWithTimeout(exchangeUrl);
    const currencyRequest = fetchWithTimeout(currencyUrl);
    const [exchangeResult, currencyResult] = await Promise.allSettled([
      exchangeRequest,
      currencyRequest,
    ]);

    if (exchangeResult.status === "rejected") {
      throw new Error(
        `poe.ninja exchange API failed: ${formatErrorReason(
          exchangeResult.reason,
        )}`,
      );
    }

    const exchangeResponse = exchangeResult.value;

    if (!exchangeResponse.ok) {
      throw new Error(
        `poe.ninja exchange API failed: ${exchangeResponse.statusText}`,
      );
    }

    const exchangeData = await exchangeResponse.json();

    // Calculate chaos to divine ratio
    const divineRate = toFiniteNumber(exchangeData.core?.rates?.divine);
    const chaosToDivineRatio =
      divineRate !== null && divineRate > 0
        ? 1 / divineRate
        : DEFAULT_CHAOS_TO_DIVINE_RATIO;

    console.log(`${tag} Exchange chaos-to-divine ratio: ${chaosToDivineRatio}`);

    // Build exchange card prices (exchange data is always high confidence)
    const exchangeCardPrices: Array<any> = [];
    const items = exchangeData.items ?? [];
    const lines = exchangeData.lines ?? [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const line = lines[i];
      if (line && item?.category === "Cards") {
        const cardName = typeof item.name === "string" ? item.name.trim() : "";
        const chaosValue = toFiniteNumber(line.primaryValue);

        if (!cardName || chaosValue === null) {
          logMalformedPrice(tag, {
            source: "exchange",
            index: i,
            cardName: item?.name,
            reason: !cardName ? "missing card name" : "invalid chaos value",
            rawChaosValue: line.primaryValue,
            rawDivineValue: null,
            chaosToDivineRatio,
          });
          continue;
        }

        const divineValue = deriveDivineValue(
          chaosValue,
          null,
          chaosToDivineRatio,
        );
        if (divineValue === null) {
          logMalformedPrice(tag, {
            source: "exchange",
            index: i,
            cardName,
            reason: "invalid derived divine value",
            rawChaosValue: line.primaryValue,
            rawDivineValue: null,
            chaosToDivineRatio,
          });
          continue;
        }

        exchangeCardPrices.push({
          card_name: cardName,
          chaos_value: chaosValue,
          divine_value: divineValue,
          confidence: 1,
        });
      }
    }

    console.log(`${tag} Fetched ${exchangeCardPrices.length} exchange prices`);

    // 3. Fetch Stacked Deck price from poe.ninja Currency API
    let stackedDeckChaosCost = 0;
    let stackedDeckMaxVolumeRate: number | null = null;
    if (currencyResult.status === "rejected") {
      console.warn(
        `${tag} Failed to fetch stacked deck price, defaulting to 0:`,
        currencyResult.reason,
      );
    } else {
      const currencyResponse = currencyResult.value;
      if (!currencyResponse.ok) {
        console.warn(
          `${tag} Currency API failed: ${currencyResponse.statusText}, defaulting stacked deck cost to 0`,
        );
      } else {
        const currencyData = await currencyResponse.json();
        const stackedDeck = currencyData.lines?.find(
          (line: any) => line.id === "stacked-deck",
        );
        stackedDeckChaosCost = stackedDeck?.primaryValue || 0;
        const rawMaxVolumeRate = stackedDeck?.maxVolumeRate ?? null;
        stackedDeckMaxVolumeRate =
          rawMaxVolumeRate != null ? Math.floor(rawMaxVolumeRate) : null;
        console.log(
          `${tag} Stacked Deck cost: ${stackedDeckChaosCost} chaos, maxVolumeRate: ${
            stackedDeckMaxVolumeRate ?? "N/A"
          } decks/divine`,
        );
      }
    }

    if (game === "poe2" && exchangeCardPrices.length === 0) {
      console.log(
        `${tag} No poe.ninja divination card prices available for poe2; skipping snapshot creation`,
      );

      return responseJson({
        status: 200,
        body: {
          success: true,
          skipped: true,
          reason: "no_divination_card_prices",
          message:
            "No poe.ninja divination card prices available for poe2; snapshot skipped",
          game,
          leagueId: league.id,
          leagueName: league.name,
          exchangeChaosToDivine: chaosToDivineRatio,
          stackedDeckChaosCost,
          stackedDeckMaxVolumeRate,
          cardCount: 0,
        },
      });
    }

    // 4. Upsert unique card names into `cards` table
    const uniqueCardNames = [
      ...new Set(exchangeCardPrices.map((p) => p.card_name)),
    ];

    if (uniqueCardNames.length > 0) {
      const cardRows = uniqueCardNames.map((name) => ({
        game,
        name,
      }));

      const { error: cardsUpsertError } = await supabase
        .from("cards")
        .upsert(cardRows, {
          onConflict: "game,name",
          ignoreDuplicates: true,
        });

      if (cardsUpsertError) {
        console.warn(
          `${tag} Failed to upsert cards (non-fatal): ${cardsUpsertError.message}`,
        );
      }
    }

    // 5. Build card name -> card_id map for only the names in this snapshot.
    const cardIdQuery = supabase
      .from("cards")
      .select("id, name")
      .eq("game", game);
    const { data: cardIdRows, error: cardIdError } =
      uniqueCardNames.length > 0
        ? await cardIdQuery.in("name", uniqueCardNames)
        : await cardIdQuery.limit(0);

    const cardIdMap = new Map<string, string>();
    if (cardIdRows) {
      for (const row of cardIdRows) {
        cardIdMap.set(row.name, row.id);
      }
    }

    if (cardIdError) {
      console.warn(
        `${tag} Failed to fetch card IDs (non-fatal): ${cardIdError.message}`,
      );
    }

    console.log(
      `${tag} Upserted ${uniqueCardNames.length} card names, resolved ${cardIdMap.size} card IDs`,
    );

    if (uniqueCardNames.length > 0 && cardIdMap.size === 0) {
      console.error(
        `${tag} ALERT: Had ${uniqueCardNames.length} card names but resolved 0 card IDs — all prices will be skipped for this snapshot`,
      );
    }

    // 6. Build all card prices (card_name is NOT stored — resolved via card_id FK)
    const allCardPrices: Array<{
      card_id: string;
      chaos_value: number;
      divine_value: number;
      confidence: number;
    }> = [];

    let skippedCount = 0;
    for (const p of exchangeCardPrices) {
      const cardId = cardIdMap.get(p.card_name);
      if (!cardId) {
        skippedCount++;
        console.warn(`${tag} No card_id for "${p.card_name}" — skipping`);
        continue;
      }

      const chaosValue = toFiniteNumber(p.chaos_value);
      const divineValue = toFiniteNumber(p.divine_value);
      if (chaosValue === null || divineValue === null) {
        skippedCount++;
        logMalformedPrice(tag, {
          source: "exchange",
          index: null,
          cardName: p.card_name,
          reason: "invalid normalized numeric price",
          rawChaosValue: p.chaos_value,
          rawDivineValue: p.divine_value,
        });
        continue;
      }

      allCardPrices.push({
        card_id: cardId,
        chaos_value: chaosValue,
        divine_value: divineValue,
        confidence: p.confidence,
      });
    }

    if (skippedCount > 0) {
      console.warn(
        `${tag} Skipped ${skippedCount} prices due to missing card_id`,
      );
    }

    if (uniqueCardNames.length > 0 && allCardPrices.length === 0) {
      throw new Error("Failed to resolve card IDs for snapshot prices");
    }

    if (allCardPrices.length === 0) {
      throw new Error("No valid card prices available for snapshot");
    }

    const fetchedAt = new Date().toISOString();
    const { data: snapshotData, error: snapshotError } = await supabase
      .rpc("create_snapshot_with_prices", {
        p_league_id: league.id,
        p_fetched_at: fetchedAt,
        p_exchange_chaos_to_divine: chaosToDivineRatio,
        p_stacked_deck_chaos_cost: stackedDeckChaosCost,
        p_stacked_deck_max_volume_rate: stackedDeckMaxVolumeRate,
        p_prices: allCardPrices,
      })
      .single();

    if (snapshotError) {
      throw new Error(`Failed to create snapshot: ${snapshotError.message}`);
    }

    if (!isSnapshotRpcResult(snapshotData)) {
      throw new Error("Failed to create snapshot: invalid snapshot response");
    }

    const snapshot = snapshotData;

    if (Date.parse(snapshot.fetched_at) !== Date.parse(fetchedAt)) {
      console.log(
        `${tag} Recent snapshot was created concurrently (${snapshot.fetched_at}), skipping...`,
      );
      return responseJson({
        status: 200,
        body: {
          message: "Recent snapshot exists",
          snapshot,
        },
      });
    }

    console.log(`${tag} Created snapshot ${snapshot.id}`);
    console.log(`${tag} Inserted ${allCardPrices.length} card prices`);

    console.log(
      `${tag} ✅ Snapshot complete: id=${snapshot.id}, cards=${
        allCardPrices.length
      }${skippedCount > 0 ? `, skipped=${skippedCount}` : ""}`,
    );

    return responseJson({
      status: 200,
      body: {
        success: true,
        snapshot: {
          id: snapshot.id,
          leagueId: league.id,
          fetchedAt: snapshot.fetched_at,
          exchangeChaosToDivine: snapshot.exchange_chaos_to_divine,
          stackedDeckChaosCost: snapshot.stacked_deck_chaos_cost,
          stackedDeckMaxVolumeRate:
            snapshot.stacked_deck_max_volume_rate ?? null,
          cardCount: allCardPrices.length,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Error in create-snapshot-internal:", error);
    return responseJson({
      status: 500,
      body: { error: "Failed to create snapshot" },
    });
  }
});
