/**
 * Unit tests for supabase/functions/v2-get-leagues/index.ts
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createMockRequest,
  createOptionsRequest,
  createTestJwt,
  mockFetch,
  mockLeague,
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

await import("../v2-get-leagues/index.ts");

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
    "http://localhost:54321/functions/v1/v2-get-leagues",
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

function getHeader(init: RequestInit | undefined, name: string): string | null {
  return new Headers(init?.headers).get(name);
}

quietTest("v2-get-leagues - OPTIONS returns 200", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createOptionsRequest("http://localhost:54321/functions/v1/v2-get-leagues"),
  );

  assertEquals(resp.status, 200);
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-leagues - GET returns 405", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createFunctionRequest({
      method: "GET",
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
    }),
  );

  assertEquals(resp.status, 405);
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-leagues - missing apikey returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createFunctionRequest({
      bearerToken: createTestJwt(),
      body: { game: "poe2" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Missing apikey header");
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-leagues - invalid apikey returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createFunctionRequest({
      apikey: "wrong-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Invalid apikey header");
  fetchMock.restore();
  cleanupEnv();
});

quietTest(
  "v2-get-leagues - accepted rotated apikey is used for JWT validation",
  async () => {
    const cleanupEnv = setupEnv({
      SOOTHSAYER_PUBLISHABLE_KEYS: "stale-publishable-key, rotated-key",
      SOOTHSAYER_PUBLISHABLE_KEY: "",
      SUPABASE_ANON_KEY: "legacy-anon-key",
    });
    const fetchMock = mockFetch();

    fetchMock.onUrlContaining("/auth/v1/user", (_input, init) => {
      assertEquals(getHeader(init, "apikey"), "rotated-key");
      return new Response(
        JSON.stringify({
          user: {
            id: "anon-user-rotated",
            aud: "authenticated",
            role: "authenticated",
            is_anonymous: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    });

    fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
      rpcResponse({ allowed: true }),
    );
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([]),
    );

    const resp = await handler(
      createFunctionRequest({
        apikey: "rotated-key",
        bearerToken: createTestJwt({ sub: "anon-user-rotated" }),
        body: { game: "poe1" },
      }),
    );

    assertEquals(resp.status, 200);
    assertEquals((await resp.json()).leagues, []);

    fetchMock.restore();
    cleanupEnv();
  },
);

quietTest("v2-get-leagues - missing Authorization returns 401", async () => {
  const cleanupEnv = setupEnv();
  const fetchMock = mockFetch();

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      body: { game: "poe2" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Missing Authorization header");
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-leagues - invalid JWT returns 401", async () => {
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
      body: { game: "poe2" },
    }),
  );

  assertEquals(resp.status, 401);
  assertEquals((await resp.json()).error, "Invalid JWT");
  fetchMock.restore();
  cleanupEnv();
});

quietTest("v2-get-leagues - non-anonymous user returns 403", async () => {
  const fetchMock = setupAuthorizedMocks({ isAnonymous: false });

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe2" },
    }),
  );

  assertEquals(resp.status, 403);
  assertEquals((await resp.json()).error, "Anonymous user required");
  fetchMock.restore();
});

quietTest("v2-get-leagues - missing game returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: {},
    }),
  );

  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "Missing required parameter: game");
  fetchMock.restore();
});

quietTest("v2-get-leagues - invalid game returns 400", async () => {
  const fetchMock = setupAuthorizedMocks();

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe3" },
    }),
  );

  assertEquals(resp.status, 400);
  assertEquals((await resp.json()).error, "Invalid game. Must be poe1 or poe2");
  fetchMock.restore();
});

quietTest(
  "v2-get-leagues - returns DTOs with service-role database reads",
  async () => {
    const fetchMock = setupAuthorizedMocks({ userId: "anon-user-v2" });

    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestResponse([
        mockLeague({
          id: "league-uuid-001",
          game: "poe2",
          league_id: "Dawn",
          name: "Dawn",
          start_at: "2024-12-01T00:00:00Z",
          end_at: null,
          is_active: true,
          updated_at: "2024-12-15T00:00:00Z",
        }),
      ]),
    );

    const resp = await handler(
      createFunctionRequest({
        apikey: "test-publishable-key",
        bearerToken: createTestJwt({ sub: "anon-user-v2" }),
        appVersion: "0.18.0",
        body: { game: "poe2" },
      }),
    );

    assertEquals(resp.status, 200);
    const body = await resp.json();
    assertEquals(body.leagues, [
      {
        id: "league-uuid-001",
        game: "poe2",
        leagueId: "Dawn",
        name: "Dawn",
        startAt: "2024-12-01T00:00:00Z",
        endAt: null,
        isActive: true,
        updatedAt: "2024-12-15T00:00:00Z",
      },
    ]);

    const rateLimitCall = fetchMock.calls.find((call) =>
      call.url.includes(supabaseUrls.rpc("check_and_log_request")),
    );
    assert(rateLimitCall, "rate limit RPC should be called");
    const rateLimitBody = JSON.parse(String(rateLimitCall.init?.body));
    assertEquals(rateLimitBody.p_user_id, "anon-user-v2");
    assertEquals(rateLimitBody.p_endpoint, "v2-get-leagues");
    assertEquals(rateLimitBody.p_app_version, "0.18.0");

    const dbCall = fetchMock.calls.find((call) =>
      call.url.includes(supabaseUrls.table("poe_leagues")),
    );
    assert(dbCall, "poe_leagues should be queried");
    assertEquals(getHeader(dbCall.init, "apikey"), "test-service-role-key");
    assertEquals(
      getHeader(dbCall.init, "authorization"),
      "Bearer test-service-role-key",
    );

    fetchMock.restore();
  },
);

quietTest("v2-get-leagues - legacy anon key is accepted", async () => {
  const fetchMock = setupAuthorizedMocks();

  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestResponse([]),
  );

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-anon-key",
      bearerToken: createTestJwt(),
      body: { game: "poe1" },
    }),
  );

  assertEquals(resp.status, 200);
  assertEquals((await resp.json()).leagues, []);
  fetchMock.restore();
});

quietTest("v2-get-leagues - database errors are sanitized", async () => {
  const fetchMock = setupAuthorizedMocks();

  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestError("relation does not exist", "42P01", 500),
  );

  const resp = await handler(
    createFunctionRequest({
      apikey: "test-publishable-key",
      bearerToken: createTestJwt(),
      body: { game: "poe1" },
    }),
  );

  assertEquals(resp.status, 500);
  assertEquals((await resp.json()).error, "Failed to fetch leagues");
  fetchMock.restore();
});
