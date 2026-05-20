/**
 * Unit tests for supabase/functions/create-snapshot-internal/index.ts
 *
 * Tests the full handler including:
 *   - Internal cron authentication (x-cron-secret header)
 *   - HTTP method validation
 *   - Input validation (game, leagueId params)
 *   - Duplicate snapshot prevention (< 10 minutes)
 *   - poe.ninja API calls (exchange, currency)
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
  createOptionsRequest,
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

/** Generates a deterministic card ID from a card name (e.g., "The Doctor" → "card-id-the-doctor") */
function cardId(name: string): string {
  return `card-id-${name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

/**
 * Given an array of card names, returns the mock cards table rows
 * (each with a deterministic `id` and the original `name`).
 */
function mockCardRows(names: string[]): Array<{ id: string; name: string }> {
  return names.map((n) => ({ id: cardId(n), name: n }));
}

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

function rejectWhenAborted(init?: RequestInit): Promise<Response> {
  const signal = init?.signal;
  return new Promise((_resolve, reject) => {
    if (!signal) {
      reject(new Error("Expected request to include an AbortSignal"));
      return;
    }

    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }

    signal.addEventListener(
      "abort",
      () => reject(new DOMException("Aborted", "AbortError")),
      { once: true },
    );
  });
}

/**
 * Sets up all fetch mocks for a full successful snapshot creation flow.
 * Returns the mock so individual routes can be overridden.
 */
function setupFullMocks(
  options: {
    league?: Record<string, unknown> | null;
    leagueError?: boolean;
    exchangeData?: unknown;
    exchangeError?: boolean;
    exchangeTimeout?: boolean;
    currencyData?: unknown;
    currencyError?: boolean;
    snapshotInsertResult?: Record<string, unknown>;
    snapshotInsertError?: boolean;
    cardIdRows?: Array<Record<string, unknown>>;
    cardPricesInsertError?: boolean;
  } = {},
) {
  // Ensure env is set for every test that uses this helper
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();
  const insertedSnapshots: Array<{ url: string; body: string }> = [];
  const insertedCardPrices: Array<{ url: string; body: string }> = [];
  /** Card names seen via the cards upsert, used to return IDs on GET */
  const upsertedCardNames: string[] = [];

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

  // Cards table — POST (upsert unique card names)
  fetchMock.addRoute({
    match: (url, init) => {
      const isCards = url.includes(supabaseUrls.table("cards"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isCards && method === "POST";
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
      try {
        const rows = JSON.parse(body);
        if (Array.isArray(rows)) {
          for (const row of rows) {
            if (row.name && !upsertedCardNames.includes(row.name)) {
              upsertedCardNames.push(row.name);
            }
          }
        }
      } catch {
        /* ignore parse errors */
      }
      return postgrestResponse([], 201);
    },
  });

  // Cards table — GET (select id, name for cardIdMap)
  fetchMock.addRoute({
    match: (url, init) => {
      const isCards = url.includes(supabaseUrls.table("cards"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isCards && method === "GET";
    },
    handler: () => {
      // Return deterministic card IDs for every card name that was upserted
      const rows = options.cardIdRows ?? mockCardRows(upsertedCardNames);
      return postgrestResponse(rows);
    },
  });

  // Atomic snapshot + prices RPC
  fetchMock.addRoute({
    match: (url, init) => {
      const isSnapshotRpc = url.includes(
        supabaseUrls.rpc("create_snapshot_with_prices"),
      );
      const method = init?.method?.toUpperCase() ?? "GET";
      return isSnapshotRpc && method === "POST";
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

      const payload = JSON.parse(body);
      insertedSnapshots.push({
        url: typeof input === "string" ? input : (input as Request).url,
        body: JSON.stringify({
          league_id: payload.p_league_id,
          fetched_at: payload.p_fetched_at,
          exchange_chaos_to_divine: payload.p_exchange_chaos_to_divine,
          stacked_deck_chaos_cost: payload.p_stacked_deck_chaos_cost,
          stacked_deck_max_volume_rate: payload.p_stacked_deck_max_volume_rate,
        }),
      });
      insertedCardPrices.push({
        url: typeof input === "string" ? input : (input as Request).url,
        body: JSON.stringify(payload.p_prices ?? []),
      });

      if (options.snapshotInsertError || options.cardPricesInsertError) {
        return new Response(
          JSON.stringify({
            message: "atomic snapshot insert failed",
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

      const defaultResult = {
        id: "new-snapshot-uuid-001",
        league_id: "league-uuid-001",
        fetched_at: payload.p_fetched_at,
        exchange_chaos_to_divine: payload.p_exchange_chaos_to_divine,
        stacked_deck_chaos_cost: payload.p_stacked_deck_chaos_cost,
        stacked_deck_max_volume_rate: payload.p_stacked_deck_max_volume_rate,
        created_at: new Date().toISOString(),
      };
      const result = {
        ...defaultResult,
        ...(options.snapshotInsertResult ?? {}),
      };
      return postgrestResponse(result, 200);
    },
  });

  // ── poe.ninja API mocks ──

  // Exchange API (DivinationCard)
  fetchMock.addRoute({
    match: (url) =>
      url.includes("poe.ninja") &&
      url.includes("exchange") &&
      url.includes("DivinationCard"),
    handler: (_input, init) => {
      if (options.exchangeTimeout) {
        return rejectWhenAborted(init);
      }
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
  "create-snapshot-internal — missing configured cron secret fails closed",
  async () => {
    const cleanupEnv = setupEnv();
    Deno.env.delete("INTERNAL_CRON_SECRET");
    const fetchMock = mockFetch();

    const req = createMockRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { method: "POST", body: { game: "poe1", leagueId: "Dawn" } },
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertEquals(body.error, "Server misconfigured");

    assertEquals(fetchMock.calls.length, 0);
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

quietTest(
  "create-snapshot-internal — OPTIONS request returns 200",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createOptionsRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(
      resp.headers.get("Access-Control-Allow-Methods"),
      "POST, OPTIONS",
    );
    assertEquals(fetchMock.calls.length, 0);

    fetchMock.restore();
    cleanupEnv();
  },
);

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

quietTest("create-snapshot-internal — malformed JSON returns 400", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = new Request(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-cron-secret": "test-cron-secret",
      },
      body: "not-json",
    },
  );
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "Invalid JSON request body");
  assertEquals(fetchMock.calls.length, 0);

  fetchMock.restore();
  cleanupEnv();
});

quietTest("create-snapshot-internal — invalid game returns 400", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = createInternalRequest(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    { game: "poe3", leagueId: "Dawn" },
    "test-cron-secret",
  );
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await resp.json();
  assertEquals(body.error, "Invalid game: expected poe1 or poe2");
  assertEquals(fetchMock.calls.length, 0);

  fetchMock.restore();
  cleanupEnv();
});

quietTest("create-snapshot-internal — oversized body returns 413", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const req = new Request(
    "http://localhost:54321/functions/v1/create-snapshot-internal",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": "4097",
        "x-cron-secret": "test-cron-secret",
      },
      body: "{}",
    },
  );
  const resp = await handler(req);

  assertEquals(resp.status, 413);
  const body = await resp.json();
  assertEquals(body.error, "Request body too large");
  assertEquals(fetchMock.calls.length, 0);

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
  "create-snapshot-internal — no recent snapshot proceeds with creation",
  async () => {
    const { fetchMock, insertedSnapshots } = setupFullMocks();

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

quietTest(
  "create-snapshot-internal — concurrent recent snapshot from RPC returns skip message",
  async () => {
    const concurrentSnapshot = mockSnapshot({
      id: "concurrent-snapshot-uuid",
      fetched_at: new Date(Date.now() - 2 * 60 * 1000).toISOString(),
    });
    const { fetchMock } = setupFullMocks({
      snapshotInsertResult: concurrentSnapshot,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertStringIncludes(body.message, "Recent snapshot exists");
    assertEquals(body.snapshot.id, "concurrent-snapshot-uuid");

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

    const { fetchMock } = setupFullMocks({ league });

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
  "create-snapshot-internal — calls poe.ninja currency API for stacked deck price",
  async () => {
    const { fetchMock } = setupFullMocks({});

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
    assertEquals(body.error, "Failed to create snapshot");

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe.ninja exchange API timeout returns 500",
  async () => {
    const originalTimeout = Deno.env.get("POE_NINJA_FETCH_TIMEOUT_MS");
    const { fetchMock } = setupFullMocks({
      exchangeTimeout: true,
    });
    Deno.env.set("POE_NINJA_FETCH_TIMEOUT_MS", "1");

    try {
      const req = createInternalRequest(
        "http://localhost:54321/functions/v1/create-snapshot-internal",
        { game: "poe1", leagueId: "Dawn" },
        "test-cron-secret",
      );
      const resp = await handler(req);

      assertEquals(resp.status, 500);
      const body = await resp.json();
      assertEquals(body.error, "Failed to create snapshot");
    } finally {
      fetchMock.restore();
      if (originalTimeout === undefined) {
        Deno.env.delete("POE_NINJA_FETCH_TIMEOUT_MS");
      } else {
        Deno.env.set("POE_NINJA_FETCH_TIMEOUT_MS", originalTimeout);
      }
    }
  },
);

quietTest(
  "create-snapshot-internal — poe.ninja currency API failure defaults stacked deck to 0",
  async () => {
    const { fetchMock } = setupFullMocks({
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
    const { fetchMock, insertedSnapshots } = setupFullMocks({});

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
  "create-snapshot-internal — sends card prices to snapshot RPC without snapshot_id",
  async () => {
    const snapshotResult = {
      id: "snapshot-for-prices-test",
      league_id: "league-uuid-001",
      fetched_at: new Date().toISOString(),
      exchange_chaos_to_divine: 150,
      stacked_deck_chaos_cost: 1.5,
      created_at: new Date().toISOString(),
    };

    const { fetchMock, insertedCardPrices } = setupFullMocks({
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

    // The atomic RPC attaches snapshot_id inside Postgres. The function should
    // only send card payload fields here, with card_id resolved and no card_name.
    for (const price of prices) {
      assertEquals(
        price.snapshot_id,
        undefined,
        "snapshot_id should be assigned by create_snapshot_with_prices",
      );
      assert(
        typeof price.card_id === "string" && price.card_id.length > 0,
        "Each card price should have a non-empty card_id",
      );
      assertEquals(
        (price as any).card_name,
        undefined,
        "card_name should not be in insert payload",
      );
    }

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

    // Only "The Doctor" should be included (Cards category)
    assertEquals(prices.length, 1);
    assertEquals(prices[0].card_id, cardId("The Doctor"));
    assertEquals(
      (prices[0] as any).card_name,
      undefined,
      "card_name should not be in insert payload",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — skips invalid numeric prices instead of inserting null values",
  async () => {
    const exchangeData = mockExchangeResponse({
      core: { rates: { divine: 0.005 } },
      items: [
        { name: "Valid Exchange", category: "Cards" },
        { name: "Broken Exchange", category: "Cards" },
      ],
      lines: [{ primaryValue: 200 }, {}],
    });
    const { fetchMock, insertedCardPrices } = setupFullMocks({
      exchangeData,
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
    assert(
      prices.some((p: any) => p.card_id === cardId("Valid Exchange")),
      "Should keep valid prices",
    );
    assert(
      !prices.some((p: any) => p.card_id === cardId("Broken Exchange")),
      "Should skip exchange prices without primaryValue",
    );

    for (const price of prices) {
      assert(
        price.chaos_value !== null && price.chaos_value !== undefined,
        "Inserted prices must never have null chaos_value",
      );
      assert(
        price.divine_value !== null && price.divine_value !== undefined,
        "Inserted prices must never have null divine_value",
      );
    }

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — exchange prices always have confidence 1 (high)",
  async () => {
    const { fetchMock, insertedCardPrices } = setupFullMocks({});

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assert(insertedCardPrices.length > 0);

    const prices = JSON.parse(insertedCardPrices[0].body);
    for (const price of prices) {
      assertEquals(
        price.confidence,
        1,
        `Price for card_id=${price.card_id} should always be high confidence (1)`,
      );
      assertEquals(
        (price as any).card_name,
        undefined,
        "card_name should not be in insert payload",
      );
    }

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — card prices insert failure returns 500",
  async () => {
    const { fetchMock } = setupFullMocks({
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
    assertEquals(body.error, "Failed to create snapshot");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Success Response Format Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — success response has expected fields",
  async () => {
    const { fetchMock } = setupFullMocks({});

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
      exchange_chaos_to_divine: 155,
      stacked_deck_chaos_cost: 2.0,
      created_at: "2024-12-15T12:00:00Z",
    };

    const { fetchMock, insertedSnapshots } = setupFullMocks({
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
    assertEquals(
      body.snapshot.fetchedAt,
      JSON.parse(insertedSnapshots[0].body).fetched_at,
    );
    assertEquals(body.snapshot.exchangeChaosToDivine, 155);
    assertEquals(body.snapshot.stackedDeckChaosCost, 2.0);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — cardCount reflects total inserted prices",
  async () => {
    const { fetchMock } = setupFullMocks({});

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // Default mock: 3 Cards in exchange (The Doctor, House of Mirrors, Rain of Chaos).
    assertEquals(body.snapshot.cardCount, 3);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — response has Content-Type application/json",
  async () => {
    const { fetchMock } = setupFullMocks({});

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

// ═══════════════════════════════════════════════════════════════════════════════
// Stacked Deck Price Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — extracts stacked deck price from currency API",
  async () => {
    const currencyData = mockCurrencyResponse(2.5);

    const { fetchMock, insertedSnapshots } = setupFullMocks({
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
  "create-snapshot-internal — poe2 with no divination card prices skips without error",
  async () => {
    const league = mockLeague({ game: "poe2", name: "Standard" });
    const exchangeData = mockExchangeResponse({
      items: [],
      lines: [],
      core: { rates: { divine: null } },
    });
    const { fetchMock, insertedCardPrices, insertedSnapshots } = setupFullMocks(
      {
        league,
        exchangeData,
        currencyData: mockCurrencyResponse(0),
      },
    );

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe2", leagueId: "Standard" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);
    assertEquals(body.skipped, true);
    assertEquals(body.reason, "no_divination_card_prices");
    assertEquals(body.game, "poe2");
    assertEquals(body.leagueName, "Standard");
    assertEquals(body.cardCount, 0);
    assertEquals(insertedCardPrices.length, 0);
    assertEquals(insertedSnapshots.length, 0);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe1 with no divination card prices still fails",
  async () => {
    const league = mockLeague({ game: "poe1", name: "Standard" });
    const exchangeData = mockExchangeResponse({
      items: [],
      lines: [],
      core: { rates: { divine: null } },
    });
    const { fetchMock, insertedCardPrices, insertedSnapshots } = setupFullMocks(
      {
        league,
        exchangeData,
      },
    );

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Standard" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertEquals(body.error, "Failed to create snapshot");
    assertEquals(insertedCardPrices.length, 0);
    assertEquals(insertedSnapshots.length, 0);

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — unresolved card IDs fails before creating snapshot",
  async () => {
    const { fetchMock, insertedCardPrices, insertedSnapshots } = setupFullMocks(
      {
        cardIdRows: [],
      },
    );

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Dawn" },
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertEquals(body.error, "Failed to create snapshot");
    assertEquals(insertedCardPrices.length, 0);
    assertEquals(insertedSnapshots.length, 0);

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
      exchangeData,
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

    assert(prices.length >= 1);
    const testCard = prices.find((p: any) => p.card_id === cardId("Test Card"));
    assert(testCard !== undefined, "Should have Test Card");
    assertEquals(testCard.chaos_value, 400);
    assertEquals(testCard.divine_value, 2.0); // 400 / 200, rounded to 2 decimals
    assertEquals(
      (testCard as any).card_name,
      undefined,
      "card_name should not be in insert payload",
    );

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CORS / Response Headers
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — success response includes CORS headers",
  async () => {
    const { fetchMock } = setupFullMocks({});

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

// ═══════════════════════════════════════════════════════════════════════════════
// gamePrefix URL Tests — poe1 vs poe2
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "create-snapshot-internal — poe1 game uses /poe1/ prefix in exchange API URL",
  async () => {
    const league = mockLeague({ game: "poe1", name: "Standard" });
    const { fetchMock } = setupFullMocks({ league });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Standard" },
      "test-cron-secret",
    );
    await handler(req);

    const exchangeCall = fetchMock.calls.find(
      (c) =>
        c.url.includes("poe.ninja") &&
        c.url.includes("exchange") &&
        c.url.includes("DivinationCard"),
    );
    assert(exchangeCall !== undefined, "Should have called exchange API");
    assertStringIncludes(
      exchangeCall!.url,
      "poe.ninja/poe1/api/economy/exchange",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe2 game uses /poe2/ prefix in exchange API URL",
  async () => {
    const league = mockLeague({ game: "poe2", name: "Standard" });
    const { fetchMock } = setupFullMocks({ league });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe2", leagueId: "Standard" },
      "test-cron-secret",
    );
    await handler(req);

    const exchangeCall = fetchMock.calls.find(
      (c) =>
        c.url.includes("poe.ninja") &&
        c.url.includes("exchange") &&
        c.url.includes("DivinationCard"),
    );
    assert(exchangeCall !== undefined, "Should have called exchange API");
    assertStringIncludes(
      exchangeCall!.url,
      "poe.ninja/poe2/api/economy/exchange",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe1 game uses /poe1/ prefix in currency API URL",
  async () => {
    const league = mockLeague({ game: "poe1", name: "Dawn" });
    const { fetchMock } = setupFullMocks({ league });

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
    assert(currencyCall !== undefined, "Should have called currency API");
    assertStringIncludes(
      currencyCall!.url,
      "poe.ninja/poe1/api/economy/exchange",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe2 game uses /poe2/ prefix in currency API URL",
  async () => {
    const league = mockLeague({ game: "poe2", name: "Standard" });
    const { fetchMock } = setupFullMocks({ league });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe2", leagueId: "Standard" },
      "test-cron-secret",
    );
    await handler(req);

    const currencyCall = fetchMock.calls.find(
      (c) =>
        c.url.includes("poe.ninja") &&
        c.url.includes("exchange") &&
        c.url.includes("Currency"),
    );
    assert(currencyCall !== undefined, "Should have called currency API");
    assertStringIncludes(
      currencyCall!.url,
      "poe.ninja/poe2/api/economy/exchange",
    );

    fetchMock.restore();
  },
);

quietTest(
  "create-snapshot-internal — poe1 game does NOT leak poe2 prefix into any URL",
  async () => {
    const league = mockLeague({ game: "poe1", name: "Settlers of Kalguur" });
    const { fetchMock } = setupFullMocks({ league });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/create-snapshot-internal",
      { game: "poe1", leagueId: "Settlers" },
      "test-cron-secret",
    );
    await handler(req);

    const ninjaUrls = fetchMock.calls
      .filter((c) => c.url.includes("poe.ninja"))
      .map((c) => c.url);

    assert(
      ninjaUrls.length >= 2,
      "Should have made poe.ninja calls for exchange and currency",
    );

    for (const url of ninjaUrls) {
      assert(
        !url.includes("/poe2/"),
        `poe1 game should not produce poe2 in URL: ${url}`,
      );
    }

    // Verify exchange and currency use /poe1/ prefix
    const exchangeCall = ninjaUrls.find(
      (u) => u.includes("exchange") && u.includes("DivinationCard"),
    );
    assert(exchangeCall !== undefined, "Should have exchange call");
    assertStringIncludes(exchangeCall!, "/poe1/");

    const currencyCall = ninjaUrls.find(
      (u) => u.includes("exchange") && u.includes("Currency"),
    );
    assert(currencyCall !== undefined, "Should have currency call");
    assertStringIncludes(currencyCall!, "/poe1/");

    assertEquals(ninjaUrls.length, 2);

    fetchMock.restore();
  },
);
