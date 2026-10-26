import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import {
  enforceRateLimitByIdentifier,
  responseJson,
} from "../_shared/utils.ts";
import {
  getConfiguredWraeclastApiKey,
  getHttpErrorStatus,
  hashWraeclastApiKey,
  isTrustedWraeclastCaller,
  timingSafeEqualStrings,
  WRAECLAST_TRUSTED_CALLER_APP_VERSION,
} from "../_shared/wraeclast-api.ts";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "x-api-key, x-caller-token, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};
const RATE_LIMIT_MAX = 300;
const TRUSTED_RATE_LIMIT_MAX = 5_000;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;
const MIN_CONTRIBUTORS = 5;

Deno.serve(async (req: Request) => {
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

  const apiKey = req.headers.get("x-api-key");
  if (!apiKey) {
    return responseJson({
      status: 401,
      body: { error: "Missing x-api-key header" },
      headers: CORS_HEADERS,
    });
  }
  const configuredApiKey = getConfiguredWraeclastApiKey();
  if (!configuredApiKey) {
    console.error(
      "[get-community-drop-context] WRAECLAST_CARDS_API_KEY is not configured",
    );
    return responseJson({
      status: 500,
      body: { error: "Internal server error" },
      headers: CORS_HEADERS,
    });
  }
  if (!(await timingSafeEqualStrings(apiKey, configuredApiKey))) {
    return responseJson({
      status: 401,
      body: { error: "Invalid API key" },
      headers: CORS_HEADERS,
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const callerToken = req.headers.get("x-caller-token");
  const isTrustedCaller = await isTrustedWraeclastCaller(callerToken);
  const identifier = await hashWraeclastApiKey(apiKey);
  const appVersion = isTrustedCaller
    ? WRAECLAST_TRUSTED_CALLER_APP_VERSION
    : null;

  try {
    await enforceRateLimitByIdentifier({
      adminClient: supabase,
      identifier,
      endpoint: "get-community-drop-context",
      windowMs: RATE_LIMIT_WINDOW_MS,
      maxHits: isTrustedCaller ? TRUSTED_RATE_LIMIT_MAX : RATE_LIMIT_MAX,
      appVersion,
    });
  } catch (error) {
    const status = getHttpErrorStatus(error);
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
    console.error("[get-community-drop-context] Rate limit error:", error);
    return responseJson({
      status: 500,
      body: { error: "Internal server error" },
      headers: CORS_HEADERS,
    });
  }

  const url = new URL(req.url);
  const game = url.searchParams.get("game");
  const league = url.searchParams.get("league")?.trim() ?? "";
  const card = url.searchParams.get("card")?.trim() ?? "";
  if (game !== "poe1" && game !== "poe2") {
    return responseJson({
      status: 400,
      body: { error: "Missing or invalid 'game' parameter" },
      headers: CORS_HEADERS,
    });
  }
  if (league.length === 0 || league.length > 200) {
    return responseJson({
      status: 400,
      body: { error: "Missing or invalid 'league' parameter" },
      headers: CORS_HEADERS,
    });
  }
  if (card.length > 200) {
    return responseJson({
      status: 400,
      body: { error: "Invalid 'card' parameter" },
      headers: CORS_HEADERS,
    });
  }

  const { data, error } = card
    ? await supabase.rpc("get_community_drop_context", {
        p_game: game,
        p_league: league,
        p_card_name: card,
        p_min_contributors: MIN_CONTRIBUTORS,
      })
    : await supabase.rpc("get_community_league_drop_context", {
        p_game: game,
        p_league: league,
        p_min_contributors: MIN_CONTRIBUTORS,
      });
  if (error || !data || typeof data !== "object") {
    console.error(
      "[get-community-drop-context] Aggregation failed:",
      error ?? data,
    );
    return responseJson({
      status: 500,
      body: { error: "Failed to aggregate community drop context" },
      headers: CORS_HEADERS,
    });
  }
  if ((data as { found?: unknown }).found !== true) {
    return responseJson({
      status: 404,
      body: {
        error:
          (data as { reason?: unknown }).reason === "card_not_found"
            ? "Card not found"
            : (data as { reason?: unknown }).reason === "league_not_found"
              ? "League not found"
              : "Community drop context not found",
      },
      headers: CORS_HEADERS,
    });
  }

  return responseJson({
    status: 200,
    body: data,
    headers: { ...CORS_HEADERS, "Cache-Control": "public, max-age=300" },
  });
});
