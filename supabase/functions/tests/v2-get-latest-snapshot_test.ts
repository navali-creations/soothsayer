/**
 * Unit tests for supabase/functions/v2-get-latest-snapshot/index.ts
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createMockRequest,
  createOptionsRequest,
  createTestJwt,
  mockCardPrices,
  mockFetch,
  mockLeague,
  mockSnapshot,
  postgrestError,
  postgrestResponse,
  quietTest,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

const _initCleanup = setupEnv();
const serveStub = stubDenoServe();

await import("../v2-get-latest-snapshot/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

function createFunctionRequest(
  options: {
    method?: string;
    body?: unknown;
    bearerToken?: string;
    apikey?: string;
    appVersion?: string;
  } = {},
): Request {
  return createMockRequest(
    "http://localhost:54321/functions/v1/v2-get-latest-snapshot",
    {
      method: options.method ?? "POST",
      body: options.body,
      bearerToken: options.bearerToken,
      apikey: options.apikey,
      appVersion: options.appVersion,
    },
  );
}

function setupAuthorizedMocks(
  options: { userId?: string; isAnonymous?: boolean } = {},
) {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();
  const userId = options.userId ?? "anon-user-001";

  fetchMock.onUrlContaining(
    "/auth/v1/user",
    () =>
      new Response(
        JSON.stringify({
          user: {
            id: userId,
            aud: "authenticated",
            role: "authenticated",
            is_anonymous: options.isAnonymous ?? true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );

  const originalRestore = fetchMock.restore.bind(fetchMock);
  fetchMock.restore = () => {
    originalRestore();
    cleanupEnv();
  };

  return fetchMock;
}

function setupSnapshotQueries(fetchMock: ReturnType<typeof mockFetch>) {
  fetchMock.addRoute({
    match: (url) => url.includes(supabaseUrls.table("poe_leagues")),
    handler: () => postgrestResponse(mockLeague({ id: "league-uuid-001" })),
  });

  fetchMock.addRoute({
    match: (url) => url.includes(supabaseUrls.table("snapshots")),
    handler: () =>
      postgrestResponse(
        mockSnapshot({
          id: "snapshot-uuid-001",
          league_id: "league-uuid-001",
          fetched_at: "2024-12-15T12:00:00Z",
          exchange_chaos_to_divine: 150,
          stacked_deck_chaos_cost: 1.5,
          stacked_deck_max_volume_rate: 64.93,
        }),
      ),
  });

  fetchMock.addRoute({
    match: (url) => url.includes(supabaseUrls.table("card_prices")),
    handler: () => postgrestResponse(mockCardPrices("snapshot-uuid-001")),
  });
}

function getHeader(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

quietTest("v2-get-latest-snapshot - OPTIONS returns 200", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createOptionsRequest(
      "http://localhost:54321/functions/v1/v2-get-latest-snapshot",
    ),
  );

  assertEquals(resp.status, 200);
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-latest-snapshot - missing apikey returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createFunctionRequest({
      bearerToken: createTestJwt(),
      body: { game: "poe2", league: "Dawn" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Missing apikey header");
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-latest-snapshot - invalid apikey returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createFunctionRequest({
      apikey: "wrong-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2", league: "Dawn" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Invalid apikey header");
  fetchMock.restore();
  cleanupEnv();
});

quietTest(
  "v2-get-latest-snapshot - missing Authorization returns 401",
  async () => {
    const cleanupEnv = setupEnv();
    const fetchMock = mockFetch();

    const resp = await handler(
      createFunctionRequest({
        apikey: "test-publishable-key",
        body: { game: "poe2", league: "Dawn" },
      }),
    );

    assertEquals(resp.status, 401);
    assertEquals((await resp.json()).error, "Missing Authorization header");
    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest("v2-get-latest-snapshot - invalid JWT returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  fetchMock.onUrlContaining(
    "/auth/v1/user",
    () =>
      new Response(JSON.stringify({ error: "invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      }),
  );

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: "not-a-jwt",
      body: { game: "poe2", league: "Dawn" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Invalid JWT");
  fetchMock.restore();
  cleanupEnv();
});

quietTest(
  "v2-get-latest-snapshot - non-anonymous user returns 403",
  async () => {
    const fetchMock = setupAuthorizedMocks({ isAnonymous: false });

    const resp = await handler(
      createFunctionRequest({
        apikey: "test-publishable-key",
        bearerToken: createTestJwt(),
        body: { game: "poe2", league: "Dawn" },
      }),
    );

    assertEquals(resp.status, 403);
    assertEquals((await resp.json()).error, "Anonymous user required");
    fetchMock.restore();
  },
);

quietTest("v2-get-latest-snapshot - missing params return 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2" },
    }),
  );

  assertEquals(resp.status, 400);
  assertEquals(
    (await resp.json()).error,
    "Missing required parameters: game, league",
  );
  fetchMock.restore();
});

quietTest("v2-get-latest-snapshot - invalid game returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe3", league: "Dawn" },
    }),
  );

  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "Invalid game. Must be poe1 or poe2");
  fetchMock.restore();
});

quietTest("v2-get-latest-snapshot - oversized league returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2", league: "x".repeat(81) },
    }),
  );

  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "Invalid league");
  fetchMock.restore();
});

quietTest(
  "v2-get-latest-snapshot - returns flat snapshot with service-role database reads",
  async () => {
    const fetchMock = setupAuthorizedMocks({ userId: "anon-user-v2" });
    setupSnapshotQueries(fetchMock);

    const resp = await handler(
      createFunctionRequest({
        apikey: "test-publishable-key",
        bearerToken: createTestJwt({ sub: "anon-user-v2" }),
        appVersion: "0.18.0",
        body: { game: "poe2", league: "Dawn" },
      }),
    );

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.snapshot, {
      id: "snapshot-uuid-001",
      leagueId: "league-uuid-001",
      fetchedAt: "2024-12-15T12:00:00Z",
      exchangeChaosToDivine: 150,
      stackedDeckChaosCost: 1.5,
      stackedDeckMaxVolumeRate: 64.93,
    });
    assertEquals(body.cardPrices["The Doctor"], {
      chaosValue: 1200,
      divineValue: 8,
      confidence: 1,
    });

    const rateLimitCall = fetchMock.calls.find((call) =>
      call.url.includes(supabaseUrls.rpc("check_and_log_request")),
    );
    assert(rateLimitCall, "rate limit RPC should be called");
    const rateLimitBody = JSON.parse(String(rateLimitCall.init?.body));
    assertEquals(rateLimitBody.p_user_id, "anon-user-v2");
    assertEquals(rateLimitBody.p_endpoint, "v2-get-latest-snapshot");
    assertEquals(rateLimitBody.p_app_version, "0.18.0");

    const dbCalls = fetchMock.calls.filter((call) =>
      [
        "/rest/v1/poe_leagues",
        "/rest/v1/snapshots",
        "/rest/v1/card_prices",
      ].some((path) => call.url.includes(path)),
    );
    assertEquals(dbCalls.length, 3);
    for (const call of dbCalls) {
      assertEquals(getHeader(call.init, "apikey"), "test-service-role-key");
      assertEquals(
        getHeader(call.init, "authorization"),
        "Bearer test-service-role-key",
      );
    }

    fetchMock.restore();
  },
);

quietTest("v2-get-latest-snapshot - league not found returns 404", async () => {
  const fetchMock = setupAuthorizedMocks();

  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestError("No rows", "PGRST116", 406),
  );

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2", league: "Dawn" },
    }),
  );

  assertEquals(resp.status, 404);
  assertEquals((await resp.json()).error, "League not found");
  fetchMock.restore();
});

quietTest("v2-get-latest-snapshot - legacy anon key is accepted", async () => {
  const fetchMock = setupAuthorizedMocks();
  setupSnapshotQueries(fetchMock);

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2", league: "Dawn" },
    }),
  );

  assertEquals(resp.status, 200);
  fetchMock.restore();
});
