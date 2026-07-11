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
 * Auth: x-api-key header validated against the `WRAECLAST_CARDS_API_KEY`
 * Supabase Edge Function secret.
 */
// Rate limit: 100 requests per hour per API key, enforced atomically via DB
const RATE_LIMIT_MAX = 100;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour

function getConfiguredApiKey(): string | null {
  return (
    Deno.env.get("WRAECLAST_CARDS_API_KEY") ??
    Deno.env.get("wraeclast_cards_api_key") ??
    null
  );
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);

  if (aBytes.byteLength !== bBytes.byteLength) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < aBytes.byteLength; i++) {
    diff |= aBytes[i] ^ bBytes[i];
  }

  return diff === 0;
}

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

  // ── Validate API key ────────────────────────────────────────────────
  const apiKey = req.headers.get("x-api-key");

  if (!apiKey) {
    return responseJson({
      status: 401,
      body: { error: "Missing x-api-key header" },
      headers: CORS_HEADERS,
    });
  }

  const configuredApiKey = getConfiguredApiKey();

  if (!configuredApiKey) {
    console.error(
      "[get-community-drop-rates] WRAECLAST_CARDS_API_KEY is not configured",
    );
    return responseJson({
      status: 500,
      body: { error: "Internal server error" },
      headers: CORS_HEADERS,
    });
  }

  if (!timingSafeEqualStrings(apiKey, configuredApiKey)) {
    return responseJson({
      status: 401,
      body: { error: "Invalid API key" },
      headers: CORS_HEADERS,
    });
  }

  // ── Build service-role client ───────────────────────────────────────
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

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
  const includeInactive =
    url.searchParams.get("include_inactive") === "true" ||
    url.searchParams.get("include_inactive") === "1";
  const excludeSuspicious =
    url.searchParams.get("exclude_suspicious") === "true" ||
    url.searchParams.get("exclude_suspicious") === "1";

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
  let leaguesQuery = supabase
    .from("poe_leagues")
    .select("id, name")
    .eq("game", game);

  if (!includeInactive) {
    leaguesQuery = leaguesQuery.eq("is_active", true);
  }

  const { data: leagues, error: leaguesError } = await leaguesQuery;

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
    console.log(`[get-community-drop-rates] No leagues found for game=${game}`);
    return responseJson({
      status: 200,
      body: { game, leagues: [], cards: [] },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  const leagueIds = leagues.map((l) => l.id);

  // ── Fetch uploads for these leagues ─────────────────────────────────
  const { data: uploads, error: uploadsError } = await supabase
    .from("community_uploads")
    .select(
      "id, league_id, device_id, ggg_uuid, is_verified, is_suspicious, total_cards_uploaded",
    )
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
        leagues: leagues.map((l) => ({
          id: l.id,
          name: l.name,
          upload_count: 0,
          observed_total: 0,
          card_observed_total: 0,
          contributors: 0,
          verified_observed_total: 0,
          verified_card_observed_total: 0,
          verified_contributors: 0,
          excluded_suspicious_upload_count: 0,
          excluded_suspicious_observed_total: 0,
          unresolved_card_row_count: 0,
          unresolved_card_observed_total: 0,
        })),
        cards: [],
      },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  const includedUploads = excludeSuspicious
    ? uploads.filter((u) => !u.is_suspicious)
    : uploads;

  type LeagueUploadStats = {
    upload_count: number;
    observed_total: number;
    card_observed_total: number;
    contributors: Set<string>;
    verified_observed_total: number;
    verified_card_observed_total: number;
    verified_contributors: Set<string>;
    excluded_suspicious_upload_count: number;
    excluded_suspicious_observed_total: number;
    unresolved_card_row_count: number;
    unresolved_card_observed_total: number;
  };

  const leagueUploadStats = new Map<string, LeagueUploadStats>();

  function getLeagueUploadStats(leagueId: string): LeagueUploadStats {
    let stats = leagueUploadStats.get(leagueId);
    if (!stats) {
      stats = {
        upload_count: 0,
        observed_total: 0,
        card_observed_total: 0,
        contributors: new Set(),
        verified_observed_total: 0,
        verified_card_observed_total: 0,
        verified_contributors: new Set(),
        excluded_suspicious_upload_count: 0,
        excluded_suspicious_observed_total: 0,
        unresolved_card_row_count: 0,
        unresolved_card_observed_total: 0,
      };
      leagueUploadStats.set(leagueId, stats);
    }

    return stats;
  }

  for (const upload of uploads) {
    const stats = getLeagueUploadStats(upload.league_id);
    const totalCardsUploaded = upload.total_cards_uploaded ?? 0;

    if (upload.is_suspicious && excludeSuspicious) {
      stats.excluded_suspicious_upload_count++;
      stats.excluded_suspicious_observed_total += totalCardsUploaded;
      continue;
    }

    stats.upload_count++;
    stats.observed_total += totalCardsUploaded;
    stats.contributors.add(upload.device_id);

    if (upload.is_verified) {
      stats.verified_observed_total += totalCardsUploaded;
      if (upload.ggg_uuid) {
        stats.verified_contributors.add(upload.ggg_uuid);
      }
    }
  }

  if (includedUploads.length === 0) {
    console.log(
      `[get-community-drop-rates] No included community uploads for game=${game}`,
    );
    return responseJson({
      status: 200,
      body: {
        game,
        leagues: leagues.map((l) => {
          const stats = getLeagueUploadStats(l.id);
          return {
            id: l.id,
            name: l.name,
            upload_count: stats.upload_count,
            observed_total: stats.observed_total,
            card_observed_total: stats.card_observed_total,
            contributors: stats.contributors.size,
            verified_observed_total: stats.verified_observed_total,
            verified_card_observed_total: stats.verified_card_observed_total,
            verified_contributors: stats.verified_contributors.size,
            excluded_suspicious_upload_count:
              stats.excluded_suspicious_upload_count,
            excluded_suspicious_observed_total:
              stats.excluded_suspicious_observed_total,
            unresolved_card_row_count: stats.unresolved_card_row_count,
            unresolved_card_observed_total:
              stats.unresolved_card_observed_total,
          };
        }),
        cards: [],
      },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  const uploadIds = includedUploads.map((u) => u.id);

  // Build lookup maps for uploads
  const uploadById = new Map(includedUploads.map((u) => [u.id, u]));

  // ── Fetch card data for these uploads (paginated) ───────────────────
  const allCardData: Array<{
    upload_id: string;
    card_id: string;
    count: number;
  }> = [];
  // Supabase projects commonly cap PostgREST responses at 1,000 rows. Keep the
  // requested page size at that cap so a full page reliably means "fetch more".
  const PAGE_SIZE = 1000;
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
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
  }

  if (allCardData.length === 0) {
    console.log(`[get-community-drop-rates] No card data for game=${game}`);
    return responseJson({
      status: 200,
      body: {
        game,
        leagues: leagues.map((l) => {
          const stats = getLeagueUploadStats(l.id);
          return {
            id: l.id,
            name: l.name,
            upload_count: stats.upload_count,
            observed_total: stats.observed_total,
            card_observed_total: stats.card_observed_total,
            contributors: stats.contributors.size,
            verified_observed_total: stats.verified_observed_total,
            verified_card_observed_total: stats.verified_card_observed_total,
            verified_contributors: stats.verified_contributors.size,
            excluded_suspicious_upload_count:
              stats.excluded_suspicious_upload_count,
            excluded_suspicious_observed_total:
              stats.excluded_suspicious_observed_total,
            unresolved_card_row_count: stats.unresolved_card_row_count,
            unresolved_card_observed_total:
              stats.unresolved_card_observed_total,
          };
        }),
        cards: [],
      },
      headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
    });
  }

  // ── Fetch cards for this game ───────────────────────────────────────
  const cards: Array<{ id: string; name: string }> = [];
  const CARD_PAGE_SIZE = 1000;
  let cardOffset = 0;
  let hasMoreCards = true;

  while (hasMoreCards) {
    const { data: cardPage, error: cardsError } = await supabase
      .from("cards")
      .select("id, name")
      .eq("game", game)
      .range(cardOffset, cardOffset + CARD_PAGE_SIZE - 1);

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

    if (!cardPage || cardPage.length === 0) {
      hasMoreCards = false;
    } else {
      cards.push(...cardPage);
      hasMoreCards = cardPage.length === CARD_PAGE_SIZE;
      cardOffset += CARD_PAGE_SIZE;
    }
  }

  const cardById = new Map(cards.map((c) => [c.id, c]));

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

  type LeagueCardStats = {
    count: number;
    ratio: number;
    contributors: number;
    verified_count: number;
    verified_ratio: number;
    verified_contributors: number;
  };

  const aggMap = new Map<string, Map<string, LeagueAgg>>();

  for (const row of allCardData) {
    const upload = uploadById.get(row.upload_id);
    if (!upload) continue;

    const leagueId = upload.league_id;
    const leagueStats = getLeagueUploadStats(leagueId);
    leagueStats.card_observed_total += row.count;

    if (upload.is_verified) {
      leagueStats.verified_card_observed_total += row.count;
    }

    const card = cardById.get(row.card_id);
    if (!card) {
      leagueStats.unresolved_card_row_count++;
      leagueStats.unresolved_card_observed_total += row.count;
      continue;
    }

    const cardName = card.name;

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
    .filter(
      (l) =>
        leaguesWithData.has(l.id) ||
        (leagueUploadStats.get(l.id)?.upload_count ?? 0) > 0,
    )
    .map((l) => {
      const stats = getLeagueUploadStats(l.id);
      return {
        id: l.id,
        name: l.name,
        upload_count: stats.upload_count,
        observed_total: stats.observed_total,
        card_observed_total: stats.card_observed_total,
        contributors: stats.contributors.size,
        verified_observed_total: stats.verified_observed_total,
        verified_card_observed_total: stats.verified_card_observed_total,
        verified_contributors: stats.verified_contributors.size,
        excluded_suspicious_upload_count:
          stats.excluded_suspicious_upload_count,
        excluded_suspicious_observed_total:
          stats.excluded_suspicious_observed_total,
        unresolved_card_row_count: stats.unresolved_card_row_count,
        unresolved_card_observed_total: stats.unresolved_card_observed_total,
      };
    });

  const responseCards: Array<{
    name: string;
    leagues: Record<string, LeagueCardStats>;
  }> = [];

  // Sort cards alphabetically for stable output
  const sortedCardNames = [...aggMap.keys()].sort((a, b) => a.localeCompare(b));

  for (const cardName of sortedCardNames) {
    const leagueMap = aggMap.get(cardName)!;
    const leaguesObj: Record<string, LeagueCardStats> = {};

    for (const [leagueId, agg] of leagueMap) {
      const stats = getLeagueUploadStats(leagueId);
      const totalDropsInLeague = stats.card_observed_total;
      const verifiedDropsInLeague = stats.verified_card_observed_total;
      leaguesObj[leagueId] = {
        count: agg.total_count,
        ratio:
          totalDropsInLeague > 0
            ? parseFloat((agg.total_count / totalDropsInLeague).toFixed(6))
            : 0,
        contributors: agg.contributors.size,
        verified_count: agg.verified_count,
        verified_ratio:
          verifiedDropsInLeague > 0
            ? parseFloat(
                (agg.verified_count / verifiedDropsInLeague).toFixed(6),
              )
            : 0,
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
