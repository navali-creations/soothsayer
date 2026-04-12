import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  enforceRateLimitByIdentifier,
  responseJson,
} from "../_shared/utils.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

/**
 * GET /get-community-drop-rates?game=poe1
 *
 * Public API for wraeclast.cards — returns aggregated community drop-rate data
 * for every card in the requested game, broken down by league.
 *
 * Auth: x-api-key header validated against Supabase Vault secret `wraeclast_cards_api_key`.
 */
// Rate limit: 100 requests per hour per API key, enforced atomically via DB
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

Deno.serve(async (req: Request) => {
  // ── CORS preflight ──────────────────────────────────────────────────
  if (req.method === "OPTIONS") {
    return responseJson({ status: 200, headers: CORS_HEADERS });
  }

  if (req.method !== "GET") {
    return responseJson({
      status: 405,
      body: { error: "Method not allowed" },
      headers: CORS_HEADERS,
    });
  }

  // ── Build service-role client ───────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── Validate API key ────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) {
    return responseJson({
      status: 401,
      body: { error: "Missing x-api-key header" },
      headers: CORS_HEADERS,
    });
  }

  const { data: secret, error: vaultError } = await supabase
    .from("decrypted_secrets")
    .select("decrypted_secret")
    .eq("name", "wraeclast_cards_api_key")
    .schema("vault")
    .single();

  if (vaultError || !secret?.decrypted_secret) {
    console.error(
      "[get-community-drop-rates] Vault lookup failed:",
      vaultError,
    );
    return responseJson({
      status: 500,
      body: { error: "Internal server error" },
      headers: CORS_HEADERS,
    });
  }

  // Constant-time comparison to prevent timing attacks
  const encoder = new TextEncoder();
  const apiKeyBytes = encoder.encode(apiKey);
  const secretBytes = encoder.encode(secret.decrypted_secret);

  const keyValid =
    apiKeyBytes.byteLength === secretBytes.byteLength &&
    crypto.subtle.timingSafeEqual(apiKeyBytes, secretBytes);

  if (!keyValid) {
    return responseJson({
      status: 401,
      body: { error: "Invalid API key" },
      headers: CORS_HEADERS,
    });
  }

  // Rate limit by API key — atomic DB-backed enforcement via check_and_log_request
  // Uses a stable identifier derived from the API key (not the raw key itself)
  const identifierHash = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(apiKey),
  );
  const identifier = `apikey:${Array.from(new Uint8Array(identifierHash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")}`;

  try {
    await enforceRateLimitByIdentifier({
      adminClient: supabase,
      identifier,
      endpoint: "get-community-drop-rates",
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxHits: RATE_LIMIT_MAX,
    });
  } catch (error) {
    const status = (error as any).status;

    if (status === 403) {
      return responseJson({
        status: 403,
        body: { error: (error as Error).message || "Forbidden" },
        headers: CORS_HEADERS,
      });
    }

    if (status === 429) {
      return responseJson({
        status: 429,
        body: { error: "Rate limit exceeded. Try again later." },
        headers: CORS_HEADERS,
      });
    }

    console.error("[get-community-drop-rates] Rate limit error:", error);
    return responseJson({
      status: 500,
      body: { error: "Internal server error" },
      headers: CORS_HEADERS,
    });
  }

  // ── Parse & validate query params ───────────────────────────────────
  const url = new URL(req.url);
  const game = url.searchParams.get("game");

  if (!game || !["poe1", "poe2"].includes(game)) {
    return responseJson({
      status: 400,
      body: {
        error: "Missing or invalid 'game' parameter. Must be poe1 or poe2",
      },
      headers: CORS_HEADERS,
    });
  }

  // ── Fetch leagues for this game ─────────────────────────────────────
  const { data: leagues, error: leaguesError } = await supabase
    .from("poe_leagues")
    .select("id, name")
    .eq("game", game)
    .eq("is_active", true);

  if (leaguesError) {
    console.error(
      "[get-community-drop-rates] Failed to fetch leagues:",
      leaguesError,
    );
    return responseJson({
      status: 500,
      body: { error: "Failed to fetch leagues" },
      headers: CORS_HEADERS,
    });
  }

  if (!leagues || leagues.length === 0) {
    console.log(
      `[get-community-drop-rates] No active leagues found for game=${game}`,
    );
    return responseJson({
      status: 200,
      body: { game, leagues: [], cards: [] },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  const leagueIds = leagues.map((l) => l.id);

  // ── Fetch non-suspicious uploads for these leagues ──────────────────
  const { data: uploads, error: uploadsError } = await supabase
    .from("community_uploads")
    .select("id, league_id, device_id, ggg_uuid, is_verified")
    .eq("is_suspicious", false)
    .in("league_id", leagueIds)
    .limit(10000);

  if (uploadsError) {
    console.error(
      "[get-community-drop-rates] Failed to fetch uploads:",
      uploadsError,
    );
    return responseJson({
      status: 500,
      body: { error: "Failed to fetch community uploads" },
      headers: CORS_HEADERS,
    });
  }

  if (!uploads || uploads.length === 0) {
    console.log(
      `[get-community-drop-rates] No community uploads for game=${game}`,
    );
    return responseJson({
      status: 200,
      body: {
        game,
        leagues: leagues.map((l) => ({ id: l.id, name: l.name })),
        cards: [],
      },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  const uploadIds = uploads.map((u) => u.id);

  // Build lookup maps for uploads
  const uploadById = new Map(uploads.map((u) => [u.id, u]));

  // ── Fetch card data for these uploads (paginated) ───────────────────
  const allCardData: Array<{
    upload_id: string;
    card_id: string;
    count: number;
  }> = [];
  const PAGE_SIZE = 10000;
  const MAX_PAGES = 50; // Safety cap: 50 pages × 10,000 = 500K max rows
  let offset = 0;
  let hasMore = true;
  let pageCount = 0;

  while (hasMore) {
    if (pageCount >= MAX_PAGES) {
      console.warn("[get-community-drop-rates] Hit pagination safety cap");
      break;
    }
    const { data: page, error: pageError } = await supabase
      .from("community_card_data")
      .select("upload_id, card_id, count")
      .in("upload_id", uploadIds)
      .range(offset, offset + PAGE_SIZE - 1);

    if (pageError) {
      console.error(
        "[get-community-drop-rates] Failed to fetch card data page:",
        pageError,
      );
      return responseJson({
        status: 500,
        body: { error: "Failed to fetch community card data" },
        headers: CORS_HEADERS,
      });
    }

    if (!page || page.length === 0) {
      hasMore = false;
    } else {
      allCardData.push(...page);
      hasMore = page.length === PAGE_SIZE;
      offset += PAGE_SIZE;
    }
    pageCount++;
  }

  if (allCardData.length === 0) {
    console.log(`[get-community-drop-rates] No card data for game=${game}`);
    return responseJson({
      status: 200,
      body: {
        game,
        leagues: leagues.map((l) => ({ id: l.id, name: l.name })),
        cards: [],
      },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  // ── Fetch cards for this game ───────────────────────────────────────
  const { data: cards, error: cardsError } = await supabase
    .from("cards")
    .select("id, name")
    .eq("game", game)
    .limit(10000);

  if (cardsError) {
    console.error(
      "[get-community-drop-rates] Failed to fetch cards:",
      cardsError,
    );
    return responseJson({
      status: 500,
      body: { error: "Failed to fetch cards" },
      headers: CORS_HEADERS,
    });
  }

  const cardById = new Map((cards ?? []).map((c) => [c.id, c]));

  // ── Aggregate data ──────────────────────────────────────────────────
  //
  // Shape: cardName → leagueId → {
  //   total_count, contributors (Set<device_id>),
  //   verified_count, verified_contributors (Set<ggg_uuid>)
  // }
  type LeagueAgg = {
    total_count: number;
    contributors: Set<string>;
    verified_count: number;
    verified_contributors: Set<string>;
  };

  const aggMap = new Map<string, Map<string, LeagueAgg>>();

  // Also track total drops per league for ratio calculation
  const leagueTotalDrops = new Map<string, number>();

  for (const row of allCardData) {
    const card = cardById.get(row.card_id);
    const upload = uploadById.get(row.upload_id);
    if (!card || !upload) continue;

    const cardName = card.name;
    const leagueId = upload.league_id;

    // Initialise card → league map
    if (!aggMap.has(cardName)) {
      aggMap.set(cardName, new Map());
    }
    const leagueMap = aggMap.get(cardName)!;

    if (!leagueMap.has(leagueId)) {
      leagueMap.set(leagueId, {
        total_count: 0,
        contributors: new Set(),
        verified_count: 0,
        verified_contributors: new Set(),
      });
    }
    const agg = leagueMap.get(leagueId)!;

    agg.total_count += row.count;
    agg.contributors.add(upload.device_id);

    if (upload.is_verified) {
      agg.verified_count += row.count;
      if (upload.ggg_uuid) {
        agg.verified_contributors.add(upload.ggg_uuid);
      }
    }

    // Accumulate league totals
    leagueTotalDrops.set(
      leagueId,
      (leagueTotalDrops.get(leagueId) ?? 0) + row.count,
    );
  }

  // ── Build response ──────────────────────────────────────────────────
  // Only include leagues that actually have community data
  const leaguesWithData = new Set<string>();
  for (const leagueMap of aggMap.values()) {
    for (const leagueId of leagueMap.keys()) {
      leaguesWithData.add(leagueId);
    }
  }

  const responseLeagues = leagues
    .filter((l) => leaguesWithData.has(l.id))
    .map((l) => ({ id: l.id, name: l.name }));

  const responseCards: Array<{
    name: string;
    leagues: Record<
      string,
      {
        count: number;
        ratio: number;
        contributors: number;
        verified_count: number;
        verified_contributors: number;
      }
    >;
  }> = [];

  // Sort cards alphabetically for stable output
  const sortedCardNames = [...aggMap.keys()].sort((a, b) => a.localeCompare(b));

  for (const cardName of sortedCardNames) {
    const leagueMap = aggMap.get(cardName)!;
    const leaguesObj: Record<
      string,
      {
        count: number;
        ratio: number;
        contributors: number;
        verified_count: number;
        verified_contributors: number;
      }
    > = {};

    for (const [leagueId, agg] of leagueMap) {
      const totalDropsInLeague = leagueTotalDrops.get(leagueId) ?? 1;
      leaguesObj[leagueId] = {
        count: agg.total_count,
        ratio:
          totalDropsInLeague > 0
            ? parseFloat((agg.total_count / totalDropsInLeague).toFixed(6))
            : 0,
        contributors: agg.contributors.size,
        verified_count: agg.verified_count,
        verified_contributors: agg.verified_contributors.size,
      };
    }

    responseCards.push({ name: cardName, leagues: leaguesObj });
  }

  console.log(
    `[get-community-drop-rates] game=${game} | leagues=${responseLeagues.length} | cards=${responseCards.length} | uploads=${uploads.length}`,
  );

  return responseJson({
    status: 200,
    body: {
      game,
      leagues: responseLeagues,
      cards: responseCards,
    },
    headers: {
      ...CORS_HEADERS,
      "Cache-Control": "public, max-age=300",
    },
  });
});
