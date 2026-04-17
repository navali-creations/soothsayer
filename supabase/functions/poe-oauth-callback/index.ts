import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { enforceRateLimitByIdentifier } from "../_shared/utils.ts";

/**
 * GGG OAuth Confidential Client Proxy
 *
 * Acts as the OAuth confidential client so the Electron app never needs the
 * client_secret. Handles:
 *   - GET  ?action=authorize   → 302 to GGG authorize URL
 *   - GET  ?code=...&state=... → 302 to wraeclast.cards/soothsayer/auth relay page
 *   - GET  ?error=...          → 302 to relay page with error params
 *   - POST ?action=exchange    → Token exchange with GGG
 *   - POST ?action=refresh     → Token refresh with GGG
 *
 * The relay page (hosted at wraeclast.cards) triggers the soothsayer://
 * custom protocol deep link, shows a success/error message, and attempts
 * to close the browser tab.
 *
 * Supabase rewrites text/html to text/plain on GET, so all GET responses
 * are either 302 redirects or JSON.
 */

const GGG_OAUTH_BASE = "https://www.pathofexile.com/oauth";
const AUTH_RELAY_BASE = "https://wraeclast.cards/soothsayer/auth";
const GGG_CLIENT_ID = Deno.env.get("GGG_OAUTH_CLIENT_ID") || "";
const GGG_CLIENT_SECRET = Deno.env.get("GGG_OAUTH_CLIENT_SECRET") || "";
const FUNCTION_TIMEOUT_MS = 10_000;

// The public-facing URL of this edge function, used as the OAuth redirect_uri.
// Deno.env.get("SUPABASE_URL") is auto-set by Supabase to the project's public URL.
const FUNCTION_URL = `${Deno.env.get(
  "SUPABASE_URL",
)}/functions/v1/poe-oauth-callback`;

function jsonResponse(body: Record<string, unknown>, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── GET handlers ────────────────────────────────────────────────────────────

function handleAuthorize(url: URL): Response {
  const codeChallenge = url.searchParams.get("code_challenge");
  const codeChallengeMethod =
    url.searchParams.get("code_challenge_method") || "S256";
  const state = url.searchParams.get("state");
  const ALLOWED_SCOPES = new Set(["account:profile"]);
  const requestedScope = url.searchParams.get("scope") || "account:profile";
  const scope = ALLOWED_SCOPES.has(requestedScope)
    ? requestedScope
    : "account:profile";

  if (!codeChallenge || !state) {
    return jsonResponse(
      { error: "Missing required parameters: code_challenge and state" },
      400,
    );
  }

  const params = new URLSearchParams({
    client_id: GGG_CLIENT_ID,
    response_type: "code",
    scope,
    state,
    redirect_uri: FUNCTION_URL,
    code_challenge: codeChallenge,
    code_challenge_method: codeChallengeMethod,
  });

  return new Response(null, {
    status: 302,
    headers: { Location: `${GGG_OAUTH_BASE}/authorize?${params.toString()}` },
  });
}

function handleGggCallback(url: URL): Response {
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return jsonResponse(
      { error: "Missing required parameters: code and state" },
      400,
    );
  }

  const redirectUrl = `${AUTH_RELAY_BASE}?code=${encodeURIComponent(
    code,
  )}&state=${encodeURIComponent(state)}`;

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
}

function handleGggError(url: URL): Response {
  const error = url.searchParams.get("error") || "unknown_error";
  const errorDescription =
    url.searchParams.get("error_description") || "Unknown error";

  // Redirect to relay page with error info — the page will forward to the app's custom protocol
  const redirectUrl = `${AUTH_RELAY_BASE}?error=${encodeURIComponent(
    error,
  )}&error_description=${encodeURIComponent(errorDescription)}`;

  return new Response(null, {
    status: 302,
    headers: { Location: redirectUrl },
  });
}

// ─── POST handlers ───────────────────────────────────────────────────────────

async function handleTokenExchange(
  body: Record<string, string>,
): Promise<Response> {
  const { code, code_verifier } = body;

  if (!code || !code_verifier) {
    return jsonResponse(
      { error: "Missing required fields: code, code_verifier" },
      400,
    );
  }

  if (!GGG_CLIENT_SECRET) {
    console.error(
      "[poe-oauth-callback] GGG_OAUTH_CLIENT_SECRET not configured",
    );
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  // The redirect_uri for the token exchange must match what was sent to /authorize.
  const tokenBody = new URLSearchParams({
    client_id: GGG_CLIENT_ID,
    client_secret: GGG_CLIENT_SECRET,
    grant_type: "authorization_code",
    code,
    redirect_uri: FUNCTION_URL,
    scope: "account:profile",
    code_verifier,
  });

  try {
    const response = await fetch(`${GGG_OAUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": `OAuth soothsayer/edge-function (contact: soothsayer.app)`,
      },
      body: tokenBody.toString(),
      signal: AbortSignal.timeout(FUNCTION_TIMEOUT_MS),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `[poe-oauth-callback] Token exchange failed (${response.status}):`,
        responseText,
      );
      return jsonResponse(
        {
          error: "token_exchange_failed",
          detail:
            "Upstream token exchange returned an error. Check server logs.",
        },
        response.status,
      );
    }

    // Return the token response as-is to the app
    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[poe-oauth-callback] Token exchange error:", error);
    return jsonResponse({ error: "Token exchange request failed" }, 502);
  }
}

async function handleTokenRefresh(
  body: Record<string, string>,
): Promise<Response> {
  const { refresh_token } = body;

  if (!refresh_token) {
    return jsonResponse(
      { error: "Missing required field: refresh_token" },
      400,
    );
  }

  if (!GGG_CLIENT_SECRET) {
    console.error(
      "[poe-oauth-callback] GGG_OAUTH_CLIENT_SECRET not configured",
    );
    return jsonResponse({ error: "Server configuration error" }, 500);
  }

  const tokenBody = new URLSearchParams({
    client_id: GGG_CLIENT_ID,
    client_secret: GGG_CLIENT_SECRET,
    grant_type: "refresh_token",
    refresh_token,
  });

  try {
    const response = await fetch(`${GGG_OAUTH_BASE}/token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": `OAuth soothsayer/edge-function (contact: soothsayer.app)`,
      },
      body: tokenBody.toString(),
      signal: AbortSignal.timeout(FUNCTION_TIMEOUT_MS),
    });

    const responseText = await response.text();

    if (!response.ok) {
      console.error(
        `[poe-oauth-callback] Token refresh failed (${response.status}):`,
        responseText,
      );
      return jsonResponse(
        {
          error: "token_refresh_failed",
          detail:
            "Upstream token refresh returned an error. Check server logs.",
        },
        response.status,
      );
    }

    return new Response(responseText, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[poe-oauth-callback] Token refresh error:", error);
    return jsonResponse({ error: "Token refresh request failed" }, 502);
  }
}

// ─── Main handler ────────────────────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers":
          "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      },
    });
  }

  const url = new URL(req.url);

  // ─── POST: token exchange or refresh (called by the Electron app) ──────────
  if (req.method === "POST") {
    // M1: Require apikey header on POST endpoints
    const apiKey = req.headers.get("apikey");
    if (!apiKey) {
      return jsonResponse({ error: "Missing apikey header" }, 401);
    }

    // M1: IP-based rate limiting for POST endpoints (10 req / 5 min / IP)
    // Privacy-first: hash the IP with SHA-256 so the raw address is never stored.
    // Same IP always produces the same hash, so rate limiting works identically.
    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const ipHashBuffer = await crypto.subtle.digest(
      "SHA-256",
      new TextEncoder().encode(clientIp),
    );
    const ipHash = [...new Uint8Array(ipHashBuffer)]
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const identifier = `oauth-proxy:${ipHash}`;

    try {
      await enforceRateLimitByIdentifier({
        identifier,
        endpoint: "poe-oauth-callback",
        windowMs: 5 * 60 * 1000, // 5-minute window
        maxHits: 10, // 10 requests per 5 minutes per IP
      });
    } catch (error) {
      const status = (error as any).status;
      if (status === 429) {
        return jsonResponse(
          { error: "Rate limit exceeded. Try again later." },
          429,
        );
      }
      if (status === 403) {
        return jsonResponse(
          { error: (error as Error).message || "Forbidden" },
          403,
        );
      }
      console.error("[poe-oauth-callback] Rate limit check failed:", error);
      return jsonResponse({ error: "Internal server error" }, 500);
    }

    let body: Record<string, string>;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: "Invalid JSON body" }, 400);
    }

    const action = url.searchParams.get("action");

    if (action === "exchange") {
      return handleTokenExchange(body);
    }

    if (action === "refresh") {
      return handleTokenRefresh(body);
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);
  }

  // ─── GET: authorize redirect or GGG callback ──────────────────────────────
  if (req.method === "GET") {
    const action = url.searchParams.get("action");

    // Step 1: App initiates auth → redirect to GGG
    if (action === "authorize") {
      return handleAuthorize(url);
    }

    // GGG error callback
    if (url.searchParams.has("error")) {
      return handleGggError(url);
    }

    // Step 2: GGG callback → relay code to app via custom protocol
    if (url.searchParams.has("code") && url.searchParams.has("state")) {
      return handleGggCallback(url);
    }

    return jsonResponse({ error: "Missing required parameters" }, 400);
  }

  return jsonResponse({ error: "Method not allowed" }, 405);
});
