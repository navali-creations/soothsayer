import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createAuthorizedRequest,
  createMockRequest,
  createOptionsRequest,
  mockFetch,
  postgrestError,
  postgrestResponse,
  quietTest,
  responseBody,
  rpcResponse,
  setupEnv,
  stubDenoServe,
  supabaseUrls,
} from "./_test-helpers.ts";

const _cleanupEnv = setupEnv();
const serveStub = stubDenoServe();
await import("../upload-community-drop-events/index.ts");
const handler = serveStub.handler!;
serveStub.restore();
assert(handler !== null);

const FUNCTION_URL = "http://localhost/upload-community-drop-events";
const DEVICE_ID = "aaaaaaaa-bbbb-4ccc-9ddd-eeeeeeeeeeee";
const LEAGUE_ID = "11111111-2222-4333-8444-555555555555";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    league_name: "Allflame",
    game: "poe1",
    device_id: DEVICE_ID,
    events: [
      {
        event_id: "99999999-2222-4333-8444-555555555555",
        card_name: "The Scholar",
        location: "Atlas Hideout",
        local_minute: 626,
        utc_offset_minutes: 60,
      },
    ],
    ...overrides,
  };
}

function setupAuthorizedMocks() {
  const fetchMock = mockFetch();
  fetchMock.onUrlContaining(
    "/auth/v1/user",
    () =>
      new Response(
        JSON.stringify({
          user: { id: "test-user", role: "authenticated", is_anonymous: true },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );
  return fetchMock;
}

function setupHappyPath(
  fetchMock: ReturnType<typeof mockFetch>,
  ingestResponse: () => Response = () => rpcResponse(1),
) {
  fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
    postgrestResponse({ id: LEAGUE_ID }),
  );
  fetchMock.onUrlContaining(
    supabaseUrls.rpc("ingest_community_drop_events"),
    ingestResponse,
  );
}

quietTest("upload-community-drop-events — handles CORS preflight", async () => {
  const fetchMock = mockFetch();
  const response = await handler(createOptionsRequest(FUNCTION_URL));
  assertEquals(response.status, 200);
  fetchMock.restore();
});

quietTest("upload-community-drop-events — rejects invalid rows", async () => {
  const fetchMock = setupAuthorizedMocks();
  const response = await handler(
    createAuthorizedRequest(
      FUNCTION_URL,
      validBody({
        events: [
          {
            event_id: "not-a-uuid",
            card_name: "The Scholar",
            location: "Atlas Hideout",
            local_minute: 626,
            utc_offset_minutes: 60,
          },
        ],
      }),
    ),
  );
  assertEquals(response.status, 400);
  fetchMock.restore();
});

quietTest("upload-community-drop-events — rejects duplicate IDs", async () => {
  const fetchMock = setupAuthorizedMocks();
  const event = validBody().events[0];
  const response = await handler(
    createAuthorizedRequest(
      FUNCTION_URL,
      validBody({ events: [event, event] }),
    ),
  );
  assertEquals(response.status, 400);
  fetchMock.restore();
});

quietTest(
  "upload-community-drop-events — creates the device parent in the ingest transaction",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    setupHappyPath(fetchMock);

    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, validBody()),
    );
    assertEquals(response.status, 200);
    const rpcCall = fetchMock.calls.find((call) =>
      call.url.includes("ingest_community_drop_events"),
    );
    const body = JSON.parse(String(rpcCall?.init?.body));
    assertEquals(body.p_league_id, LEAGUE_ID);
    assertEquals(body.p_device_id, DEVICE_ID);
    assertEquals(body.p_events, validBody().events);
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — rejects oversized request bodies",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, {
        ...validBody(),
        padding: "x".repeat(256 * 1024),
      }),
    );
    assertEquals(response.status, 413);
    assertEquals(await responseBody(response), {
      error: "Request body is too large",
    });
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — handles league lookup errors",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    fetchMock.onUrlContaining(supabaseUrls.table("poe_leagues"), () =>
      postgrestError("lookup failed", "PGRST000", 500),
    );

    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, validBody()),
    );
    assertEquals(response.status, 500);
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — rejects excessive location cardinality",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const events = Array.from({ length: 101 }, (_, index) => ({
      event_id: `99999999-2222-4333-8444-${String(index).padStart(12, "0")}`,
      card_name: "The Scholar",
      location: `Forged Location ${index}`,
      local_minute: 626,
      utc_offset_minutes: 60,
    }));

    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, validBody({ events })),
    );

    assertEquals(response.status, 400);
    assertEquals(await responseBody(response), {
      error: "events may contain at most 100 distinct locations",
    });
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — handles ingestion errors",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    setupHappyPath(fetchMock, () =>
      postgrestError("ingestion failed", "22023", 400),
    );

    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, validBody()),
    );
    assertEquals(response.status, 500);
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — rejects an invalid RPC result",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    setupHappyPath(fetchMock, () => rpcResponse("one"));

    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, validBody()),
    );
    assertEquals(response.status, 500);
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — acknowledges the exact batch",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    setupHappyPath(fetchMock);

    const response = await handler(
      createAuthorizedRequest(FUNCTION_URL, validBody()),
    );
    assertEquals(response.status, 200);
    assertEquals(await responseBody(response), {
      success: true,
      accepted_events: 1,
      inserted_events: 1,
    });
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — accepts league UUID lookup",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    setupHappyPath(fetchMock);
    const response = await handler(
      createAuthorizedRequest(
        FUNCTION_URL,
        validBody({
          league_id: LEAGUE_ID,
          league_name: undefined,
          game: undefined,
        }),
      ),
    );
    assertEquals(response.status, 200);
    fetchMock.restore();
  },
);

quietTest(
  "upload-community-drop-events — rejects unsupported methods",
  async () => {
    const fetchMock = mockFetch();
    const response = await handler(
      createMockRequest(FUNCTION_URL, { method: "GET" }),
    );
    assertEquals(response.status, 405);
    fetchMock.restore();
  },
);
