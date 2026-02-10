/**
 * Unit tests for supabase/functions/sync-leagues-legacy-internal/index.ts
 *
 * Tests the full handler including:
 *   - Internal cron authentication (x-cron-secret header)
 *   - HTTP method validation
 *   - PoE1 and PoE2 API fetching
 *   - League filtering logic (HC, Solo, Ruthless exclusion)
 *   - Database upsert operations
 *   - Stale league deactivation
 *   - Error handling for API failures
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/sync-leagues-legacy-internal-test.ts
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  createInternalRequest,
  createMockRequest,
  mockFetch,
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
await import("../sync-leagues-legacy-internal/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Mock Data Factories ─────────────────────────────────────────────────────

function createPoe1League(overrides: Record<string, unknown> = {}) {
  return {
    id: "Dawn",
    name: "Dawn",
    startAt: "2024-12-01T00:00:00Z",
    endAt: null,
    rules: [],
    ...overrides,
  };
}

function createPoe2League(overrides: Record<string, unknown> = {}) {
  return {
    id: "Dawn",
    text: "Dawn",
    ...overrides,
  };
}

/** Standard set of valid PoE1 leagues (no HC/Solo/Ruthless) */
function validPoe1Leagues() {
  return [
    createPoe1League({ id: "Dawn", name: "Dawn" }),
    createPoe1League({ id: "Standard", name: "Standard" }),
  ];
}

/** Standard set of valid PoE2 leagues */
function validPoe2Leagues() {
  return {
    result: [
      createPoe2League({ id: "Dawn", text: "Dawn" }),
      createPoe2League({ id: "Standard", text: "Standard" }),
    ],
  };
}

/**
 * Sets up fetch mocks for both PoE APIs and Supabase DB operations.
 * Returns the mock so routes can be customized.
 */
function setupFullMocks(
  options: {
    poe1Leagues?: unknown[];
    poe2Data?: unknown;
    upsertError?: boolean;
    deactivateError?: boolean;
  } = {},
) {
  // Ensure env is set for every test that uses this helper
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();
  const upsertCalls: Array<{ url: string; body: string }> = [];
  const deactivateCalls: Array<{ url: string; body: string }> = [];

  // Mock PoE1 API
  fetchMock.onUrlContaining(
    "pathofexile.com/api/leagues",
    () =>
      new Response(JSON.stringify(options.poe1Leagues ?? validPoe1Leagues()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );

  // Mock PoE2 API
  fetchMock.onUrlContaining(
    "pathofexile.com/api/trade2/data/leagues",
    () =>
      new Response(JSON.stringify(options.poe2Data ?? validPoe2Leagues()), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
  );

  // Mock Supabase upsert (POST to poe_leagues)
  fetchMock.addRoute({
    match: (url, init) => {
      const isLeaguesTable = url.includes(supabaseUrls.table("poe_leagues"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isLeaguesTable && method === "POST";
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
      upsertCalls.push({
        url: typeof input === "string" ? input : (input as Request).url,
        body,
      });

      if (options.upsertError) {
        return new Response(
          JSON.stringify({ message: "upsert failed", code: "23505" }),
          { status: 409, headers: { "Content-Type": "application/json" } },
        );
      }
      return postgrestResponse([{ id: "uuid-upserted" }], 201);
    },
  });

  // Mock Supabase deactivate (PATCH to poe_leagues)
  fetchMock.addRoute({
    match: (url, init) => {
      const isLeaguesTable = url.includes(supabaseUrls.table("poe_leagues"));
      const method = init?.method?.toUpperCase() ?? "GET";
      return isLeaguesTable && method === "PATCH";
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
      deactivateCalls.push({
        url: typeof input === "string" ? input : (input as Request).url,
        body,
      });

      if (options.deactivateError) {
        return new Response(
          JSON.stringify({ message: "deactivate failed", code: "42501" }),
          { status: 403, headers: { "Content-Type": "application/json" } },
        );
      }
      return postgrestResponse([], 200, { "Content-Range": "0-0/0" });
    },
  });

  // Wrap restore so callers don't need to remember cleanupEnv
  const originalRestore = fetchMock.restore.bind(fetchMock);
  fetchMock.restore = () => {
    originalRestore();
    cleanupEnv();
  };

  return { fetchMock, upsertCalls, deactivateCalls };
}

// ═══════════════════════════════════════════════════════════════════════════════
// Authentication Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — missing cron secret returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createMockRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      { method: "POST" },
    );
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const text = await resp.text();
    assertEquals(text, "Unauthorized");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-legacy-internal — wrong cron secret returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "wrong-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const text = await resp.text();
    assertEquals(text, "Unauthorized");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-legacy-internal — correct cron secret is accepted",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret", // Matches the default from setupEnv()
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
  "sync-leagues-legacy-internal — GET request returns 405",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createMockRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {
        method: "GET",
        cronSecret: "test-cron-secret",
      },
    );
    const resp = await handler(req);

    assertEquals(resp.status, 405);
    const text = await resp.text();
    assertStringIncludes(text, "Method not allowed");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-legacy-internal — empty cron secret returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createMockRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {
        method: "POST",
        cronSecret: "",
      },
    );
    const resp = await handler(req);

    assertEquals(resp.status, 401);

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-legacy-internal — PUT request returns 405",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createMockRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {
        method: "DELETE",
        cronSecret: "test-cron-secret",
      },
    );
    const resp = await handler(req);

    assertEquals(resp.status, 405);

    fetchMock.restore();
    cleanupEnv();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// League Filtering Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — filters out Hardcore leagues",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({ id: "Hardcore Dawn", name: "Hardcore Dawn" }),
      createPoe1League({ id: "Standard", name: "Standard" }),
      createPoe1League({ id: "Hardcore", name: "Hardcore" }),
    ];

    const { fetchMock, upsertCalls } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // Only 2 valid leagues should be upserted (Dawn and Standard)
    assertEquals(body.totalSynced, 2);
    assertEquals(body.poe1Count, 2);

    // Verify that upsert calls don't include Hardcore leagues
    const upsertedNames = upsertCalls
      .map((c) => {
        try {
          return JSON.parse(c.body);
        } catch {
          return null;
        }
      })
      .filter(Boolean);
    const leagueIds = upsertedNames.map((u: any) => u.league_id);
    assert(
      !leagueIds.includes("Hardcore Dawn"),
      "Should not include Hardcore Dawn",
    );
    assert(!leagueIds.includes("Hardcore"), "Should not include Hardcore");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — filters out HC suffix leagues",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({ id: "Dawn HC", name: "Dawn HC" }),
    ];

    const { fetchMock } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // HC variant should be filtered
    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — filters out Solo rule leagues",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({
        id: "Solo Self-Found Dawn",
        name: "Solo Self-Found Dawn",
        rules: [{ name: "Solo", description: "Play solo" }],
      }),
    ];

    const { fetchMock } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — filters out Ruthless leagues",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({ id: "Ruthless Dawn", name: "Ruthless Dawn" }),
      createPoe1League({ id: "ruthless Standard", name: "Ruthless Standard" }),
    ];

    const { fetchMock } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — filters PoE2 HC leagues too",
  async () => {
    const poe2Data = {
      result: [
        createPoe2League({ id: "Dawn", text: "Dawn" }),
        createPoe2League({ id: "Hardcore Dawn", text: "Hardcore Dawn" }),
        createPoe2League({ id: "Standard", text: "Standard" }),
      ],
    };

    const { fetchMock } = setupFullMocks({ poe1Leagues: [], poe2Data });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.poe2Count, 2); // Dawn + Standard, no Hardcore Dawn

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — keeps valid leagues with no filter triggers",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({ id: "Standard", name: "Standard" }),
      createPoe1League({
        id: "Settlers of Kalguur",
        name: "Settlers of Kalguur",
        startAt: "2024-07-01T00:00:00Z",
        endAt: "2024-10-01T00:00:00Z",
      }),
    ];

    const { fetchMock } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.poe1Count, 3);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PoE API Call Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — calls PoE1 API with correct URL",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    await handler(req);

    const poe1Call = fetchMock.calls.find((c) =>
      c.url.includes("pathofexile.com/api/leagues"),
    );
    assert(poe1Call !== undefined, "Should have called PoE1 API");
    assertEquals(poe1Call!.url, "https://www.pathofexile.com/api/leagues");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — calls PoE2 API with correct URL",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    await handler(req);

    const poe2Call = fetchMock.calls.find((c) =>
      c.url.includes("pathofexile.com/api/trade2/data/leagues"),
    );
    assert(poe2Call !== undefined, "Should have called PoE2 API");
    assertEquals(
      poe2Call!.url,
      "https://www.pathofexile.com/api/trade2/data/leagues",
    );

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — includes User-Agent in PoE API calls",
  async () => {
    const fetchMock = mockFetch();
    let capturedHeaders: Record<string, string> = {};

    // Capture headers from PoE1 API call
    fetchMock.addRoute({
      match: (url) => url.includes("pathofexile.com/api/leagues"),
      handler: (input, init) => {
        if (init?.headers) {
          const headers = init.headers as Record<string, string>;
          capturedHeaders = { ...headers };
        } else if (typeof input === "object" && "headers" in input) {
          const req = input as Request;
          req.headers.forEach((value, key) => {
            capturedHeaders[key] = value;
          });
        }
        return new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      },
    });

    // Mock PoE2 API
    fetchMock.onUrlContaining(
      "trade2/data/leagues",
      () =>
        new Response(JSON.stringify({ result: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    // Mock Supabase (no leagues to upsert)
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([], 200),
    );

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    await handler(req);

    const userAgent =
      capturedHeaders["User-Agent"] || capturedHeaders["user-agent"] || "";
    assertStringIncludes(userAgent, "Soothsayer");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PoE API Error Handling
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — PoE1 API failure returns 500",
  async () => {
    const fetchMock = mockFetch();

    // PoE1 API fails
    fetchMock.onUrlContaining(
      "pathofexile.com/api/leagues",
      () => new Response("Service Unavailable", { status: 503 }),
    );

    // PoE2 API succeeds
    fetchMock.onUrlContaining(
      "trade2/data/leagues",
      () =>
        new Response(JSON.stringify({ result: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assert(body.error !== undefined, "Should have error field");
    assertStringIncludes(body.error, "PoE1 API failed");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — PoE2 API failure returns 500",
  async () => {
    const fetchMock = mockFetch();

    // PoE1 API succeeds
    fetchMock.onUrlContaining(
      "pathofexile.com/api/leagues",
      () =>
        new Response(JSON.stringify([]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    // PoE2 API fails
    fetchMock.onUrlContaining(
      "trade2/data/leagues",
      () => new Response("Bad Gateway", { status: 502 }),
    );

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assert(body.error !== undefined, "Should have error field");
    assertStringIncludes(body.error, "PoE2 API failed");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Upsert Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — upserts valid PoE1 leagues with correct fields",
  async () => {
    const poe1Leagues = [
      createPoe1League({
        id: "Dawn",
        name: "Dawn",
        startAt: "2024-12-01T00:00:00Z",
        endAt: null,
      }),
    ];

    const { fetchMock, upsertCalls } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(upsertCalls.length, 1);

    const upserted = JSON.parse(upsertCalls[0].body);
    assertEquals(upserted.game, "poe1");
    assertEquals(upserted.league_id, "Dawn");
    assertEquals(upserted.name, "Dawn");
    assertEquals(upserted.start_at, "2024-12-01T00:00:00Z");
    assertEquals(upserted.end_at, null);
    assertEquals(upserted.is_active, true);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — upserts valid PoE2 leagues with correct fields",
  async () => {
    const poe2Data = {
      result: [createPoe2League({ id: "Dawn", text: "Dawn" })],
    };

    const { fetchMock, upsertCalls } = setupFullMocks({
      poe1Leagues: [],
      poe2Data,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(upsertCalls.length, 1);

    const upserted = JSON.parse(upsertCalls[0].body);
    assertEquals(upserted.game, "poe2");
    assertEquals(upserted.league_id, "Dawn");
    assertEquals(upserted.name, "Dawn");
    assertEquals(upserted.start_at, null); // PoE2 leagues don't have startAt
    assertEquals(upserted.end_at, null);
    assertEquals(upserted.is_active, true); // PoE2 leagues are always active

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — PoE1 league with past endAt is still upserted",
  async () => {
    const pastDate = new Date(Date.now() - 86400000).toISOString(); // Yesterday
    const poe1Leagues = [
      createPoe1League({
        id: "ExpiredLeague",
        name: "Expired League",
        endAt: pastDate,
      }),
    ];

    const { fetchMock, upsertCalls } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(upsertCalls.length, 1);

    const upserted = JSON.parse(upsertCalls[0].body);
    assertEquals(upserted.is_active, false); // endAt in the past → inactive

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — counts synced leagues in response",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({ id: "Standard", name: "Standard" }),
    ];
    const poe2Data = {
      result: [createPoe2League({ id: "Dawn", text: "Dawn" })],
    };

    const { fetchMock } = setupFullMocks({ poe1Leagues, poe2Data });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    assertEquals(body.totalSynced, 3);
    assertEquals(body.poe1Count, 2);
    assertEquals(body.poe2Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — upsert failure still counts other successes",
  async () => {
    const fetchMock = mockFetch();
    let callIndex = 0;

    // PoE1 API
    fetchMock.onUrlContaining(
      "pathofexile.com/api/leagues",
      () =>
        new Response(
          JSON.stringify([
            createPoe1League({ id: "Dawn", name: "Dawn" }),
            createPoe1League({ id: "Standard", name: "Standard" }),
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    // PoE2 API
    fetchMock.onUrlContaining(
      "trade2/data/leagues",
      () =>
        new Response(JSON.stringify({ result: [] }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    // First upsert succeeds, second fails
    fetchMock.addRoute({
      match: (url, init) => {
        const isLeaguesTable = url.includes(supabaseUrls.table("poe_leagues"));
        const method = init?.method?.toUpperCase() ?? "GET";
        return isLeaguesTable && method === "POST";
      },
      handler: () => {
        callIndex++;
        if (callIndex === 2) {
          return new Response(
            JSON.stringify({ message: "upsert failed", code: "23505" }),
            { status: 409, headers: { "Content-Type": "application/json" } },
          );
        }
        return postgrestResponse([{ id: "uuid-ok" }], 201);
      },
    });

    // Mock deactivate
    fetchMock.addRoute({
      match: (url, init) => {
        const isLeaguesTable = url.includes(supabaseUrls.table("poe_leagues"));
        const method = init?.method?.toUpperCase() ?? "GET";
        return isLeaguesTable && method === "PATCH";
      },
      handler: () => postgrestResponse([], 200, { "Content-Range": "0-0/0" }),
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // One succeeded, one failed
    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Deactivation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — deactivation count is returned",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // deactivatedCount should be a number (0 or more depending on mock)
    assert(
      typeof body.deactivatedCount === "number",
      "deactivatedCount should be a number",
    );

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — deactivation error is handled gracefully",
  async () => {
    const { fetchMock } = setupFullMocks({ deactivateError: true });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    // Should still succeed overall even if deactivation fails
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// PoE2 text/name Handling Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — PoE2 league uses 'text' field as name",
  async () => {
    const poe2Data = {
      result: [
        createPoe2League({
          id: "dawn-league",
          text: "Dawn League Display Name",
        }),
      ],
    };

    const { fetchMock, upsertCalls } = setupFullMocks({
      poe1Leagues: [],
      poe2Data,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(upsertCalls.length, 1);

    const upserted = JSON.parse(upsertCalls[0].body);
    assertEquals(upserted.name, "Dawn League Display Name");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — PoE2 league falls back to id if no text",
  async () => {
    const poe2Data = {
      result: [
        { id: "dawn-fallback" }, // No 'text' field
      ],
    };

    const { fetchMock, upsertCalls } = setupFullMocks({
      poe1Leagues: [],
      poe2Data,
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(upsertCalls.length, 1);

    const upserted = JSON.parse(upsertCalls[0].body);
    assertEquals(upserted.name, "dawn-fallback");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Empty Results Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — no leagues from either API returns success with zero counts",
  async () => {
    const { fetchMock } = setupFullMocks({
      poe1Leagues: [],
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    assertEquals(body.totalSynced, 0);
    assertEquals(body.poe1Count, 0);
    assertEquals(body.poe2Count, 0);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — all leagues filtered out returns zero counts",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Hardcore", name: "Hardcore" }),
      createPoe1League({ id: "Ruthless Standard", name: "Ruthless Standard" }),
      createPoe1League({
        id: "SSF Solo",
        name: "SSF Solo",
        rules: [{ name: "Solo", description: "Play solo" }],
      }),
    ];
    const poe2Data = {
      result: [
        createPoe2League({ id: "Hardcore Dawn", text: "Hardcore Dawn" }),
      ],
    };

    const { fetchMock } = setupFullMocks({ poe1Leagues, poe2Data });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.totalSynced, 0);
    assertEquals(body.poe1Count, 0);
    assertEquals(body.poe2Count, 0);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Response Format Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — response has Content-Type application/json",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    assertEquals(resp.headers.get("Content-Type"), "application/json");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — response body has all expected fields",
  async () => {
    const { fetchMock } = setupFullMocks();

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assert("success" in body, "Response should have 'success' field");
    assert("totalSynced" in body, "Response should have 'totalSynced' field");
    assert("poe1Count" in body, "Response should have 'poe1Count' field");
    assert("poe2Count" in body, "Response should have 'poe2Count' field");
    assert(
      "deactivatedCount" in body,
      "Response should have 'deactivatedCount' field",
    );

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Mixed Filtering Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-legacy-internal — case-insensitive HC filtering",
  async () => {
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      createPoe1League({ id: "HARDCORE Dawn", name: "HARDCORE Dawn" }),
      createPoe1League({ id: "HardCore Standard", name: "HardCore Standard" }),
    ];

    const { fetchMock } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // Only "Dawn" should survive, the others have "hardcore" in their lowercased id/name
    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-legacy-internal — league with hc in normal word is filtered",
  async () => {
    // Note: The filter checks for "hc" substring which means leagues with "hc"
    // anywhere in their lowercased id/name will be filtered. This tests that behavior.
    const poe1Leagues = [
      createPoe1League({ id: "Dawn", name: "Dawn" }),
      // "hc" appears as substring in the id (lowercased)
      createPoe1League({ id: "matchcraft", name: "Matchcraft" }),
    ];

    const { fetchMock } = setupFullMocks({
      poe1Leagues,
      poe2Data: { result: [] },
    });

    const req = createInternalRequest(
      "http://localhost:54321/functions/v1/sync-leagues-legacy-internal",
      {},
      "test-cron-secret",
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // "matchcraft" contains "hc" so will be filtered by the current implementation
    // This documents the current behavior
    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);
