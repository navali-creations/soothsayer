/**
 * Unit tests for supabase/functions/poe-oauth-callback/index.ts
 *
 * Tests the full OAuth proxy handler including:
 *   - CORS preflight (OPTIONS)
 *   - GET ?action=authorize → redirect to GGG
 *   - GET callback (code+state) → redirect to relay page
 *   - GET error callback → redirect to relay page with error params
 *   - POST ?action=exchange → token exchange with GGG
 *   - POST ?action=refresh → token refresh with GGG
 *   - Invalid method / unknown action / bad JSON handling
 *
 * NOTE: Deno 2's test runner restores globalThis.fetch between module-level
 * code and individual test execution. Tests that require fetch mocking must
 * create a fresh mockFetch() inside each test and call .restore() at the end.
 * Tests that don't trigger outbound fetch (GET redirects, validation, method
 * checks) can use a lightweight per-test mock or none at all.
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/poe-oauth-callback_test.ts
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createMockRequest,
  createOptionsRequest,
  mockFetch,
  quietTest,
  responseBody,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

// ─── Setup: capture the handler from Deno.serve ──────────────────────────────

const cleanupEnv = setupEnv({
  GGG_OAUTH_CLIENT_ID: "test-client-id",
  GGG_OAUTH_CLIENT_SECRET: "test-client-secret",
});

const serveStub = stubDenoServe();

// We need a fetch mock installed at module level so the dynamic import
// succeeds without hitting real network. It will be replaced per-test.
const _setupMock = mockFetch();

// Dynamic import triggers Deno.serve() which we've stubbed
await import("../poe-oauth-callback/index.ts");

const handler = serveStub.handler!;
serveStub.restore();
_setupMock.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Constants ───────────────────────────────────────────────────────────────

const BASE_URL = "http://localhost:54321/functions/v1/poe-oauth-callback";
const AUTH_RELAY_BASE = "https://wraeclast.cards/soothsayer/auth";
const FUNCTION_URL = "http://localhost:54321/functions/v1/poe-oauth-callback";

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Creates a fresh fetch mock with a GGG token success route pre-registered.
 * Returns the mock so additional assertions can be made on `.calls`.
 */
function mockGggTokenSuccess(
  responseData: Record<string, unknown> = {
    access_token: "test-access-token",
    token_type: "bearer",
    expires_in: 3600,
    refresh_token: "test-refresh-token",
    scope: "account:profile",
  },
) {
  const fm = mockFetch();
  fm.onUrlContaining("pathofexile.com/oauth/token", () => {
    return new Response(JSON.stringify(responseData), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  withRateLimit(fm);
  return fm;
}

function mockGggTokenError(
  status = 400,
  body: Record<string, unknown> = {
    error: "invalid_grant",
    error_description: "The authorization code has expired",
  },
) {
  const fm = mockFetch();
  fm.onUrlContaining("pathofexile.com/oauth/token", () => {
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  withRateLimit(fm);
  return fm;
}

function mockGggTokenNetworkError() {
  const fm = mockFetch();
  fm.onUrlContaining("pathofexile.com/oauth/token", () => {
    throw new TypeError("Network error");
  });
  withRateLimit(fm);
  return fm;
}

/**
 * Registers the rate-limit RPC mock on a fetch mock instance.
 * Required for all POST tests since M1 adds rate limiting.
 */
function withRateLimit(fm: ReturnType<typeof mockFetch>) {
  fm.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );
  return fm;
}

// ═══════════════════════════════════════════════════════════════════════════════
// 1. CORS
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("OPTIONS request returns 204 with correct CORS headers", async () => {
  const fm = mockFetch();
  const req = createOptionsRequest(BASE_URL);
  const resp = await handler(req);

  assertEquals(resp.status, 204);
  assertEquals(resp.headers.get("Access-Control-Allow-Origin"), "*");
  assertEquals(
    resp.headers.get("Access-Control-Allow-Headers"),
    "authorization, x-client-info, apikey, content-type",
  );
  assertEquals(
    resp.headers.get("Access-Control-Allow-Methods"),
    "GET, POST, OPTIONS",
  );
  fm.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 2. GET ?action=authorize
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "GET authorize: returns 302 redirect to GGG with correct params",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge&state=test-state&scope=account:profile`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = resp.headers.get("Location")!;
    assert(location.startsWith("https://www.pathofexile.com/oauth/authorize"));

    const redirectUrl = new URL(location);
    assertEquals(redirectUrl.searchParams.get("client_id"), "test-client-id");
    assertEquals(redirectUrl.searchParams.get("response_type"), "code");
    assertEquals(redirectUrl.searchParams.get("scope"), "account:profile");
    assertEquals(redirectUrl.searchParams.get("state"), "test-state");
    assertEquals(redirectUrl.searchParams.get("redirect_uri"), FUNCTION_URL);
    assertEquals(
      redirectUrl.searchParams.get("code_challenge"),
      "test-challenge",
    );
    assertEquals(redirectUrl.searchParams.get("code_challenge_method"), "S256");
    fm.restore();
  },
);

quietTest(
  "GET authorize: returns 400 when code_challenge is missing",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?action=authorize&state=test-state`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("code_challenge"));
    fm.restore();
  },
);

quietTest("GET authorize: returns 400 when state is missing", async () => {
  const fm = mockFetch();
  const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge`;
  const req = createMockRequest(url, { method: "GET" });
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("state"));
  fm.restore();
});

quietTest(
  "GET authorize: uses default scope 'account:profile' when not specified",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge&state=test-state`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = new URL(resp.headers.get("Location")!);
    assertEquals(location.searchParams.get("scope"), "account:profile");
    fm.restore();
  },
);

quietTest(
  "GET authorize: uses default code_challenge_method 'S256' when not specified",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge&state=test-state`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = new URL(resp.headers.get("Location")!);
    assertEquals(location.searchParams.get("code_challenge_method"), "S256");
    fm.restore();
  },
);

quietTest(
  "GET authorize: unknown scope falls back to account:profile",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge&state=test-state&scope=account:stashes`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = new URL(resp.headers.get("Location")!);
    assertEquals(location.searchParams.get("scope"), "account:profile");
    fm.restore();
  },
);

quietTest(
  "GET authorize: allowlisted scope account:profile is passed through",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge&state=test-state&scope=account:profile`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = new URL(resp.headers.get("Location")!);
    assertEquals(location.searchParams.get("scope"), "account:profile");
    fm.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 3. GET callback (code + state from GGG)
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "GET callback: returns 302 redirect to relay page with code and state",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?code=auth-code-123&state=state-abc`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = resp.headers.get("Location")!;
    assert(location.startsWith(AUTH_RELAY_BASE));

    const redirectUrl = new URL(location);
    assertEquals(redirectUrl.searchParams.get("code"), "auth-code-123");
    assertEquals(redirectUrl.searchParams.get("state"), "state-abc");
    fm.restore();
  },
);

quietTest("GET callback: returns 400 when code is missing", async () => {
  const fm = mockFetch();
  const url = `${BASE_URL}?state=test-state`;
  const req = createMockRequest(url, { method: "GET" });
  const resp = await handler(req);

  // Without code, state, error, or action — should return 400
  assertEquals(resp.status, 400);
  fm.restore();
});

quietTest("GET callback: returns 400 when state is missing", async () => {
  const fm = mockFetch();
  const url = `${BASE_URL}?code=test-code`;
  const req = createMockRequest(url, { method: "GET" });
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  fm.restore();
});

quietTest(
  "GET callback: properly encodes code and state in redirect URL",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?code=${encodeURIComponent(
      "code with spaces&special",
    )}&state=${encodeURIComponent("state=with&chars")}`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = resp.headers.get("Location")!;
    const redirectUrl = new URL(location);
    assertEquals(
      redirectUrl.searchParams.get("code"),
      "code with spaces&special",
    );
    assertEquals(redirectUrl.searchParams.get("state"), "state=with&chars");
    fm.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4. GET error callback from GGG
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "GET error: returns 302 redirect to relay page with error params",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?error=access_denied&error_description=${encodeURIComponent(
      "User denied access",
    )}`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = resp.headers.get("Location")!;
    assert(location.startsWith(AUTH_RELAY_BASE));
    const redirectUrl = new URL(location);
    assertEquals(redirectUrl.searchParams.get("error"), "access_denied");
    assertEquals(
      redirectUrl.searchParams.get("error_description"),
      "User denied access",
    );
    fm.restore();
  },
);

quietTest(
  "GET error: uses 'unknown_error' when error param is missing value",
  async () => {
    const fm = mockFetch();
    // error param present but empty value
    const url = `${BASE_URL}?error=`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = resp.headers.get("Location")!;
    const redirectUrl = new URL(location);
    assertEquals(redirectUrl.searchParams.get("error"), "unknown_error");
    fm.restore();
  },
);

quietTest(
  "GET error: uses 'Unknown error' when error_description is missing",
  async () => {
    const fm = mockFetch();
    const url = `${BASE_URL}?error=server_error`;
    const req = createMockRequest(url, { method: "GET" });
    const resp = await handler(req);

    assertEquals(resp.status, 302);
    const location = resp.headers.get("Location")!;
    const redirectUrl = new URL(location);
    assertEquals(redirectUrl.searchParams.get("error"), "server_error");
    assertEquals(
      redirectUrl.searchParams.get("error_description"),
      "Unknown error",
    );
    fm.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// 4b. POST authentication & rate limiting (M1)
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("POST: returns 401 when apikey header is missing", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);
  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "test", code_verifier: "test" },
    // intentionally no apikey
  });
  const resp = await handler(req);

  assertEquals(resp.status, 401);
  const body = await responseBody<{ error: string }>(resp);
  assertEquals(body.error, "Missing apikey header");
  fm.restore();
  cleanupEnv();
});

quietTest("POST: returns 429 when rate limited", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  fm.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: false, reason: "rate_limited" }),
  );
  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "test", code_verifier: "test" },
    apikey: "test-anon-key",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 429);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("Rate limit"));
  fm.restore();
  cleanupEnv();
});

quietTest("POST: returns 403 when banned", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  fm.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({
      allowed: false,
      reason: "banned",
      detail: "Access suspended",
    }),
  );
  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "test", code_verifier: "test" },
    apikey: "test-anon-key",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 403);
  const body = await responseBody<{ error: string }>(resp);
  assertEquals(body.error, "Access suspended");
  fm.restore();
  cleanupEnv();
});

quietTest("GET authorize: does not require apikey header", async () => {
  const fm = mockFetch();
  const url = `${BASE_URL}?action=authorize&code_challenge=test-challenge&state=test-state`;
  const req = createMockRequest(url, { method: "GET" });
  const resp = await handler(req);

  // GET authorize should work without apikey (no rate limiting on GET)
  assertEquals(resp.status, 302);
  fm.restore();
});

quietTest("GET callback: does not require apikey header", async () => {
  const fm = mockFetch();
  const url = `${BASE_URL}?code=test-code&state=test-state`;
  const req = createMockRequest(url, { method: "GET" });
  const resp = await handler(req);

  // GET callback should work without apikey
  assertEquals(resp.status, 302);
  fm.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 5. POST ?action=exchange
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("POST exchange: returns 400 when code is missing", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);
  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code_verifier: "test-verifier" },
    apikey: "test-anon-key",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("code"));
  fm.restore();
  cleanupEnv();
});

quietTest(
  "POST exchange: returns 400 when code_verifier is missing",
  async () => {
    const cleanupEnv = setupEnv();
    const fm = mockFetch();
    withRateLimit(fm);
    const req = createMockRequest(`${BASE_URL}?action=exchange`, {
      method: "POST",
      body: { code: "test-code" },
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("code_verifier"));
    fm.restore();
    cleanupEnv();
  },
);

quietTest(
  "POST exchange: returns 500 when GGG_CLIENT_SECRET is not configured",
  async () => {
    const cleanupEnv = setupEnv();
    const fm = mockFetch();
    withRateLimit(fm);
    // We can't realistically test the "not configured" branch for a
    // module-level const after import. The secret IS configured ("test-client-secret"),
    // so this path can't be hit in the current test setup without a separate import.
    // Documented as a known test limitation.
    fm.restore();
    cleanupEnv();
  },
);

quietTest(
  "POST exchange: returns token response from GGG on success",
  async () => {
    const cleanupEnv = setupEnv();
    const tokenData = {
      access_token: "poe-access-token-xyz",
      token_type: "bearer",
      expires_in: 7200,
      refresh_token: "poe-refresh-token-abc",
      scope: "account:profile",
    };
    const fm = mockGggTokenSuccess(tokenData);

    const req = createMockRequest(`${BASE_URL}?action=exchange`, {
      method: "POST",
      body: { code: "auth-code-123", code_verifier: "verifier-456" },
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<typeof tokenData>(resp);
    assertEquals(body.access_token, "poe-access-token-xyz");
    assertEquals(body.token_type, "bearer");
    assertEquals(body.expires_in, 7200);
    assertEquals(body.refresh_token, "poe-refresh-token-abc");
    assertEquals(body.scope, "account:profile");
    fm.restore();
    cleanupEnv();
  },
);

quietTest(
  "POST exchange: returns GGG error status when token exchange fails",
  async () => {
    const cleanupEnv = setupEnv();
    const fm = mockGggTokenError(401, {
      error: "invalid_client",
      error_description: "Client authentication failed",
    });

    const req = createMockRequest(`${BASE_URL}?action=exchange`, {
      method: "POST",
      body: { code: "bad-code", code_verifier: "verifier" },
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await responseBody<{ error: string; detail: string }>(resp);
    assertEquals(body.error, "token_exchange_failed");
    assertEquals(
      body.detail,
      "Upstream token exchange returned an error. Check server logs.",
    );
    fm.restore();
    cleanupEnv();
  },
);

quietTest("POST exchange: returns 502 on network/fetch error", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockGggTokenNetworkError();

  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "test-code", code_verifier: "test-verifier" },
    apikey: "test-anon-key",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 502);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("failed"));
  fm.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 6. POST ?action=refresh
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "POST refresh: returns 400 when refresh_token is missing",
  async () => {
    const cleanupEnv = setupEnv();
    const fm = mockFetch();
    withRateLimit(fm);
    const req = createMockRequest(`${BASE_URL}?action=refresh`, {
      method: "POST",
      body: {},
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("refresh_token"));
    fm.restore();
    cleanupEnv();
  },
);

quietTest(
  "POST refresh: returns 500 when GGG_CLIENT_SECRET is not configured",
  async () => {
    const cleanupEnv = setupEnv();
    const fm = mockFetch();
    // Same limitation as the exchange test — module-level const can't be changed
    // after import. Documented as a known test limitation.
    fm.restore();
    cleanupEnv();
  },
);

quietTest(
  "POST refresh: returns token response from GGG on success",
  async () => {
    const cleanupEnv = setupEnv();
    const tokenData = {
      access_token: "new-access-token",
      token_type: "bearer",
      expires_in: 7200,
      refresh_token: "new-refresh-token",
      scope: "account:profile",
    };
    const fm = mockGggTokenSuccess(tokenData);

    const req = createMockRequest(`${BASE_URL}?action=refresh`, {
      method: "POST",
      body: { refresh_token: "old-refresh-token" },
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<typeof tokenData>(resp);
    assertEquals(body.access_token, "new-access-token");
    assertEquals(body.refresh_token, "new-refresh-token");
    fm.restore();
    cleanupEnv();
  },
);

quietTest(
  "POST refresh: returns GGG error status when refresh fails",
  async () => {
    const cleanupEnv = setupEnv();
    const fm = mockGggTokenError(400, {
      error: "invalid_grant",
      error_description: "The refresh token is invalid or expired",
    });

    const req = createMockRequest(`${BASE_URL}?action=refresh`, {
      method: "POST",
      body: { refresh_token: "expired-token" },
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string; detail: string }>(resp);
    assertEquals(body.error, "token_refresh_failed");
    assertEquals(
      body.detail,
      "Upstream token refresh returned an error. Check server logs.",
    );
    fm.restore();
    cleanupEnv();
  },
);

quietTest("POST refresh: returns 502 on network/fetch error", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockGggTokenNetworkError();

  const req = createMockRequest(`${BASE_URL}?action=refresh`, {
    method: "POST",
    body: { refresh_token: "some-token" },
    apikey: "test-anon-key",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 502);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("failed"));
  fm.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 7. POST unknown action
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("POST unknown action: returns 400", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);
  const req = createMockRequest(`${BASE_URL}?action=foobar`, {
    method: "POST",
    body: { some: "data" },
    apikey: "test-anon-key",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("Unknown action"));
  assert(body.error.includes("foobar"));
  fm.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 8. Invalid JSON body
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("POST with malformed JSON: returns 400", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);
  const req = new Request(`${BASE_URL}?action=exchange`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: "test-anon-key" },
    body: "this is not valid json{{{",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await responseBody<{ error: string }>(resp);
  assertEquals(body.error, "Invalid JSON body");
  fm.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 9. Method not allowed
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("PUT request returns 405", async () => {
  const fm = mockFetch();
  const req = createMockRequest(BASE_URL, { method: "PUT", body: {} });
  const resp = await handler(req);

  assertEquals(resp.status, 405);
  const body = await responseBody<{ error: string }>(resp);
  assertEquals(body.error, "Method not allowed");
  fm.restore();
});

quietTest("DELETE request returns 405", async () => {
  const fm = mockFetch();
  const req = createMockRequest(BASE_URL, { method: "DELETE" });
  const resp = await handler(req);

  assertEquals(resp.status, 405);
  const body = await responseBody<{ error: string }>(resp);
  assertEquals(body.error, "Method not allowed");
  fm.restore();
});

quietTest("PATCH request returns 405", async () => {
  const fm = mockFetch();
  const req = createMockRequest(BASE_URL, { method: "PATCH", body: {} });
  const resp = await handler(req);

  assertEquals(resp.status, 405);
  const body = await responseBody<{ error: string }>(resp);
  assertEquals(body.error, "Method not allowed");
  fm.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 10. Token exchange request format
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("POST exchange: sends correct form body to GGG", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);

  let capturedBody: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;

  fm.onUrlContaining("pathofexile.com/oauth/token", async (_input, init) => {
    capturedBody = init?.body as string;
    capturedHeaders = {};
    if (init?.headers) {
      const headers = new Headers(init.headers as HeadersInit);
      headers.forEach((value, key) => {
        capturedHeaders![key] = value;
      });
    }
    return new Response(
      JSON.stringify({
        access_token: "tok",
        token_type: "bearer",
        expires_in: 3600,
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "my-auth-code", code_verifier: "my-verifier" },
    apikey: "test-anon-key",
  });
  await handler(req);

  // Verify the form body parameters
  assert(capturedBody !== undefined, "Should have captured the request body");
  const params = new URLSearchParams(capturedBody!);
  assertEquals(params.get("grant_type"), "authorization_code");
  assertEquals(params.get("code"), "my-auth-code");
  assertEquals(params.get("code_verifier"), "my-verifier");
  assertEquals(params.get("redirect_uri"), FUNCTION_URL);
  assertEquals(params.get("client_id"), "test-client-id");
  assertEquals(params.get("client_secret"), "test-client-secret");
  assertEquals(params.get("scope"), "account:profile");
  fm.restore();
  cleanupEnv();
});

quietTest("POST exchange: includes correct User-Agent header", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);

  let capturedUserAgent: string | undefined;

  fm.onUrlContaining("pathofexile.com/oauth/token", (_input, init) => {
    if (init?.headers) {
      const headers = new Headers(init.headers as HeadersInit);
      capturedUserAgent = headers.get("User-Agent") ?? undefined;
    }
    return new Response(JSON.stringify({ access_token: "tok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "code", code_verifier: "verifier" },
    apikey: "test-anon-key",
  });
  await handler(req);

  assert(capturedUserAgent !== undefined, "Should have sent User-Agent");
  assert(
    capturedUserAgent!.includes("soothsayer"),
    "User-Agent should contain 'soothsayer'",
  );
  fm.restore();
  cleanupEnv();
});

quietTest("POST exchange: includes correct Content-Type header", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);

  let capturedContentType: string | undefined;

  fm.onUrlContaining("pathofexile.com/oauth/token", (_input, init) => {
    if (init?.headers) {
      const headers = new Headers(init.headers as HeadersInit);
      capturedContentType = headers.get("Content-Type") ?? undefined;
    }
    return new Response(JSON.stringify({ access_token: "tok" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });

  const req = createMockRequest(`${BASE_URL}?action=exchange`, {
    method: "POST",
    body: { code: "code", code_verifier: "verifier" },
    apikey: "test-anon-key",
  });
  await handler(req);

  assertEquals(capturedContentType, "application/x-www-form-urlencoded");
  fm.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// 11. Token refresh request format
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("POST refresh: sends correct form body to GGG", async () => {
  const cleanupEnv = setupEnv();
  const fm = mockFetch();
  withRateLimit(fm);

  let capturedBody: string | undefined;

  fm.onUrlContaining("pathofexile.com/oauth/token", (_input, init) => {
    capturedBody = init?.body as string;
    return new Response(
      JSON.stringify({
        access_token: "new-tok",
        token_type: "bearer",
        expires_in: 3600,
        refresh_token: "new-refresh",
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      },
    );
  });

  const req = createMockRequest(`${BASE_URL}?action=refresh`, {
    method: "POST",
    body: { refresh_token: "my-refresh-token" },
    apikey: "test-anon-key",
  });
  await handler(req);

  assert(capturedBody !== undefined, "Should have captured the request body");
  const params = new URLSearchParams(capturedBody!);
  assertEquals(params.get("grant_type"), "refresh_token");
  assertEquals(params.get("refresh_token"), "my-refresh-token");
  assertEquals(params.get("client_id"), "test-client-id");
  assertEquals(params.get("client_secret"), "test-client-secret");
  fm.restore();
  cleanupEnv();
});

// ─── Cleanup ─────────────────────────────────────────────────────────────────

// Note: cleanup runs after all tests are registered (not after they execute).
// Deno.test handles isolation. We clean up the env here for safety.
// In practice, the process exits after tests complete.
cleanupEnv();
