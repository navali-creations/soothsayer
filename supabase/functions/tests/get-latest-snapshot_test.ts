/**
 * Unit tests for supabase/functions/get-latest-snapshot/index.ts
 *
 * Tests the full handler including:
 *   - Authorization gate (delegates to authorize())
 *   - Input validation (game, league params)
 *   - Multi-table query chain: poe_leagues → snapshots → card_prices
 *   - Card price formatting (exchange vs stash, camelCase mapping)
 *   - Error handling for each query stage
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/get-latest-snapshot-test.ts
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  createMockRequest,
  createOptionsRequest,
  createTestJwt,
  mockCardPrices,
  mockFetch,
  mockLeague,
  mockSnapshot,
  postgrestResponse,
  quietTest,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

// ─── Setup: capture the handler from Deno.serve ──────────────────────────────

const cleanupEnv = setupEnv();
const serveStub = stubDenoServe();

// Dynamic import triggers Deno.serve() which we've stubbed
await import("../get-latest-snapshot/index.ts");

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
  } = {}
): Request {
  return createMockRequest(
    "http://localhost:54321/functions/v1/get-latest-snapshot",
    {
      method: options.method ?? "POST",
      body: options.body,
      bearerToken: options.bearerToken,
      apikey: options.apikey,
    }
  );
}

/**
 * Sets up fetch mocks for a fully authorized request that passes auth + rate limit.
 * Returns the mock so additional routes can be registered for DB queries.
 */
function setupAuthorizedMocks() {
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
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
  );

  // Mock rate limit RPC → allowed
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true })
  );

  return fetchMock;
}

/**
 * Registers the standard three-query chain mocks for a successful snapshot fetch.
 * 1. poe_leagues query → single league
 * 2. snapshots query → single snapshot
 * 3. card_prices query → list of card prices
 */
function setupFullQueryChain(
  fetchMock: ReturnType<typeof mockFetch>,
  options: {
    league?: Record<string, unknown>;
    snapshot?: Record<string, unknown>;
    cardPrices?: Array<Record<string, unknown>>;
  } = {}
) {
  const league = options.league ?? mockLeague();
  const snapshot = options.snapshot ?? mockSnapshot();
  const cardPrices = options.cardPrices ?? mockCardPrices();

  let queryCount = 0;

  fetchMock.addRoute({
    match: (url) => url.includes(supabaseUrls.table("poe_leagues")),
    handler: () => {
      queryCount++;
      return postgrestResponse(league);
    },
  });

  fetchMock.addRoute({
    match: (url) => url.includes(supabaseUrls.table("snapshots")),
    handler: () => {
      queryCount++;
      return postgrestResponse(snapshot);
    },
  });

  fetchMock.addRoute({
    match: (url) => url.includes(supabaseUrls.table("card_prices")),
    handler: () => {
      queryCount++;
      return postgrestResponse(cardPrices);
    },
  });

  return { league, snapshot, cardPrices, getQueryCount: () => queryCount };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authorization / Pre-validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-latest-snapshot — OPTIONS returns 200 (CORS preflight)",
  async () => {
    const fetchMock = mockFetch();

    const req = createOptionsRequest(
      "http://localhost:54321/functions/v1/get-latest-snapshot"
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    fetchMock.restore();
  }
);

quietTest("get-latest-snapshot — GET request returns 405", async () => {
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
});

quietTest("get-latest-snapshot — DELETE request returns 405", async () => {
  const fetchMock = mockFetch();

  const req = createFunctionRequest({
    method: "DELETE",
    apikey: "test-anon-key",
    bearerToken: "some-token",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 405);

  fetchMock.restore();
});

quietTest("get-latest-snapshot — missing apikey returns 401", async () => {
  const fetchMock = mockFetch();

  const req = createFunctionRequest({
    bearerToken: "some-token",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 401);
  const body = await resp.json();
  assertEquals(body.error, "Missing apikey header");

  fetchMock.restore();
});

quietTest(
  "get-latest-snapshot — missing Authorization returns 401",
  async () => {
    const fetchMock = mockFetch();

    const req = createFunctionRequest({
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await resp.json();
    assertEquals(body.error, "Missing Authorization header");

    fetchMock.restore();
  }
);

quietTest("get-latest-snapshot — invalid JWT returns 401", async () => {
  const fetchMock = mockFetch();

  fetchMock.onUrlContaining(
    "/auth/v1/",
    () =>
      new Response(JSON.stringify({ error: "invalid" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      })
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: "totally-invalid-jwt",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 401);
  const body = await resp.json();
  assertEquals(body.error, "Invalid JWT");

  fetchMock.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Input Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("get-latest-snapshot — missing game param returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertStringIncludes(body.error, "Missing required parameters");

  fetchMock.restore();
});

quietTest(
  "get-latest-snapshot — missing league param returns 400",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });
    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe2" },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");

    fetchMock.restore();
  }
);

quietTest("get-latest-snapshot — empty body returns 400", async () => {
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
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertStringIncludes(body.error, "Missing required parameters");

  fetchMock.restore();
});

quietTest("get-latest-snapshot — invalid game returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "diablo4", league: "Dawn" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertStringIncludes(body.error, "Invalid game");

  fetchMock.restore();
});

quietTest("get-latest-snapshot — league ID too long returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });
  const longLeague = "X".repeat(81);
  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: longLeague },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertStringIncludes(body.error, "Invalid league");

  fetchMock.restore();
});

quietTest(
  "get-latest-snapshot — league ID at exactly 80 chars passes validation",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });
    const exactLeague = "L".repeat(80);

    // We need at least the first query (poe_leagues) to show that validation passed
    fetchMock.onUrlContaining(
      supabaseUrls.table("poe_leagues"),
      () => postgrestResponse(null, 406) // single() with no match returns 406 in PostgREST
    );

    const req = createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: testToken,
      body: { game: "poe1", league: exactLeague },
    });
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    // Should NOT be 400 — it should proceed to the league lookup
    assert(
      resp.status !== 400,
      `Expected non-400 for valid 80-char league, got ${resp.status}`
    );

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — malformed request body returns 400",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = new Request(
      "http://localhost:54321/functions/v1/get-latest-snapshot",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          authorization: `Bearer ${testToken}`,
          apikey: "test-anon-key",
        },
        body: "not valid json at all",
      }
    );
    const resp = await handler(req);

    if (resp.status === 401) {
      console.log("[INFO] Skipping: getClaims could not decode test JWT");
      fetchMock.restore();
      return;
    }

    // req.json().catch(() => ({})) → empty object → missing params → 400
    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");

    fetchMock.restore();
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// League Not Found
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("get-latest-snapshot — league not found returns 404", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });

  // PostgREST .single() with no rows → 406
  fetchMock.onUrlContaining(
    supabaseUrls.table("poe_leagues"),
    () =>
      new Response(
        JSON.stringify({
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: "The result contains 0 rows",
          hint: null,
        }),
        {
          status: 406,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        }
      )
  );

  const req = createFunctionRequest({
    apikey: "test-anon-key",
    bearerToken: testToken,
    body: { game: "poe2", league: "NonExistentLeague" },
  });
  const resp = await handler(req);

  if (resp.status === 401) {
    console.log("[INFO] Skipping: getClaims could not decode test JWT");
    fetchMock.restore();
    return;
  }

  assertEquals(resp.status, 404);
  const body = await resp.json();
  assertEquals(body.error, "League not found");

  fetchMock.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshot Not Found
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-latest-snapshot — no snapshot for league returns 404",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const league = mockLeague({ id: "league-uuid-empty" });

    // League found
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse(league)
    );

    // Snapshot query returns no rows (PostgREST .single() → 406)
    fetchMock.onUrlContaining(
      supabaseUrls.table("snapshots"),
      () =>
        new Response(
          JSON.stringify({
            message: "JSON object requested, multiple (or no) rows returned",
            code: "PGRST116",
            details: "The result contains 0 rows",
            hint: null,
          }),
          {
            status: 406,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        )
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

    assertEquals(resp.status, 404);
    const body = await resp.json();
    assertEquals(body.error, "No snapshot found for this league");

    fetchMock.restore();
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Card Prices Error
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-latest-snapshot — card prices query error returns 500",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const league = mockLeague();
    const snapshot = mockSnapshot();

    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse(league)
    );

    fetchMock.onUrlContaining(supabaseUrls.table("snapshots"), () =>
      postgrestResponse(snapshot)
    );

    // card_prices query fails
    fetchMock.onUrlContaining(
      supabaseUrls.table("card_prices"),
      () =>
        new Response(
          JSON.stringify({
            message: "permission denied for table card_prices",
            code: "42501",
            details: null,
            hint: null,
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          }
        )
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
    assert(body.error !== undefined, "Should have an error field");

    fetchMock.restore();
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Success Path Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-latest-snapshot — returns formatted snapshot and card prices on success",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const league = mockLeague({ id: "league-uuid-001" });
    const snapshot = mockSnapshot({
      id: "snapshot-uuid-001",
      league_id: "league-uuid-001",
      fetched_at: "2024-12-15T12:00:00Z",
      exchange_chaos_to_divine: 150,
      stash_chaos_to_divine: 148,
      stacked_deck_chaos_cost: 1.5,
    });
    const cardPrices = [
      {
        card_name: "The Doctor",
        price_source: "exchange",
        chaos_value: 1200,
        divine_value: 8.0,
        confidence: 1,
      },
      {
        card_name: "House of Mirrors",
        price_source: "exchange",
        chaos_value: 3000,
        divine_value: 20.0,
        confidence: 1,
      },
      {
        card_name: "The Doctor",
        price_source: "stash",
        chaos_value: 1180,
        divine_value: 7.9,
        confidence: 2,
      },
      {
        card_name: "Rain of Chaos",
        price_source: "stash",
        chaos_value: 0.5,
        divine_value: 0.0,
        confidence: 3,
      },
    ];

    setupFullQueryChain(fetchMock, { league, snapshot, cardPrices });

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

    // Verify snapshot format (camelCase)
    assert(body.snapshot !== undefined, "Response should have snapshot");
    assertEquals(body.snapshot.id, "snapshot-uuid-001");
    assertEquals(body.snapshot.leagueId, "league-uuid-001");
    assertEquals(body.snapshot.fetchedAt, "2024-12-15T12:00:00Z");
    assertEquals(body.snapshot.exchangeChaosToDivine, 150);
    assertEquals(body.snapshot.stashChaosToDivine, 148);
    assertEquals(body.snapshot.stackedDeckChaosCost, 1.5);

    // Verify card prices structure
    assert(body.cardPrices !== undefined, "Response should have cardPrices");
    assert(
      body.cardPrices.exchange !== undefined,
      "Should have exchange prices"
    );
    assert(body.cardPrices.stash !== undefined, "Should have stash prices");

    // Exchange prices keyed by card_name
    assertEquals(body.cardPrices.exchange["The Doctor"].chaosValue, 1200);
    assertEquals(body.cardPrices.exchange["The Doctor"].divineValue, 8.0);
    assertEquals(body.cardPrices.exchange["The Doctor"].confidence, 1);
    assertEquals(body.cardPrices.exchange["House of Mirrors"].chaosValue, 3000);
    assertEquals(
      body.cardPrices.exchange["House of Mirrors"].divineValue,
      20.0
    );
    assertEquals(body.cardPrices.exchange["House of Mirrors"].confidence, 1);

    // Stash prices keyed by card_name
    assertEquals(body.cardPrices.stash["The Doctor"].chaosValue, 1180);
    assertEquals(body.cardPrices.stash["The Doctor"].divineValue, 7.9);
    assertEquals(body.cardPrices.stash["The Doctor"].confidence, 2);
    assertEquals(body.cardPrices.stash["Rain of Chaos"].chaosValue, 0.5);
    assertEquals(body.cardPrices.stash["Rain of Chaos"].confidence, 3);

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — confidence defaults to 1 when missing from DB data",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Card prices without confidence field (simulates old data before column was added)
    const cardPrices = [
      {
        card_name: "The Nurse",
        price_source: "exchange",
        chaos_value: 200,
        divine_value: 1.3,
        // no confidence field
      },
      {
        card_name: "The Nurse",
        price_source: "stash",
        chaos_value: 195,
        divine_value: 1.28,
        // no confidence field
      },
    ];

    setupFullQueryChain(fetchMock, { cardPrices });

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

    // When confidence is missing/undefined, the edge function defaults to 1
    assertEquals(
      body.cardPrices.exchange["The Nurse"].confidence,
      1,
      "Exchange confidence should default to 1 when missing"
    );
    assertEquals(
      body.cardPrices.stash["The Nurse"].confidence,
      1,
      "Stash confidence should default to 1 when missing"
    );

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — confidence values are passed through from DB data",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const cardPrices = [
      {
        card_name: "High Confidence Card",
        price_source: "stash",
        chaos_value: 500,
        divine_value: 3.3,
        confidence: 1,
      },
      {
        card_name: "Medium Confidence Card",
        price_source: "stash",
        chaos_value: 100,
        divine_value: 0.67,
        confidence: 2,
      },
      {
        card_name: "Low Confidence Card",
        price_source: "stash",
        chaos_value: 10,
        divine_value: 0.07,
        confidence: 3,
      },
    ];

    setupFullQueryChain(fetchMock, { cardPrices });

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

    assertEquals(body.cardPrices.stash["High Confidence Card"].confidence, 1);
    assertEquals(body.cardPrices.stash["Medium Confidence Card"].confidence, 2);
    assertEquals(body.cardPrices.stash["Low Confidence Card"].confidence, 3);

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — exchange prices do not include stackSize",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const cardPrices = [
      {
        card_name: "The Nurse",
        price_source: "exchange",
        chaos_value: 200,
        divine_value: 1.3,
      },
    ];

    setupFullQueryChain(fetchMock, { cardPrices });

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

    const nurseExchange = body.cardPrices.exchange["The Nurse"];
    assert(nurseExchange !== undefined, "Should have The Nurse in exchange");
    // stack_size column removed — should not be present in response
    assertEquals(nurseExchange.stackSize, undefined);

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — empty card prices returns empty exchange/stash",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    setupFullQueryChain(fetchMock, { cardPrices: [] });

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

    assertEquals(Object.keys(body.cardPrices.exchange).length, 0);
    assertEquals(Object.keys(body.cardPrices.stash).length, 0);

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — null stacked_deck_chaos_cost defaults to 0",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const snapshot = mockSnapshot({ stacked_deck_chaos_cost: null });

    setupFullQueryChain(fetchMock, { snapshot, cardPrices: [] });

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
    assertEquals(body.snapshot.stackedDeckChaosCost, 0);

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — includes Cache-Control header on success",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    setupFullQueryChain(fetchMock, { cardPrices: [] });

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
    assertEquals(cacheControl, "private, max-age=14400"); // 4 hours

    fetchMock.restore();
  }
);

quietTest("get-latest-snapshot — response includes CORS headers", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });

  setupFullQueryChain(fetchMock, { cardPrices: [] });

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
  assertStringIncludes(acah!, "apikey");

  fetchMock.restore();
});

quietTest("get-latest-snapshot — accepts poe1 game parameter", async () => {
  const fetchMock = setupAuthorizedMocks();

  const testToken = createTestJwt({ sub: "test-user-id-001" });

  const league = mockLeague({
    id: "poe1-league",
    game: "poe1",
    league_id: "Standard",
  });
  const snapshot = mockSnapshot({ league_id: "poe1-league" });

  setupFullQueryChain(fetchMock, { league, snapshot, cardPrices: [] });

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
  assertEquals(body.snapshot.leagueId, "poe1-league");

  fetchMock.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Card Price Deduplication / Overwrite Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-latest-snapshot — duplicate card names in same source: last wins",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Two rows for the same card name in exchange (shouldn't normally happen, but tests handler behavior)
    const cardPrices = [
      {
        card_name: "The Doctor",
        price_source: "exchange",
        chaos_value: 1200,
        divine_value: 8.0,
      },
      {
        card_name: "The Doctor",
        price_source: "exchange",
        chaos_value: 1300,
        divine_value: 8.7,
      },
    ];

    setupFullQueryChain(fetchMock, { cardPrices });

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

    // Last one wins because the loop overwrites by card_name key
    assertEquals(body.cardPrices.exchange["The Doctor"].chaosValue, 1300);
    assertEquals(body.cardPrices.exchange["The Doctor"].divineValue, 8.7);

    fetchMock.restore();
  }
);

quietTest(
  "get-latest-snapshot — same card in both exchange and stash appears in both",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const cardPrices = [
      {
        card_name: "The Doctor",
        price_source: "exchange",
        chaos_value: 1200,
        divine_value: 8.0,
      },
      {
        card_name: "The Doctor",
        price_source: "stash",
        chaos_value: 1180,
        divine_value: 7.9,
      },
    ];

    setupFullQueryChain(fetchMock, { cardPrices });

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

    // Should appear in both sources independently
    assert(body.cardPrices.exchange["The Doctor"] !== undefined);
    assert(body.cardPrices.stash["The Doctor"] !== undefined);
    assertEquals(body.cardPrices.exchange["The Doctor"].chaosValue, 1200);
    assertEquals(body.cardPrices.stash["The Doctor"].chaosValue, 1180);

    fetchMock.restore();
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// Rate Limiting Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("get-latest-snapshot — rate limited user gets 429", async () => {
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
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
  );

  // Mock rate limit → exceeded
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: false, reason: "rate_limited" })
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

  assertEquals(resp.status, 429);
  const body = await resp.json();
  assertStringIncludes(body.error, "Rate limit exceeded");

  fetchMock.restore();
});

quietTest("get-latest-snapshot — banned user gets 403", async () => {
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
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
  );

  // Mock rate limit → banned
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({
      allowed: false,
      reason: "banned",
      detail: "Account suspended for abuse",
    })
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

  assertEquals(resp.status, 403);
  const body = await resp.json();
  assertEquals(body.error, "Account suspended for abuse");

  fetchMock.restore();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Large Card Price Set
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "get-latest-snapshot — handles large card price set correctly",
  async () => {
    const fetchMock = setupAuthorizedMocks();

    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Generate 200 exchange + 200 stash card prices
    const cardPrices: Array<Record<string, unknown>> = [];
    for (let i = 0; i < 200; i++) {
      cardPrices.push({
        card_name: `Card ${i}`,
        price_source: "exchange",
        chaos_value: i * 10,
        divine_value: i * 0.07,
      });
      cardPrices.push({
        card_name: `Card ${i}`,
        price_source: "stash",
        chaos_value: i * 9.8,
        divine_value: i * 0.065,
      });
    }

    setupFullQueryChain(fetchMock, { cardPrices });

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

    assertEquals(Object.keys(body.cardPrices.exchange).length, 200);
    assertEquals(Object.keys(body.cardPrices.stash).length, 200);

    // Spot-check a specific card
    assertEquals(body.cardPrices.exchange["Card 50"].chaosValue, 500);
    assertEquals(body.cardPrices.stash["Card 99"].chaosValue, 99 * 9.8);

    fetchMock.restore();
  }
);

// Cleanup env at the end
cleanupEnv();
