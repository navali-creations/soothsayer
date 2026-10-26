import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  mockFetch,
  postgrestError,
  quietTest,
  responseBody,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

const _cleanupEnv = setupEnv({
  WRAECLAST_CARDS_API_KEY: "test-wraeclast-key",
  WRAECLAST_CARDS_CALLER_TOKEN: "test-caller-token",
});
const serveStub = stubDenoServe();
await import("../get-community-drop-context/index.ts");
const handler = serveStub.handler!;
serveStub.restore();
assert(handler !== null);

const FUNCTION_URL =
  "http://localhost/get-community-drop-context?game=poe1&league=Allflame&card=The%20Scholar";
const LEAGUE_FUNCTION_URL =
  "http://localhost/get-community-drop-context?game=poe1&league=Allflame";

function request(
  url = FUNCTION_URL,
  headers: Record<string, string> = {},
): Request {
  return new Request(url, {
    method: "GET",
    headers: { "x-api-key": "test-wraeclast-key", ...headers },
  });
}

function setupRpcMocks(contextResult: unknown, contextStatus = 200) {
  const fetchMock = mockFetch();
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );
  fetchMock.onUrlContaining(
    supabaseUrls.rpc("get_community_drop_context"),
    () => rpcResponse(contextResult, contextStatus),
  );
  fetchMock.onUrlContaining(
    supabaseUrls.rpc("get_community_league_drop_context"),
    () => rpcResponse(contextResult, contextStatus),
  );
  return fetchMock;
}

quietTest("get-community-drop-context — handles CORS", async () => {
  const fetchMock = mockFetch();
  const response = await handler(
    new Request("http://localhost/get-community-drop-context", {
      method: "OPTIONS",
    }),
  );
  assertEquals(response.status, 200);
  fetchMock.restore();
});

quietTest("get-community-drop-context — requires an API key", async () => {
  const fetchMock = mockFetch();
  const response = await handler(new Request(FUNCTION_URL, { method: "GET" }));
  assertEquals(response.status, 401);
  fetchMock.restore();
});

quietTest(
  "get-community-drop-context — rejects an invalid API key",
  async () => {
    const fetchMock = mockFetch();
    const response = await handler(
      request(FUNCTION_URL, { "x-api-key": "wrong" }),
    );
    assertEquals(response.status, 401);
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — validates query parameters",
  async () => {
    const fetchMock = setupRpcMocks({});
    const response = await handler(
      request("http://localhost/get-community-drop-context?game=invalid"),
    );
    assertEquals(response.status, 400);
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — rejects an oversized optional card parameter",
  async () => {
    const fetchMock = setupRpcMocks({});
    const response = await handler(
      request(`${LEAGUE_FUNCTION_URL}&card=${"x".repeat(201)}`),
    );
    assertEquals(response.status, 400);
    assertEquals(await responseBody(response), {
      error: "Invalid 'card' parameter",
    });
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — maps unknown resources to 404",
  async () => {
    const fetchMock = setupRpcMocks({ found: false, reason: "card_not_found" });
    const response = await handler(request());
    assertEquals(response.status, 404);
    assertEquals(await responseBody(response), { error: "Card not found" });
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — returns private aggregate output",
  async () => {
    const result = {
      found: true,
      available: true,
      game: "poe1",
      league: "Allflame",
      card: "The Scholar",
      bucket_minutes: 15,
      min_contributors: 5,
      contributors: 5,
      observed_events: 10,
      local_time_buckets: [{ minute: 0, count: 0 }],
      utc_time_buckets: [{ minute: 0, count: 0 }],
      utc_offsets: [{ utc_offset_minutes: 60, count: 10 }],
      locations: [{ name: "Atlas Hideout", count: 10 }],
    };
    const fetchMock = setupRpcMocks(result);
    const response = await handler(
      request(FUNCTION_URL, { "x-caller-token": "test-caller-token" }),
    );
    assertEquals(response.status, 200);
    assertEquals(response.headers.get("cache-control"), "public, max-age=300");
    assertEquals(await responseBody(response), result);
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — returns a whole league for the static dataset build",
  async () => {
    const result = {
      found: true,
      available: true,
      game: "poe1",
      league: "Allflame",
      bucket_minutes: 15,
      min_contributors: 5,
      cards: [
        {
          name: "The Scholar",
          contributors: 5,
          observed_events: 10,
          local_time_buckets: [
            {
              minute: 0,
              count: 10,
              locations: [{ name: "Atlas Hideout", count: 10 }],
            },
          ],
          utc_time_buckets: [{ minute: 0, count: 10 }],
          utc_offsets: [{ utc_offset_minutes: 60, count: 10 }],
          locations: [{ name: "Atlas Hideout", count: 10 }],
        },
      ],
    };
    const fetchMock = setupRpcMocks(result);
    const response = await handler(
      request(LEAGUE_FUNCTION_URL, {
        "x-caller-token": "test-caller-token",
      }),
    );

    assertEquals(response.status, 200);
    assertEquals(await responseBody(response), result);
    const aggregateCall = fetchMock.calls.find((call) =>
      call.url.includes("get_community_league_drop_context"),
    );
    assert(aggregateCall);
    assertEquals(JSON.parse(String(aggregateCall.init?.body)), {
      p_game: "poe1",
      p_league: "Allflame",
      p_min_contributors: 5,
    });
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — gives the trusted publisher a full-catalog budget",
  async () => {
    const fetchMock = setupRpcMocks({ found: false, reason: "card_not_found" });
    await handler(
      request(FUNCTION_URL, { "x-caller-token": "test-caller-token" }),
    );

    const rateCall = fetchMock.calls.find((call) =>
      call.url.includes("check_and_log_request"),
    );
    const body = JSON.parse(String(rateCall?.init?.body));
    assertEquals(body.p_max_hits, 5_000);
    assertEquals(body.p_app_version, "gha:wraeclast-cards");
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — fails closed on RPC errors",
  async () => {
    const fetchMock = mockFetch();
    fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
      rpcResponse({ allowed: true }),
    );
    fetchMock.onUrlContaining(
      supabaseUrls.rpc("get_community_drop_context"),
      () => postgrestError("failed", "PGRST000", 500),
    );
    const response = await handler(request());
    assertEquals(response.status, 500);
    fetchMock.restore();
  },
);

quietTest(
  "get-community-drop-context — rejects unsupported methods",
  async () => {
    const fetchMock = mockFetch();
    const response = await handler(
      new Request(FUNCTION_URL, {
        method: "POST",
        headers: { "x-api-key": "test-wraeclast-key" },
      }),
    );
    assertEquals(response.status, 405);
    fetchMock.restore();
  },
);
