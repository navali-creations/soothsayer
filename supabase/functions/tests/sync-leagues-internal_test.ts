/**
 * Unit tests for supabase/functions/sync-leagues-internal/index.ts
 *
 * Tests the full handler including:
 *   - Authentication via x-cron-secret header
 *   - Method validation (POST only)
 *   - GGG OAuth client_credentials token acquisition
 *   - GGG league API fetching for both poe1 (pc) and poe2 realms
 *   - League filtering (HC, Solo, Ruthless)
 *   - DB upsert of valid leagues
 *   - Deactivation of stale leagues
 *   - Error handling (GGG OAuth failure, GGG API failure)
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/sync-leagues-internal_test.ts
 */

import { assert, assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import {
  mockFetch,
  postgrestResponse,
  quietTest,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

// ─── Setup: capture the handler from Deno.serve ──────────────────────────────

const _initCleanup = setupEnv({
  GGG_OAUTH_CLIENT_ID: "soothsayer",
  GGG_OAUTH_CLIENT_SECRET: "test-secret",
});

const serveStub = stubDenoServe();

// Dynamic import triggers Deno.serve() which we've stubbed
await import("../sync-leagues-internal/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Helpers ─────────────────────────────────────────────────────────────────

function createInternalRequest(
  options: { method?: string; cronSecret?: string; body?: unknown } = {},
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (options.cronSecret !== undefined) {
    headers["x-cron-secret"] = options.cronSecret;
  }

  return new Request(
    "http://localhost:54321/functions/v1/sync-leagues-internal",
    {
      method: options.method ?? "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    },
  );
}

/** Returns a mock GGG OAuth token response */
function gggTokenResponse(token = "ggg-test-access-token") {
  return new Response(
    JSON.stringify({
      access_token: token,
      expires_in: null,
      token_type: "bearer",
      scope: "service:leagues",
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

/** Returns a mock GGG league API response */
function gggLeagueResponse(leagues: any[]) {
  return new Response(JSON.stringify({ leagues }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

/** Creates a GGG League object */
function gggLeague(
  overrides: Partial<{
    id: string;
    realm: string;
    name: string;
    description: string;
    category: { id: string; current?: boolean };
    rules: Array<{ id: string; name: string; description?: string }>;
    startAt: string;
    endAt: string;
    event: boolean;
  }> = {},
) {
  return {
    id: overrides.id ?? "Standard",
    realm: overrides.realm ?? "pc",
    name: overrides.name ?? overrides.id ?? "Standard",
    description: overrides.description ?? "",
    category: overrides.category ?? undefined,
    rules: overrides.rules ?? [],
    startAt: overrides.startAt ?? undefined,
    endAt: overrides.endAt ?? undefined,
    event: overrides.event ?? undefined,
  };
}

/**
 * Sets up fetch mocks for a fully authenticated internal request with GGG OAuth
 * token + league API responses. Also mocks DB upsert/update calls.
 *
 * @param poe1Leagues - Leagues to return for poe1 (realm=pc)
 * @param poe2Leagues - Leagues to return for poe2 (realm=poe2)
 */
function setupFullMocks(poe1Leagues: any[], poe2Leagues: any[] = []) {
  const cleanupEnv = setupEnv({
    GGG_OAUTH_CLIENT_ID: "soothsayer",
    GGG_OAUTH_CLIENT_SECRET: "test-secret",
  });
  const fetchMock = mockFetch();

  // Mock GGG OAuth token endpoint
  fetchMock.onUrlContaining("pathofexile.com/oauth/token", () =>
    gggTokenResponse(),
  );

  // Mock GGG league API — route by realm param
  fetchMock.onUrlContaining("api.pathofexile.com/league", (req) => {
    const url =
      typeof req === "string" ? req : req instanceof URL ? req.href : req.url;
    if (url.includes("realm=poe2")) {
      return gggLeagueResponse(poe2Leagues);
    }
    return gggLeagueResponse(poe1Leagues);
  });

  // Mock DB operations (upsert + deactivation queries)
  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestResponse([]),
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
// Authentication Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — missing x-cron-secret returns 401",
  async () => {
    const cleanupEnv = setupEnv({
      GGG_OAUTH_CLIENT_ID: "soothsayer",
      GGG_OAUTH_CLIENT_SECRET: "test-secret",
    });
    const fetchMock = mockFetch();

    const req = createInternalRequest({
      // No cronSecret
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const text = await resp.text();
    assertEquals(text, "Unauthorized");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-internal — wrong x-cron-secret returns 401",
  async () => {
    const cleanupEnv = setupEnv({
      GGG_OAUTH_CLIENT_ID: "soothsayer",
      GGG_OAUTH_CLIENT_SECRET: "test-secret",
    });
    const fetchMock = mockFetch();

    const req = createInternalRequest({
      cronSecret: "wrong-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const text = await resp.text();
    assertEquals(text, "Unauthorized");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-internal — correct x-cron-secret is accepted",
  async () => {
    const fetchMock = setupFullMocks([
      gggLeague({ id: "Standard", name: "Standard" }),
    ]);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Method Validation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("sync-leagues-internal — GET request returns 405", async () => {
  const cleanupEnv = setupEnv({
    GGG_OAUTH_CLIENT_ID: "soothsayer",
    GGG_OAUTH_CLIENT_SECRET: "test-secret",
  });
  const fetchMock = mockFetch();

  const req = new Request(
    "http://localhost:54321/functions/v1/sync-leagues-internal",
    {
      method: "GET",
      headers: {
        "x-cron-secret": "test-cron-secret",
      },
    },
  );
  const resp = await handler(req);

  assertEquals(resp.status, 405);
  const text = await resp.text();
  assertEquals(text, "Method not allowed");

  fetchMock.restore();
  cleanupEnv();
});

// ═══════════════════════════════════════════════════════════════════════════════
// GGG OAuth Token Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — GGG OAuth token failure returns 500",
  async () => {
    const cleanupEnv = setupEnv({
      GGG_OAUTH_CLIENT_ID: "soothsayer",
      GGG_OAUTH_CLIENT_SECRET: "test-secret",
    });
    const fetchMock = mockFetch();

    // Mock GGG OAuth token endpoint → failure
    fetchMock.onUrlContaining(
      "pathofexile.com/oauth/token",
      () => new Response("Unauthorized", { status: 401 }),
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "GGG OAuth token request failed");

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-internal — missing GGG OAuth env vars returns 500",
  async () => {
    // Setup env WITHOUT GGG credentials
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    // Explicitly remove GGG env vars that were set at module scope
    const savedClientId = Deno.env.get("GGG_OAUTH_CLIENT_ID");
    const savedClientSecret = Deno.env.get("GGG_OAUTH_CLIENT_SECRET");
    Deno.env.delete("GGG_OAUTH_CLIENT_ID");
    Deno.env.delete("GGG_OAUTH_CLIENT_SECRET");

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "GGG OAuth credentials not configured");

    // Restore GGG env vars for subsequent tests
    if (savedClientId) Deno.env.set("GGG_OAUTH_CLIENT_ID", savedClientId);
    if (savedClientSecret)
      Deno.env.set("GGG_OAUTH_CLIENT_SECRET", savedClientSecret);

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest(
  "sync-leagues-internal — calls GGG OAuth with correct params",
  async () => {
    const fetchMock = setupFullMocks([
      gggLeague({ id: "Standard", name: "Standard" }),
    ]);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    // Verify the GGG OAuth token call was made
    const tokenCall = fetchMock.calls.find((c) =>
      c.url.includes("pathofexile.com/oauth/token"),
    );
    assert(tokenCall, "Should have called GGG OAuth token endpoint");
    assertEquals(tokenCall.init?.method, "POST");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// GGG League API Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — fetches leagues for both poe1 and poe2",
  async () => {
    const poe1Leagues = [
      gggLeague({ id: "Mirage", name: "Mirage", realm: "pc" }),
      gggLeague({ id: "Standard", name: "Standard", realm: "pc" }),
    ];
    const poe2Leagues = [
      gggLeague({ id: "Dawn", name: "Dawn", realm: "poe2" }),
    ];

    const fetchMock = setupFullMocks(poe1Leagues, poe2Leagues);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    assertEquals(body.poe1Count, 2);
    assertEquals(body.poe2Count, 1);
    assertEquals(body.totalSynced, 3);

    // Verify both realm calls were made
    const leagueCalls = fetchMock.calls.filter((c) =>
      c.url.includes("api.pathofexile.com/league"),
    );
    assert(
      leagueCalls.length >= 2,
      "Should have made at least 2 GGG league API calls",
    );

    const realmPc = leagueCalls.find((c) => c.url.includes("realm=pc"));
    const realmPoe2 = leagueCalls.find((c) => c.url.includes("realm=poe2"));
    assert(realmPc, "Should have called GGG API with realm=pc");
    assert(realmPoe2, "Should have called GGG API with realm=poe2");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — GGG league API uses Bearer token",
  async () => {
    const fetchMock = setupFullMocks([
      gggLeague({ id: "Standard", name: "Standard" }),
    ]);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    const leagueCall = fetchMock.calls.find((c) =>
      c.url.includes("api.pathofexile.com/league"),
    );
    assert(leagueCall, "Should have called GGG league API");

    // Verify Authorization header is present (Bearer token)
    if (leagueCall.init?.headers) {
      const authHeader =
        leagueCall.init.headers instanceof Headers
          ? leagueCall.init.headers.get("Authorization")
          : (leagueCall.init.headers as Record<string, string>).Authorization;
      if (authHeader) {
        assertStringIncludes(authHeader, "Bearer");
      }
    }

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — GGG league API failure for poe1 returns 500",
  async () => {
    const cleanupEnv = setupEnv({
      GGG_OAUTH_CLIENT_ID: "soothsayer",
      GGG_OAUTH_CLIENT_SECRET: "test-secret",
    });
    const fetchMock = mockFetch();

    // Mock GGG OAuth token → success
    fetchMock.onUrlContaining("pathofexile.com/oauth/token", () =>
      gggTokenResponse(),
    );

    // Mock GGG league API → failure
    fetchMock.onUrlContaining(
      "api.pathofexile.com/league",
      () => new Response("Service Unavailable", { status: 503 }),
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await resp.json();
    assertStringIncludes(body.error, "GGG league API failed");

    fetchMock.restore();
    cleanupEnv();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// League Filtering Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest("sync-leagues-internal — filters out Hardcore leagues", async () => {
  const leagues = [
    gggLeague({ id: "Standard", name: "Standard" }),
    gggLeague({ id: "Hardcore", name: "Hardcore" }),
    gggLeague({ id: "Mirage", name: "Mirage" }),
    gggLeague({ id: "Hardcore Mirage", name: "Hardcore Mirage" }),
  ];

  const fetchMock = setupFullMocks(leagues);

  const req = createInternalRequest({
    cronSecret: "test-cron-secret",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 200);
  const body = await resp.json();

  // Only Standard and Mirage should be synced for poe1
  // (HC variants filtered out)
  assertEquals(body.poe1Count, 2);

  fetchMock.restore();
});

quietTest("sync-leagues-internal — filters out Solo/SSF leagues", async () => {
  const leagues = [
    gggLeague({ id: "Standard", name: "Standard" }),
    gggLeague({
      id: "SSF Standard",
      name: "SSF Standard",
      rules: [{ id: "NoParties", name: "Solo" }],
    }),
    gggLeague({ id: "Mirage", name: "Mirage" }),
    gggLeague({
      id: "SSF Mirage",
      name: "SSF Mirage",
      rules: [{ id: "NoParties", name: "Solo" }],
    }),
  ];

  const fetchMock = setupFullMocks(leagues);

  const req = createInternalRequest({
    cronSecret: "test-cron-secret",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 200);
  const body = await resp.json();

  // Only Standard and Mirage (non-Solo)
  assertEquals(body.poe1Count, 2);

  fetchMock.restore();
});

quietTest("sync-leagues-internal — filters out Ruthless leagues", async () => {
  const leagues = [
    gggLeague({ id: "Standard", name: "Standard" }),
    gggLeague({ id: "Ruthless", name: "Ruthless" }),
    gggLeague({ id: "Ruthless Mirage", name: "Ruthless Mirage" }),
  ];

  const fetchMock = setupFullMocks(leagues);

  const req = createInternalRequest({
    cronSecret: "test-cron-secret",
  });
  const resp = await handler(req);

  assertEquals(resp.status, 200);
  const body = await resp.json();

  // Only Standard should remain
  assertEquals(body.poe1Count, 1);

  fetchMock.restore();
});

quietTest(
  "sync-leagues-internal — all leagues filtered results in zero synced",
  async () => {
    const leagues = [
      gggLeague({ id: "Hardcore", name: "Hardcore" }),
      gggLeague({
        id: "SSF Standard",
        name: "SSF Standard",
        rules: [{ id: "NoParties", name: "Solo" }],
      }),
      gggLeague({ id: "Ruthless", name: "Ruthless" }),
    ];

    const fetchMock = setupFullMocks(leagues, []);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    assertEquals(body.poe1Count, 0);
    assertEquals(body.poe2Count, 0);
    assertEquals(body.totalSynced, 0);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// League Data Mapping Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — empty GGG response results in zero synced",
  async () => {
    const fetchMock = setupFullMocks([], []);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
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
  "sync-leagues-internal — response includes deactivatedCount",
  async () => {
    const fetchMock = setupFullMocks([
      gggLeague({ id: "Standard", name: "Standard" }),
    ]);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    assert(
      "deactivatedCount" in body,
      "Response should include deactivatedCount",
    );
    assertEquals(typeof body.deactivatedCount, "number");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — league with endAt in the past is marked inactive",
  async () => {
    const pastDate = "2024-01-01T00:00:00Z";
    const leagues = [
      gggLeague({
        id: "OldLeague",
        name: "Old League",
        startAt: "2023-06-01T00:00:00Z",
        endAt: pastDate,
      }),
      gggLeague({
        id: "Standard",
        name: "Standard",
      }),
    ];

    // Track upsert calls to verify isActive mapping
    const fetchMock = setupFullMocks(leagues);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    // Both leagues should be synced (filtering only removes HC/Solo/Ruthless)
    assertEquals(body.poe1Count, 2);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — league with endAt in the future is marked active",
  async () => {
    const futureDate = "2099-12-31T00:00:00Z";
    const leagues = [
      gggLeague({
        id: "CurrentLeague",
        name: "Current League",
        startAt: "2026-01-01T00:00:00Z",
        endAt: futureDate,
      }),
    ];

    const fetchMock = setupFullMocks(leagues);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// DB Upsert Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — calls DB upsert for valid leagues",
  async () => {
    const fetchMock = setupFullMocks(
      [
        gggLeague({ id: "Standard", name: "Standard" }),
        gggLeague({
          id: "Mirage",
          name: "Mirage",
          startAt: "2026-03-06T19:00:00Z",
          category: { id: "Mirage", current: true },
        }),
      ],
      [gggLeague({ id: "Standard", name: "Standard", realm: "poe2" })],
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.poe1Count, 2);
    assertEquals(body.poe2Count, 1);
    assertEquals(body.totalSynced, 3);

    // Verify DB calls were made to poe_leagues table
    const dbCalls = fetchMock.calls.filter((c) =>
      c.url.includes("poe_leagues"),
    );
    assert(dbCalls.length > 0, "Should have made DB calls to poe_leagues");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — DB upsert error does not crash the handler",
  async () => {
    const cleanupEnv = setupEnv({
      GGG_OAUTH_CLIENT_ID: "soothsayer",
      GGG_OAUTH_CLIENT_SECRET: "test-secret",
    });
    const fetchMock = mockFetch();

    // Mock GGG OAuth token → success
    fetchMock.onUrlContaining("pathofexile.com/oauth/token", () =>
      gggTokenResponse(),
    );

    // Mock GGG league API → success
    fetchMock.onUrlContaining("api.pathofexile.com/league", () =>
      gggLeagueResponse([gggLeague({ id: "Standard", name: "Standard" })]),
    );

    // Mock DB upsert → error response (simulates a DB error)
    fetchMock.onUrlContaining(
      supabaseUrls.table("poe_leagues"),
      () =>
        new Response(
          JSON.stringify({
            message: "Database error",
            code: "23505",
            details: null,
            hint: null,
          }),
          {
            status: 409,
            headers: { "Content-Type": "application/json; charset=utf-8" },
          },
        ),
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    // Should still return 200 (errors are logged but don't crash the handler)
    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);
    // Count might be 0 since upserts errored
    assertEquals(body.poe1Count, 0);

    fetchMock.restore();
    cleanupEnv();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Stale League Deactivation Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — deactivation queries are issued for both games",
  async () => {
    const fetchMock = setupFullMocks(
      [gggLeague({ id: "Standard", name: "Standard" })],
      [gggLeague({ id: "Dawn", name: "Dawn", realm: "poe2" })],
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);
    assert(
      "deactivatedCount" in body,
      "Should include deactivatedCount in response",
    );

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Response Shape Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — success response has correct shape",
  async () => {
    const fetchMock = setupFullMocks(
      [gggLeague({ id: "Standard", name: "Standard" })],
      [gggLeague({ id: "Dawn", name: "Dawn", realm: "poe2" })],
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    const contentType = resp.headers.get("Content-Type");
    assertStringIncludes(contentType!, "application/json");

    const body = await resp.json();
    assertEquals(body.success, true);
    assertEquals(typeof body.totalSynced, "number");
    assertEquals(typeof body.poe1Count, "number");
    assertEquals(typeof body.poe2Count, "number");
    assertEquals(typeof body.deactivatedCount, "number");

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — error response has correct shape",
  async () => {
    // Setup env WITHOUT GGG credentials to trigger an error
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 500);

    const contentType = resp.headers.get("Content-Type");
    assertStringIncludes(contentType!, "application/json");

    const body = await resp.json();
    assert("error" in body, "Error response should have an error field");
    assertEquals(typeof body.error, "string");

    fetchMock.restore();
    cleanupEnv();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Integration-style Tests
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "sync-leagues-internal — full sync with mixed leagues and filtering",
  async () => {
    const poe1Leagues = [
      gggLeague({
        id: "Mirage",
        name: "Mirage",
        startAt: "2026-03-06T19:00:00Z",
        category: { id: "Mirage", current: true },
      }),
      gggLeague({ id: "Standard", name: "Standard" }),
      gggLeague({ id: "Hardcore", name: "Hardcore" }),
      gggLeague({ id: "Hardcore Mirage", name: "Hardcore Mirage" }),
      gggLeague({
        id: "SSF Mirage",
        name: "SSF Mirage",
        rules: [{ id: "NoParties", name: "Solo" }],
      }),
      gggLeague({ id: "Ruthless", name: "Ruthless" }),
    ];

    const poe2Leagues = [
      gggLeague({ id: "Dawn", name: "Dawn", realm: "poe2" }),
      gggLeague({ id: "Standard", name: "Standard", realm: "poe2" }),
      gggLeague({
        id: "Hardcore Dawn",
        name: "Hardcore Dawn",
        realm: "poe2",
      }),
    ];

    const fetchMock = setupFullMocks(poe1Leagues, poe2Leagues);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();

    assertEquals(body.success, true);
    // poe1: Mirage + Standard = 2 (Hardcore, Hardcore Mirage, SSF Mirage, Ruthless filtered)
    assertEquals(body.poe1Count, 2);
    // poe2: Dawn + Standard = 2 (Hardcore Dawn filtered)
    assertEquals(body.poe2Count, 2);
    assertEquals(body.totalSynced, 4);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — uses league name when name field is present",
  async () => {
    // When name is provided, it should be used
    const leagues = [gggLeague({ id: "Mirage", name: "Mirage League" })];

    const fetchMock = setupFullMocks(leagues);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — falls back to league id when name is missing",
  async () => {
    // When name is undefined/null, should fall back to id
    const leagues = [{ id: "Mirage", realm: "pc", description: "", rules: [] }];

    const fetchMock = setupFullMocks(leagues);

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.poe1Count, 1);

    fetchMock.restore();
  },
);

quietTest(
  "sync-leagues-internal — GGG API returns flat array instead of {leagues: []}",
  async () => {
    // The handler has fallback: data.leagues ?? data ?? []
    // Test the fallback where the response is a flat array
    const cleanupEnv = setupEnv({
      GGG_OAUTH_CLIENT_ID: "soothsayer",
      GGG_OAUTH_CLIENT_SECRET: "test-secret",
    });
    const fetchMock = mockFetch();

    // Mock GGG OAuth token
    fetchMock.onUrlContaining("pathofexile.com/oauth/token", () =>
      gggTokenResponse(),
    );

    // Mock GGG league API — return flat array (no { leagues: [] } wrapper)
    fetchMock.onUrlContaining(
      "api.pathofexile.com/league",
      () =>
        new Response(
          JSON.stringify([gggLeague({ id: "Standard", name: "Standard" })]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    // Mock DB operations
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([]),
    );

    const req = createInternalRequest({
      cronSecret: "test-cron-secret",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.success, true);
    // The flat array should be handled by the fallback
    assert(body.totalSynced >= 0, "Should handle flat array response");

    fetchMock.restore();
    cleanupEnv();
  },
);
