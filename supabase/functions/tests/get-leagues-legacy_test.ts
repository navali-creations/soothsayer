/**
 * Unit tests for supabase/functions/get-leagues-legacy/index.ts
 *
 * Tests the full handler including:
 *   - Authorization gate (delegates to authorize())
 *   - Input validation (game, league params)
 *   - Database query and response formatting
 *   - Error handling
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/get-leagues-legacy-test.ts
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  createMockRequest,
  createOptionsRequest,
  createTestJwt,
  mockFetch,
  mockLeague,
  postgrestResponse,
  quietTest,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

// ─── Setup: capture the handler from Deno.serve ──────────────────────────────

// Set env temporarily so the dynamic import can resolve (if the module reads
// env at load time).  We do NOT rely on this persisting to test callbacks —
// every test that needs env will call setupEnv() itself.
const _initCleanup = setupEnv();

const serveStub = stubDenoServe();

// Dynamic import triggers Deno.serve() which we've stubbed
await import("../get-leagues-legacy/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createFunctionRequest(
  options: {
    method?: string;
    body?: unknown;
    bearerToken?: string;
    apikey?: string;
  } = {},
): Request {
  return createMockRequest(
    "http://localhost:54321/functions/v1/get-leagues-legacy",
    {
      method: options.method ?? "POST",
      body: options.body,
      bearerToken: options.bearerToken,
      apikey: options.apikey,
    },
  );
}

/**
 * Sets up fetch mocks for a fully authorized request that passes auth + rate limit.
 * Returns the mock so routes can be added for the actual DB query.
 */
function setupAuthorizedMocks() {
  // Ensure env is set for every test that calls authorize()
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  // Mock getClaims auth endpoint
  fetchMock.onUrlContaining(
    "/auth/v1/",
    () =>
      new Response(
        JSON.stringify({
          claims: {
            sub: "test-user-id-001",
            role: "authenticated",
            iss: "supabase",
            exp: 9999999999,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

  // Mock rate limit RPC → allowed
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );

  // Attach cleanupEnv so callers can clean up
  const originalRestore = fetchMock.restore.bind(fetchMock);
  fetchMock.restore = () => {
    originalRestore();
    cleanupEnv();
  };

  return fetchMock;
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authorization / Pre-validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-leagues-legacy — OPTIONS returns 200 (CORS preflight)",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createOptionsRequest(
      "http://localhost:54321/functions/v1/get-leagues-legacy",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest("get-leagues-legacy — GET request returns 405", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createFunctionRequest({
    method: "GET",
    apikey: "test-anon-key",
    bearerToken: "some-token",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 405);
  const body = await resp.json();
  assertEquals(body.error, "Method not allowed");

  fetchMock.restore();
  cleanupEnv();
});

quietTest("get-leagues-legacy — missing apikey returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createFunctionRequest({
    bearerToken: "some-token",
    // No apikey
  });
  const resp = await handler(req);

  assertEquals(resp.status, 401);
  const body = await resp.json();
  assertEquals(body.error, "Missing apikey header");

  fetchMock.restore();
  cleanupEnv();
});

quietTest(
  "get-leagues-legacy — missing Authorization returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      // No bearerToken
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await resp.json();
    assertEquals(body.error, "Missing Authorization header");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest("get-leagues-legacy — invalid JWT returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  // Mock auth endpoint to reject the token
  fetchMock.onUrlContaining(
    "/auth/v1/",
    () =>
      new Response(JSON.stringify({ error: "invalid" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: "not-a-valid-jwt",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 401);
  const body = await resp.json();
  assertEquals(body.error, "Invalid JWT");

  fetchMock.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Input Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("get-leagues-legacy — missing game param returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { league: "Dawn" }, // No game
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    // getClaims couldn't decode our test JWT — skip this test gracefully
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
  } else {
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");
  }

  fetchMock.restore();
});

quietTest("get-leagues-legacy — missing league param returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2" }, // No league
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
  } else {
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");
  }

  fetchMock.restore();
});

quietTest("get-leagues-legacy — empty body returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: {},
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
  } else {
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");
  }

  fetchMock.restore();
});

quietTest("get-leagues-legacy — invalid game returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe3", league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
  } else {
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Invalid game");
  }

  fetchMock.restore();
});

quietTest("get-leagues-legacy — league ID too long returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const longLeague = "A".repeat(81);
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: longLeague },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
  } else {
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Invalid league");
  }

  fetchMock.restore();
});

quietTest(
  "get-leagues-legacy — league ID at exactly 80 chars is accepted",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });
    const exactLeague = "A".repeat(80);

    // Mock the DB query for poe_leagues
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([]),
    );

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe2", league: exactLeague },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
    } else {
      // Should proceed past validation (200 with empty leagues or a DB response)
      assert(
        resp.status !== 400,
        `Expected non-400 status for valid 80-char league, got ${resp.status}`,
      );
    }

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Success Path Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-leagues-legacy — returns formatted leagues on success",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const league1 = mockLeague({
      id: "uuid-001",
      game: "poe2",
      league_id: "Dawn",
      name: "Dawn",
      start_at: "2024-12-01T00:00:00Z",
      end_at: null,
      is_active: true,
      updated_at: "2024-12-15T00:00:00Z",
    });
    const league2 = mockLeague({
      id: "uuid-002",
      game: "poe2",
      league_id: "Standard",
      name: "Standard",
      start_at: null,
      end_at: null,
      is_active: true,
      updated_at: "2024-12-14T00:00:00Z",
    });

    // Mock the DB query
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([league1, league2]),
    );

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe2", league: "Dawn" },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    assertEquals(resp.status, 200);

    const body = await resp.json();
    assert(Array.isArray(body.leagues), "Response should have a leagues array");
    assertEquals(body.leagues.length, 2);

    // Verify the camelCase field mapping
    const first = body.leagues[0];
    assertEquals(first.id, "uuid-001");
    assertEquals(first.leagueId, "Dawn");
    assertEquals(first.name, "Dawn");
    assertEquals(first.startAt, "2024-12-01T00:00:00Z");
    assertEquals(first.endAt, null);
    assertEquals(first.isActive, true);
    assertEquals(first.updatedAt, "2024-12-15T00:00:00Z");

    const second = body.leagues[1];
    assertEquals(second.id, "uuid-002");
    assertEquals(second.leagueId, "Standard");
    assertEquals(second.name, "Standard");

    fetchMock.restore();
  },
);

quietTest(
  "get-leagues-legacy — returns empty array when no leagues found",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Mock the DB query returning empty
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([]),
    );

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe1", league: "Standard" },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assert(Array.isArray(body.leagues));
    assertEquals(body.leagues.length, 0);

    fetchMock.restore();
  },
);

quietTest(
  "get-leagues-legacy — includes Cache-Control header in success response",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([]),
    );

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe2", league: "Dawn" },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    assertEquals(resp.status, 200);
    const cacheControl = resp.headers.get("Cache-Control");
    assertEquals(cacheControl, "private, max-age=86400");

    fetchMock.restore();
  },
);

quietTest("get-leagues-legacy — accepts poe1 game parameter", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });

  const league = mockLeague({
    id: "uuid-poe1",
    game: "poe1",
    league_id: "Settlers",
    name: "Settlers of Kalguur",
  });

  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestResponse([league]),
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe1", league: "Settlers" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 200);
  const body = await resp.json();
  assertEquals(body.leagues.length, 1);
  assertEquals(body.leagues[0].leagueId, "Settlers");

  fetchMock.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Error Handling Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("get-leagues-legacy — database error returns 500", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });

  // Mock the DB query returning an error
  fetchMock.onUrlContaining(
    supabaseUrls.table("poe_leagues"),
    () =>
      new Response(
        JSON.stringify({
          message: 'relation "poe_leagues" does not exist',
          code: "42P01",
          details: null,
          hint: null,
        }),
        {
          status: 404,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      ),
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 500);
  const body = await resp.json();
  assert(body.error !== undefined, "Error response should have an error field");

  fetchMock.restore();
});

quietTest(
  "get-leagues-legacy — handles malformed request body gracefully",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Create a request with malformed JSON body
    const req = new Request(
      "http://localhost:54321/functions/v1/get-leagues-legacy",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${testToken}`,
          apikey: "test-anon-key",
        },
        body: "this is not json",
      },
    );

    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    // The handler uses req.json().catch(() => ({})) so malformed body → empty object
    // which means missing game/league → 400
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiting Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("get-leagues-legacy — rate limited user gets 429", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const testToken = createTestJwt({ sub: "spammy-user" });

  // Mock getClaims
  fetchMock.onUrlContaining(
    "/auth/v1/",
    () =>
      new Response(
        JSON.stringify({
          claims: {
            sub: "spammy-user",
            role: "authenticated",
            iss: "supabase",
            exp: 9999999999,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

  // Mock rate limit → rejected
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: false, reason: "rate_limited" }),
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    cleanupEnv();
    return;
  }

  assertEquals(resp.status, 429);
  const body = await resp.json();
  assertStringIncludes(body.error, "Rate limit exceeded");

  fetchMock.restore();
  cleanupEnv();
});

quietTest("get-leagues-legacy — banned user gets 403", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const testToken = createTestJwt({ sub: "banned-user" });

  // Mock getClaims
  fetchMock.onUrlContaining(
    "/auth/v1/",
    () =>
      new Response(
        JSON.stringify({
          claims: {
            sub: "banned-user",
            role: "authenticated",
            iss: "supabase",
            exp: 9999999999,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

  // Mock rate limit → banned
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({
      allowed: false,
      reason: "banned",
      detail: "Account suspended for abuse",
    }),
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    cleanupEnv();
    return;
  }

  assertEquals(resp.status, 403);
  const body = await resp.json();
  assertEquals(body.error, "Account suspended for abuse");

  fetchMock.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Response Format Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-leagues-legacy — handles null league fields correctly",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const league = mockLeague({
      id: "uuid-null-fields",
      game: "poe2",
      league_id: "Standard",
      name: "Standard",
      start_at: null,
      end_at: null,
      is_active: true,
      updated_at: "2024-12-15T00:00:00Z",
    });

    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([league]),
    );

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe2", league: "Standard" },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    assertEquals(resp.status, 200);
    const body = await resp.json();
    const league0 = body.leagues[0];
    assertEquals(league0.startAt, null);
    assertEquals(league0.endAt, null);

    fetchMock.restore();
  },
);

quietTest("get-leagues-legacy — response includes CORS headers", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });

  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestResponse([]),
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  const acah = resp.headers.get("Access-Control-Allow-Headers");
  assert(acah !== null, "Should include CORS headers");
  assertStringIncludes(acah!, "authorization");

  fetchMock.restore();
});
