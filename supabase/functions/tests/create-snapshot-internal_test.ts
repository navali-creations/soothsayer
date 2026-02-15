/**
 * Unit tests for supabase/functions/create-snapshot-internal/index.ts
 *
 * Tests the full handler including:
 *   - Internal cron authentication (x-cron-secret header)
 *   - HTTP method validation
 *   - Input validation (game, leagueId params)
 *   - Duplicate snapshot prevention (< 10 minutes)
 *   - poe.ninja API calls (exchange, currency, stash)
 *   - Database insert chain: league lookup → snapshot insert → card_prices insert
 *   - Error handling for each stage
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/create-snapshot-internal-test.ts
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  createInternalRequest,
  createMockRequest,
  mockFetch,
  mockLeague,
  mockSnapshot,
  postgrestResponse,
  quietTest,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

// ─── Setup: capture the handler from Deno.serve ──────────────────────────────

// Set env temporarily for the dynamic import. We do NOT rely on this
// persisting to test callbacks — every test calls setupEnv() itself.
const _initCleanup = setupEnv();
const serveStub = stubDenoServe();

// Dynamic import triggers Deno.serve() which we've stubbed
await import("../create-snapshot-internal/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Mock Data Factories ─────────────────────────────────────────────────────

/** Creates a mock poe.ninja exchange API response */
function mockExchangeResponse(
  overrides: { items?: unknown[]; lines?: unknown[]; core?: unknown } = {},
) {
  return {
    items: overrides.items ?? [
      { name: "The Doctor", category: "Cards" },
      { name: "House of Mirrors", category: "Cards" },
      { name: "Rain of Chaos", category: "Cards" },
      { name: "Some Currency", category: "Currency" }, // Non-card item
    ],
    lines: overrides.lines ?? [
      { primaryValue: 1200 },
      { primaryValue: 3000 },
      { primaryValue: 0.5 },
      { primaryValue: 100 },
    ],
    core: overrides.core ?? {
      rates: { divine: 0.00667 }, // 1/150 ≈ 0.00667 → ratio = 150
    },
  };
}

/** Creates a mock poe.ninja currency API response (for stacked deck price) */
function mockCurrencyResponse(stackedDeckPrice = 1.5) {
  return {
    lines: [
      { id: "chaos-orb", primaryValue: 1 },
      { id: "stacked-deck", primaryValue: stackedDeckPrice },
      { id: "divine-orb", primaryValue: 150 },
    ],
  };
}

/** Creates a mock poe.ninja stash (item overview) API response */
function mockStashResponse(overrides: { lines?: unknown[] } = {}) {
  return {
    lines: overrides.lines ?? [
      {
        name: "The Doctor",
        chaosValue: 1180,
        divineValue: 7.9,
        stackSize: 8,
        sparkLine: {
          data: [0, -1.2, 3.5, 2.1, -0.8, 1.3, 0.5],
          totalChange: 0.5,
        },
        lowConfidenceSparkLine: {
          data: [0, -1.2, 3.5, 2.1, -0.8, 1.3, 0.5],
          totalChange: 0.5,
        },
        count: 15,
        listingCount: 45,
      },
      {
        name: "Rain of Chaos",
        chaosValue: 0.4,
        divineValue: 0.003,
        stackSize: 8,
        sparkLine: {
          data: [0, 0.1, -0.2, 0.3, 0.1, -0.1, 0.2],
          totalChange: 0.2,
        },
        lowConfidenceSparkLine: {
          data: [0, 0.1, -0.2, 0.3, 0.1, -0.1, 0.2],
          totalChange: 0.2,
        },
        count: 50,
        listingCount: 200,
      },
      {
        name: "House of Mirrors",
        chaosValue: 2950,
        divineValue: 19.7,
        stackSize: 2,
        sparkLine: {
          data: [0, -3.5, -1.9, 2.1, 5.5, 3.6, 4.9],
          totalChange: 4.9,
        },
        lowConfidenceSparkLine: {
          data: [0, -3.5, -1.9, 2.1, 5.5, 3.6, 4.9],
          totalChange: 4.9,
        },
        count: 24,
        listingCount: 66,
      },
    ],
  };
}

/**
 * Sets up all fetch mocks for a full successful snapshot creation flow.
 * Returns the mock so individual routes can be overridden.
 */
function setupFullMocks(
  options: {
    league?: Record<string, unknown> | null;
    leagueError?: boolean;
    recentSnapshot?: Record<string, unknown> | null;
    exchangeData?: unknown;
    exchangeError?: boolean;
    currencyData?: unknown;
    currencyError?: boolean;
    stashData?: unknown;
    stashError?: boolean;
    snapshotInsertResult?: Record<string, unknown>;
    snapshotInsertError?: boolean;
    cardPricesInsertError?: boolean;
  } = {},
) {
  // Ensure env is set for every test that uses this helper
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();
  const insertedSnapshots: Array<{ url: string; body: string }> = [];
  const insertedCardPrices: Array<{ url: string; body: string }> = [];

  // ── Supabase DB mocks ──

  // Track request types to poe_leagues table
  fetchMock.addRoute({
    match: (url, init) => {
      const isLeagues = url.includes(supabaseUrls.table("poe_leagues"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isLeagues && method === "GET";
    },
    handler: () => {
      if (options.leagueError) {
        return new Response(
          JSON.stringify({
            message: "JSON object requested, multiple (or no) rows returned",
            code: "PGRST116",
            details: "The result contains 0 rows",
            hint: null,
          }),
          {
            status: 406,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }
      const league =
        options.league ?? mockLeague({ id: "league-uuid-001", name: "Dawn" });
      return postgrestResponse(league);
    },
  });

  // Snapshots table — GET (check for recent) and POST (insert)
  fetchMock.addRoute({
    match: (url, init) => {
      const isSnapshots = url.includes(supabaseUrls.table("snapshots"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isSnapshots && method === "GET";
    },
    handler: () => {
      if (options.recentSnapshot !== undefined) {
        if (options.recentSnapshot === null) {
          // No recent snapshot (PostgREST .single() with 0 rows → 406)
          return new Response(
            JSON.stringify({
              message: "JSON object requested, multiple (or no) rows returned",
              code: "PGRST116",
              details: "The result contains 0 rows",
              hint: null,
            }),
            {
              status: 406,
              headers: { "Content-Type": "application/json; charset=utf-8" },
            },
          );
        }
        return postgrestResponse(options.recentSnapshot);
      }
      // Default: no recent snapshot
      return new Response(
        JSON.stringify({
          message: "JSON object requested, multiple (or no) rows returned",
          code: "PGRST116",
          details: "The result contains 0 rows",
          hint: null,
        }),
        {
          status: 406,
          headers: { "Content-Type": "application/json; charset=utf-8" },
        },
      );
    },
  });

  fetchMock.addRoute({
    match: (url, init) => {
      const isSnapshots = url.includes(supabaseUrls.table("snapshots"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isSnapshots && method === "POST";
    },
    handler: async (input, init) => {
      let body = "";
      if (typeof input === "object" && "body" in input) {
        body = await (input as Request).text();
      } else if (init?.body) {
        body =
          typeof init.body === "string"
            ? init.body
            : new TextDecoder().decode(init.body as ArrayBuffer);
      }
      insertedSnapshots.push({
        url: typeof input === "string" ? input : (input as Request).url,
        body,
      });

      if (options.snapshotInsertError) {
        return new Response(
          JSON.stringify({
            message: "insert failed",
            code: "23505",
            details: null,
            hint: null,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }

      const result = options.snapshotInsertResult ?? {
        id: "new-snapshot-uuid-001",
        league_id: "league-uuid-001",
        fetched_at: new Date().toISOString(),
        exchange_chaos_to_divine: 150,
        stash_chaos_to_divine: 148,
        stacked_deck_chaos_cost: 1.5,
        created_at: new Date().toISOString(),
      };
      return postgrestResponse(result, 201);
    },
  });

  // Card prices table — POST (insert)
  fetchMock.addRoute({
    match: (url, init) => {
      const isCardPrices = url.includes(supabaseUrls.table("card_prices"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isCardPrices && method === "POST";
    },
    handler: async (input, init) => {
      let body = "";
      if (typeof input === "object" && "body" in input) {
        body = await (input as Request).text();
      } else if (init?.body) {
        body =
          typeof init.body === "string"
            ? init.body
            : new TextDecoder().decode(init.body as ArrayBuffer);
      }
      insertedCardPrices.push({
        url: typeof input === "string" ? input : (input as Request).url,
        body,
      });

      if (options.cardPricesInsertError) {
        return new Response(
          JSON.stringify({
            message: "insert failed",
            code: "23505",
            details: null,
            hint: null,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        );
      }
      return postgrestResponse([], 201);
    },
  });

  // ── poe.ninja API mocks ──

  // Exchange API (DivinationCard)
  fetchMock.addRoute({
    match: (url) =>
      url.includes("poe.ninja") &&
      url.includes("exchange") &&
      url.includes("DivinationCard"),
    handler: () => {
      if (options.exchangeError) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify(options.exchangeData ?? mockExchangeResponse()),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  // Currency API
  fetchMock.addRoute({
    match: (url) =>
      url.includes("poe.ninja") &&
      url.includes("exchange") &&
      url.includes("Currency"),
    handler: () => {
      if (options.currencyError) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify(options.currencyData ?? mockCurrencyResponse()),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  // Stash API (itemoverview)
  fetchMock.addRoute({
    match: (url) => url.includes("poe.ninja") && url.includes("itemoverview"),
    handler: () => {
      if (options.stashError) {
        return new Response("Service Unavailable", { status: 503 });
      }
      return new Response(
        JSON.stringify(options.stashData ?? mockStashResponse()),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    },
  });

  // Wrap restore so callers don't need to remember cleanupEnv
  const originalRestore = fetchMock.restore.bind(fetchMock);
  fetchMock.restore = () => {
    originalRestore();
    cleanupEnv();
  };

  return { fetchMock, insertedSnapshots, insertedCardPrices };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — missing cron secret returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createMockRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { method: "POST", body: { game: "poe1", leagueId: "Dawn" } },
    );
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await resp.json();
    assertEquals(body.error, "Unauthorized");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "create-snapshot-internal — wrong cron secret returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "wrong-secret-value",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await resp.json();
    assertEquals(body.error, "Unauthorized");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "create-snapshot-internal — correct cron secret is accepted",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );

    const resp = await handler(req);

    // Should succeed (200) since all mocks are in place
    assertEquals(resp.status, 200);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// HTTP Method Validation
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("create-snapshot-internal — GET request returns 405", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createMockRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    {
      method: "GET",
      cronSecret: "test-cron-secret",
    },
  );
  const resp = await handler(req);

  assertEquals(resp.status, 405);
  const body = await resp.json();
  assertEquals(body.error, "Method not allowed");

  fetchMock.restore();
  cleanupEnv();
});

quietTest("create-snapshot-internal — PUT request returns 405", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createMockRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    {
      method: "PUT",
      cronSecret: "test-cron-secret",
    },
  );
  const resp = await handler(req);

  assertEquals(resp.status, 405);

  fetchMock.restore();
  cleanupEnv();
});

quietTest("create-snapshot-internal — DELETE request returns 405", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createMockRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    {
      method: "DELETE",
      cronSecret: "test-cron-secret",
    },
  );
  const resp = await handler(req);

  assertEquals(resp.status, 405);

  fetchMock.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// Input Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — missing game param returns 400",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { leagueId: "Dawn" }, // No game
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "create-snapshot-internal — missing leagueId param returns 400",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1" }, // No leagueId
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await resp.json();
    assertStringIncludes(body.error, "Missing required parameters");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest("create-snapshot-internal — empty body returns 400", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createInternalRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    {},
    "test-cron-secret",
  );
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertStringIncludes(body.error, "Missing required parameters");

  fetchMock.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// League Not Found
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — league not found returns 404",
  async () => {
    const { fetchMock } = setupFullMocks({ leagueError: true });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "NonExistentLeague" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 404);
    const body = await resp.json();
    assertEquals(body.error, "League not found");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Duplicate Snapshot Prevention
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — recent snapshot (< 10 min) returns 200 with skip message",
  async () => {
    const recentSnapshot = mockSnapshot({
      id: "recent-snapshot-uuid",
      fetched_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
    });

    const { fetchMock } = setupFullMocks({ recentSnapshot });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertStringIncludes(body.message, "Recent snapshot exists");
    assert(body.snapshot !== undefined, "Should return the existing snapshot");
    assertEquals(body.snapshot.id, "recent-snapshot-uuid");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — no recent snapshot proceeds with creation",
  async () => {
    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);

    // Should have inserted a new snapshot
    assert(
      insertedSnapshots.length > 0,
      "Should have inserted at least one snapshot",
    );

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// poe.ninja API Call Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — calls poe.ninja exchange API with correct league name",
  async () => {
    const league = mockLeague({
      id: "league-uuid-001",
      name: "Settlers of Kalguur",
    });

    const { fetchMock } = setupFullMocks({ league, recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Settlers" },
      "test-cron-secret",
    );
    await handler(req);

    const exchangeCall = fetchMock.calls.find(
      (c) =>
        c.url.includes("poe.ninja") &&
        c.url.includes("exchange") &&
        c.url.includes("DivinationCard"),
    );
    assert(
      exchangeCall !== undefined,
      "Should have called poe.ninja exchange API",
    );
    assertStringIncludes(
      exchangeCall!.url,
      encodeURIComponent("Settlers of Kalguur"),
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — calls poe.ninja stash API with correct league name",
  async () => {
    const league = mockLeague({
      id: "league-uuid-001",
      name: "Dawn",
    });

    const { fetchMock } = setupFullMocks({ league, recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    await handler(req);

    const stashCall = fetchMock.calls.find(
      (c) => c.url.includes("poe.ninja") && c.url.includes("itemoverview"),
    );
    assert(stashCall !== undefined, "Should have called poe.ninja stash API");
    assertStringIncludes(stashCall!.url, "Dawn");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — calls poe.ninja currency API for stacked deck price",
  async () => {
    const { fetchMock } = setupFullMocks({ recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    await handler(req);

    const currencyCall = fetchMock.calls.find(
      (c) =>
        c.url.includes("poe.ninja") &&
        c.url.includes("exchange") &&
        c.url.includes("Currency"),
    );
    assert(
      currencyCall !== undefined,
      "Should have called poe.ninja currency API for stacked deck price",
    );

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// poe.ninja API Error Handling
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — poe.ninja exchange API failure returns 500",
  async () => {
    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      exchangeError: true,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "poe.ninja exchange API failed");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe.ninja stash API failure returns 500",
  async () => {
    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      stashError: true,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "poe.ninja stash API failed");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe.ninja currency API failure defaults stacked deck to 0",
  async () => {
    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      currencyError: true,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    // Currency failure is non-fatal — snapshot creation should succeed
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Snapshot Insert Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — inserts snapshot with correct fields",
  async () => {
    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedSnapshots.length > 0, "Should have inserted a snapshot");

    const inserted = JSON.parse(insertedSnapshots[0].body);
    assertEquals(inserted.league_id, "league-uuid-001");
    assert(inserted.fetched_at !== undefined, "Should have fetched_at");
    assert(
      typeof inserted.exchange_chaos_to_divine === "number",
      "Should have exchange ratio",
    );
    assert(
      typeof inserted.stash_chaos_to_divine === "number",
      "Should have stash ratio",
    );
    assert(
      typeof inserted.stacked_deck_chaos_cost === "number",
      "Should have stacked deck cost",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — snapshot insert failure returns 500",
  async () => {
    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      snapshotInsertError: true,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "Failed to create snapshot");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Card Prices Insert Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — inserts card prices with snapshot_id",
  async () => {
    const snapshotResult = {
      id: "snapshot-for-prices-test",
      league_id: "league-uuid-001",
      fetched_at: new Date().toISOString(),
      exchange_chaos_to_divine: 150,
      stash_chaos_to_divine: 148,
      stacked_deck_chaos_cost: 1.5,
      created_at: new Date().toISOString(),
    };

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      snapshotInsertResult: snapshotResult,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedCardPrices.length > 0, "Should have inserted card prices");

    const prices = JSON.parse(insertedCardPrices[0].body);
    assert(Array.isArray(prices), "Card prices should be an array");

    // All prices should have the snapshot_id
    for (const price of prices) {
      assertEquals(
        price.snapshot_id,
        "snapshot-for-prices-test",
        `Card price for ${price.card_name} should reference the snapshot`,
      );
    }

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — card prices include both exchange and stash sources",
  async () => {
    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedCardPrices.length > 0);

    const prices = JSON.parse(insertedCardPrices[0].body);

    const exchangePrices = prices.filter(
      (p: any) => p.price_source === "exchange",
    );
    const stashPrices = prices.filter((p: any) => p.price_source === "stash");

    assert(exchangePrices.length > 0, "Should have exchange prices");
    assert(stashPrices.length > 0, "Should have stash prices");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — only Cards category items become exchange prices",
  async () => {
    const exchangeData = mockExchangeResponse({
      items: [
        { name: "The Doctor", category: "Cards" },
        { name: "Chaos Orb", category: "Currency" }, // Not a card
        { name: "Mirror of Kalandra", category: "Currency" }, // Not a card
      ],
      lines: [
        { primaryValue: 1200 },
        { primaryValue: 1 },
        { primaryValue: 50000 },
      ],
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      exchangeData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const prices = JSON.parse(insertedCardPrices[0].body);

    const exchangePrices = prices.filter(
      (p: any) => p.price_source === "exchange",
    );
    // Only "The Doctor" should be included (Cards category)
    assertEquals(exchangePrices.length, 1);
    assertEquals(exchangePrices[0].card_name, "The Doctor");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — exchange prices always have confidence 1 (high)",
  async () => {
    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedCardPrices.length > 0);

    const prices = JSON.parse(insertedCardPrices[0].body);
    const exchangePrices = prices.filter(
      (p: any) => p.price_source === "exchange",
    );

    for (const price of exchangePrices) {
      assertEquals(
        price.confidence,
        1,
        `Exchange price for ${price.card_name} should always be high confidence (1)`,
      );
    }

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — stash prices with populated sparkLine and count>=10 get confidence 1 (high)",
  async () => {
    const stashData = mockStashResponse({
      lines: [
        {
          name: "House of Mirrors",
          chaosValue: 21814,
          divineValue: 123.8,
          stackSize: 9,
          sparkLine: {
            data: [0, -3.53, -1.88, -3.63, 5.51, 3.65, 4.91],
            totalChange: 4.91,
          },
          lowConfidenceSparkLine: {
            data: [0, -3.53, -1.88, -3.63, 5.51, 3.65, 4.91],
            totalChange: 4.91,
          },
          count: 24,
          listingCount: 66,
        },
      ],
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const prices = JSON.parse(insertedCardPrices[0].body);
    const stashPrices = prices.filter((p: any) => p.price_source === "stash");

    const hom = stashPrices.find(
      (p: any) => p.card_name === "House of Mirrors",
    );
    assert(hom !== undefined, "Should have House of Mirrors");
    assertEquals(hom.confidence, 1);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — stash prices with populated sparkLine but count<10 get confidence 2 (medium)",
  async () => {
    const stashData = mockStashResponse({
      lines: [
        {
          name: "Unrequited Love",
          chaosValue: 10872,
          divineValue: 61.7,
          stackSize: 16,
          sparkLine: {
            data: [0, -0.94, -5.9, -2.97, -11.45, -11.12, -18.74],
            totalChange: -18.74,
          },
          lowConfidenceSparkLine: {
            data: [0, -0.94, -5.9, -2.97, -11.45, -11.12, -18.74],
            totalChange: -18.74,
          },
          count: 8,
          listingCount: 40,
        },
      ],
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const prices = JSON.parse(insertedCardPrices[0].body);
    const stashPrices = prices.filter((p: any) => p.price_source === "stash");

    const ul = stashPrices.find((p: any) => p.card_name === "Unrequited Love");
    assert(ul !== undefined, "Should have Unrequited Love");
    assertEquals(ul.confidence, 2);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — stash prices with empty sparkLine get confidence 3 (low)",
  async () => {
    const stashData = mockStashResponse({
      lines: [
        {
          name: "Nook's Crown",
          chaosValue: 176.2,
          divineValue: 1,
          stackSize: 4,
          sparkLine: {
            data: [],
            totalChange: 0,
          },
          lowConfidenceSparkLine: {
            data: [0, -50.26, -50.11, -50.25, -2.66, -2.6, -2.44],
            totalChange: -2.44,
          },
          count: 1,
          listingCount: 21,
        },
        {
          name: "History",
          chaosValue: 17444,
          divineValue: 99,
          stackSize: 5,
          sparkLine: {
            data: [],
            totalChange: 0,
          },
          lowConfidenceSparkLine: {
            data: [0, 0.7, 2.22, 22.35, 21.35, 34.91, 35.14],
            totalChange: 35.14,
          },
          count: 1,
          listingCount: 21,
        },
      ],
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const prices = JSON.parse(insertedCardPrices[0].body);
    const stashPrices = prices.filter((p: any) => p.price_source === "stash");

    const nooks = stashPrices.find((p: any) => p.card_name === "Nook's Crown");
    assert(nooks !== undefined, "Should have Nook's Crown");
    assertEquals(nooks.confidence, 3);

    const history = stashPrices.find((p: any) => p.card_name === "History");
    assert(history !== undefined, "Should have History");
    assertEquals(history.confidence, 3);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — stash cards without sparkLine field default to confidence 3 (low)",
  async () => {
    const stashData = mockStashResponse({
      lines: [
        {
          name: "No Sparkline Card",
          chaosValue: 50,
          divineValue: 0.3,
          stackSize: 4,
          // No sparkLine or lowConfidenceSparkLine fields at all
        },
      ],
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const prices = JSON.parse(insertedCardPrices[0].body);
    const stashPrices = prices.filter((p: any) => p.price_source === "stash");

    const card = stashPrices.find(
      (p: any) => p.card_name === "No Sparkline Card",
    );
    assert(card !== undefined, "Should have No Sparkline Card");
    assertEquals(card.confidence, 3);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — stash prices do not include stack_size",
  async () => {
    const stashData = mockStashResponse({
      lines: [
        {
          name: "The Wretched",
          chaosValue: 5,
          divineValue: 0.03,
          stackSize: 6,
        },
      ],
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const prices = JSON.parse(insertedCardPrices[0].body);

    const stashPrices = prices.filter((p: any) => p.price_source === "stash");
    const wretched = stashPrices.find(
      (p: any) => p.card_name === "The Wretched",
    );
    assert(wretched !== undefined, "Should have The Wretched in stash prices");
    assertEquals(
      wretched.stack_size,
      undefined,
      "stack_size should not be present",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — card prices insert failure returns 500",
  async () => {
    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      cardPricesInsertError: true,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "Failed to insert card prices");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Success Response Format Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — success response has expected fields",
  async () => {
    const { fetchMock } = setupFullMocks({ recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    assert(body.snapshot !== undefined, "Response should have snapshot");
    assert(body.snapshot.id !== undefined, "Snapshot should have id");
    assert(
      body.snapshot.leagueId !== undefined,
      "Snapshot should have leagueId",
    );
    assert(
      body.snapshot.fetchedAt !== undefined,
      "Snapshot should have fetchedAt",
    );
    assert(
      body.snapshot.exchangeChaosToDivine !== undefined,
      "Snapshot should have exchangeChaosToDivine",
    );
    assert(
      body.snapshot.stashChaosToDivine !== undefined,
      "Snapshot should have stashChaosToDivine",
    );
    assert(
      body.snapshot.stackedDeckChaosCost !== undefined,
      "Snapshot should have stackedDeckChaosCost",
    );
    assert(
      typeof body.snapshot.cardCount === "number",
      "Snapshot should have cardCount as number",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — success response uses camelCase field names",
  async () => {
    const snapshotResult = {
      id: "camel-case-test-uuid",
      league_id: "league-uuid-001",
      fetched_at: "2024-12-15T12:00:00Z",
      exchange_chaos_to_divine: 155,
      stash_chaos_to_divine: 152,
      stacked_deck_chaos_cost: 2.0,
      created_at: "2024-12-15T12:00:00Z",
    };

    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      snapshotInsertResult: snapshotResult,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.snapshot.id, "camel-case-test-uuid");
    assertEquals(body.snapshot.leagueId, "league-uuid-001");
    assertEquals(body.snapshot.fetchedAt, "2024-12-15T12:00:00Z");
    assertEquals(body.snapshot.exchangeChaosToDivine, 155);
    assertEquals(body.snapshot.stashChaosToDivine, 152);
    assertEquals(body.snapshot.stackedDeckChaosCost, 2.0);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — cardCount reflects total inserted prices",
  async () => {
    // 3 exchange card items + 3 stash items = 6 total
    const { fetchMock } = setupFullMocks({ recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // Default mock: 3 Cards in exchange (The Doctor, House of Mirrors, Rain of Chaos)
    // + 3 stash lines (The Doctor, Rain of Chaos, House of Mirrors)
    // = 6 total
    assert(body.snapshot.cardCount > 0, "cardCount should be greater than 0");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — response has Content-Type application/json",
  async () => {
    const { fetchMock } = setupFullMocks({ recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "application/json");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Chaos-to-Divine Ratio Calculation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — calculates exchange chaos-to-divine ratio from core.rates",
  async () => {
    const exchangeData = mockExchangeResponse({
      core: { rates: { divine: 0.01 } }, // 1/0.01 = 100
      items: [{ name: "Card A", category: "Cards" }],
      lines: [{ primaryValue: 50 }],
    });

    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
      exchangeData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedSnapshots.length > 0);

    const inserted = JSON.parse(insertedSnapshots[0].body);
    assertEquals(inserted.exchange_chaos_to_divine, 100); // 1/0.01 = 100

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — defaults exchange ratio to 100 when core.rates.divine is missing",
  async () => {
    const exchangeData = mockExchangeResponse({
      core: {}, // No rates.divine
      items: [{ name: "Card B", category: "Cards" }],
      lines: [{ primaryValue: 30 }],
    });

    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
      exchangeData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedSnapshots.length > 0);

    const inserted = JSON.parse(insertedSnapshots[0].body);
    assertEquals(inserted.exchange_chaos_to_divine, 100); // Default fallback

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — calculates stash chaos-to-divine ratio from first card with both values",
  async () => {
    const stashData = mockStashResponse({
      lines: [
        { name: "Zero Divine", chaosValue: 50, divineValue: 0, stackSize: 1 }, // divineValue = 0, skip
        {
          name: "Good Card",
          chaosValue: 300,
          divineValue: 2,
          stackSize: 8,
        }, // ratio = 300/2 = 150
      ],
    });

    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedSnapshots.length > 0);

    const inserted = JSON.parse(insertedSnapshots[0].body);
    assertEquals(inserted.stash_chaos_to_divine, 150); // 300/2

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Stacked Deck Price Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — extracts stacked deck price from currency API",
  async () => {
    const currencyData = mockCurrencyResponse(2.5);

    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
      currencyData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedSnapshots.length > 0);

    const inserted = JSON.parse(insertedSnapshots[0].body);
    assertEquals(inserted.stacked_deck_chaos_cost, 2.5);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — stacked deck defaults to 0 when not found in currency data",
  async () => {
    const currencyData = {
      lines: [
        { id: "chaos-orb", primaryValue: 1 },
        { id: "divine-orb", primaryValue: 150 },
        // No stacked-deck entry
      ],
    };

    const { fetchMock, insertedSnapshots } = setupFullMocks({
      recentSnapshot: null,
      currencyData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedSnapshots.length > 0);

    const inserted = JSON.parse(insertedSnapshots[0].body);
    assertEquals(inserted.stacked_deck_chaos_cost, 0);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Empty API Response Handling
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — empty exchange items produces zero exchange prices",
  async () => {
    const exchangeData = mockExchangeResponse({
      items: [],
      lines: [],
    });

    const { fetchMock } = setupFullMocks({
      recentSnapshot: null,
      exchangeData,
      stashData: mockStashResponse({ lines: [] }),
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.snapshot.cardCount, 0);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — empty stash lines produces zero stash prices",
  async () => {
    const stashData = mockStashResponse({ lines: [] });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      stashData,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    if (insertedCardPrices.length > 0) {
      const prices = JSON.parse(insertedCardPrices[0].body);
      const stashPrices = prices.filter((p: any) => p.price_source === "stash");
      assertEquals(stashPrices.length, 0);
    }

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Exchange Price Calculation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — exchange card divine_value is calculated from ratio and rounded to 2 decimals",
  async () => {
    const exchangeData = mockExchangeResponse({
      core: { rates: { divine: 0.005 } }, // ratio = 1/0.005 = 200
      items: [{ name: "Test Card", category: "Cards" }],
      lines: [{ primaryValue: 400 }], // chaos_value = 400, divine = 400/200 = 2.0
    });

    const { fetchMock, insertedCardPrices } = setupFullMocks({
      recentSnapshot: null,
      exchangeData,
      stashData: mockStashResponse({ lines: [] }),
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedCardPrices.length > 0);

    const prices = JSON.parse(insertedCardPrices[0].body);
    const exchangePrices = prices.filter(
      (p: any) => p.price_source === "exchange",
    );

    assert(exchangePrices.length >= 1);
    const testCard = exchangePrices.find(
      (p: any) => p.card_name === "Test Card",
    );
    assert(testCard !== undefined, "Should have Test Card");
    assertEquals(testCard.chaos_value, 400);
    assertEquals(testCard.divine_value, 2.0); // 400 / 200, rounded to 2 decimals

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CORS / Response Headers
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — success response includes CORS headers",
  async () => {
    const { fetchMock } = setupFullMocks({ recentSnapshot: null });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    // create-snapshot-internal uses responseJson which includes CORS headers
    const acah = resp.headers.get("Access-Control-Allow-Headers");
    assert(acah !== null, "Should include CORS headers via responseJson");
    assertStringIncludes(acah!, "authorization");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — error response includes Content-Type",
  async () => {
    const { fetchMock } = setupFullMocks({ leagueError: true });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "NonExistent" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 404);
    assertEquals(resp.headers.get("Content-Type"), "application/json");

    fetchMock.restore();
  },
);
