/**
 * Unit tests for supabase/functions/v2-upload-community-data/index.ts
 *
 * Tests the full handler including:
 *   - CORS preflight
 *   - Authorization & rate limiting
 *   - Input validation (validateBody)
 *   - Link-GGG action flow
 *   - Upload happy path (league lookup, card resolution, upsert)
 *   - Fraud detection (Benford's Law, round numbers)
 *
 * Run with:
 *   deno test --allow-all supabase/functions/tests/v2-upload-community-data_test.ts
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createAuthorizedRequest,
  createMockRequest,
  createOptionsRequest,
  createTestJwt,
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

// ─── Setup: capture the handler from Deno.serve ──────────────────────────────

const _cleanupEnv = setupEnv();
const serveStub = stubDenoServe();

await import("../v2-upload-community-data/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Constants ───────────────────────────────────────────────────────────────

const FUNCTION_URL = "http://localhost/v2-upload-community-data";
const VALID_DEVICE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const VALID_LEAGUE_ID = "11111111-2222-3333-4444-555555555555";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function validUploadBody(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    league_name: "Dawn",
    game: "poe2",
    device_id: VALID_DEVICE_ID,
    cards: [
      { card_name: "The Doctor", count: 3 },
      { card_name: "Rain of Chaos", count: 12 },
    ],
    ...overrides,
  };
}

/**
 * Sets up fetch mocks for a fully authorized request that passes auth + rate limit.
 * Returns the mock so additional routes can be registered.
 */
function setupAuthorizedMocks() {
  const fetchMock = mockFetch();

  // Auth validation — getUser calls /auth/v1/user
  fetchMock.onUrlContaining(
    "/auth/v1/user",
    () =>
      new Response(
        JSON.stringify({
          user: {
            id: "test-user-id-001",
            aud: "authenticated",
            role: "authenticated",
            is_anonymous: true,
          },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

  // Rate limit RPC → allowed
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );

  return fetchMock;
}

function accountActionRequest(
  body: Record<string, unknown>,
  token = "valid-ggg-token",
): Request {
  return createMockRequest(FUNCTION_URL, {
    method: "POST",
    body,
    bearerToken: createTestJwt({ sub: "test-user-id-001" }),
    apikey: "test-anon-key",
    headers: { "x-ggg-token": token },
  });
}

/**
 * Registers all the mocks needed for a successful upload flow beyond auth.
 * This includes league lookup, card upsert, card fetch, and the atomic upload
 * merge RPC. community_uploads is still mocked for non-fatal suspicion updates.
 */
function setupFullUploadMocks(
  fetchMock: ReturnType<typeof mockFetch>,
  mergeResponseOverride?: unknown,
) {
  // League lookup by name + game
  fetchMock.onUrlContaining("poe_leagues", () =>
    postgrestResponse({ id: VALID_LEAGUE_ID, game: "poe2" }),
  );

  fetchMock.onUrlContaining("community_uploads", (_url, init) => {
    if (init?.method === "PATCH") {
      return postgrestResponse({ id: "upload-id-001" });
    }
    return postgrestResponse(null);
  });

  setupUploadMergeMock(fetchMock, mergeResponseOverride);
}

function setupUploadMergeMock(
  fetchMock: ReturnType<typeof mockFetch>,
  responseOverride?: unknown,
) {
  fetchMock.onUrlContaining(
    supabaseUrls.rpc("merge_community_upload_data"),
    (_url, init) => {
      const body =
        typeof init?.body === "string"
          ? (JSON.parse(init.body) as {
              p_is_verified?: boolean;
              p_cards?: { count?: number }[];
            })
          : {};
      const total = (body.p_cards ?? []).reduce(
        (sum, card) => sum + (card.count ?? 0),
        0,
      );
      const responseBody = responseOverride ?? {
        upload_id: "upload-id-001",
        total_cards: total,
        upload_count: 1,
        is_verified: body.p_is_verified === true,
      };

      return rpcResponse(responseBody);
    },
  );
}

quietTest(
  "v2-upload-community-data — tokenless writes require proof for an existing verified identity",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    try {
      fetchMock.onUrlContaining("poe_leagues", () =>
        postgrestResponse({ id: VALID_LEAGUE_ID }),
      );
      fetchMock.onUrlContaining(
        supabaseUrls.rpc("merge_community_upload_data"),
        () => postgrestError("community_identity_proof_required", "42501", 403),
      );
      const response = await handler(
        createAuthorizedRequest(
          FUNCTION_URL,
          validUploadBody(),
          createTestJwt({ sub: "test-user-id-001" }),
        ),
      );
      assertEquals(response.status, 409);
      assertEquals(
        (await responseBody<{ code: string }>(response)).code,
        "COMMUNITY_IDENTITY_PROOF_REQUIRED",
      );
    } finally {
      fetchMock.restore();
    }
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════════════════════

// Test 27: OPTIONS returns CORS headers
quietTest(
  "v2-upload-community-data — OPTIONS returns 200 (CORS preflight)",
  async () => {
    const fetchMock = mockFetch();

    const req = createOptionsRequest(FUNCTION_URL);
    const resp = await handler(req);

    assertEquals(resp.status, 200);

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Auth / Rate Limiting
// ═══════════════════════════════════════════════════════════════════════════════

quietTest(
  "v2-upload-community-data — returns 401 when apikey header is missing",
  async () => {
    const fetchMock = mockFetch();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: validUploadBody(),
      bearerToken: testToken,
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "Missing apikey header");

    fetchMock.restore();
  },
);

quietTest(
  "v2-upload-community-data — returns 401 when apikey is not allowlisted",
  async () => {
    const fetchMock = mockFetch();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: validUploadBody(),
      bearerToken: testToken,
      apikey: "wrong-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "Invalid apikey header");

    fetchMock.restore();
  },
);

// Test 25: Returns 401 when no authorization header
quietTest(
  "v2-upload-community-data — returns 401 when no authorization header",
  async () => {
    const fetchMock = mockFetch();

    // Request with apikey but no Bearer token
    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: validUploadBody(),
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 401);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "Missing Authorization header");

    fetchMock.restore();
  },
);

quietTest(
  "v2-upload-community-data — returns 403 for non-anonymous Supabase users",
  async () => {
    const fetchMock = mockFetch();

    fetchMock.onUrlContaining(
      "/auth/v1/user",
      () =>
        new Response(
          JSON.stringify({
            user: {
              id: "test-user-id-001",
              aud: "authenticated",
              role: "authenticated",
              is_anonymous: false,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const testToken = createTestJwt({ sub: "test-user-id-001" });
    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: validUploadBody(),
      bearerToken: testToken,
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 403);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "Anonymous user required");

    fetchMock.restore();
  },
);

// Test 26: Returns 429 when rate limited
quietTest(
  "v2-upload-community-data — returns 429 when rate limited",
  async () => {
    const fetchMock = mockFetch();

    // Auth succeeds
    fetchMock.onUrlContaining(
      "/auth/v1/user",
      () =>
        new Response(
          JSON.stringify({
            user: {
              id: "test-user-id-001",
              aud: "authenticated",
              role: "authenticated",
              is_anonymous: true,
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    // Rate limit RPC → NOT allowed
    fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
      rpcResponse({ allowed: false, reason: "rate_limited" }),
    );

    const testToken = createTestJwt({ sub: "test-user-id-001" });
    const req = createAuthorizedRequest(
      FUNCTION_URL,
      validUploadBody(),
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 429);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.toLowerCase().includes("rate limit"));

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Input Validation (validateBody)
// ═══════════════════════════════════════════════════════════════════════════════

// Test 1: Returns 400 for non-object body
quietTest(
  "v2-upload-community-data — returns 400 for non-object body",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      "not-an-object",
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "Invalid request body");

    fetchMock.restore();
  },
);

// Test 2: Returns 400 when neither league_id nor league_name provided
quietTest(
  "v2-upload-community-data — returns 400 when neither league_id nor league_name",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "The Doctor", count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("league_id"));
    assert(body.error.includes("league_name"));

    fetchMock.restore();
  },
);

// Test 3: Returns 400 for invalid league_id UUID format
quietTest(
  "v2-upload-community-data — returns 400 for invalid league_id UUID format",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_id: "not-a-uuid",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "The Doctor", count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("league_id"));
    assert(body.error.includes("UUID"));

    fetchMock.restore();
  },
);

// Test 4: Returns 400 when league_name without game
quietTest(
  "v2-upload-community-data — returns 400 when league_name provided without game",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "The Doctor", count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("game"));

    fetchMock.restore();
  },
);

// Test 5: Returns 400 when league_name too long (>200 chars)
quietTest(
  "v2-upload-community-data — returns 400 when league_name exceeds 200 chars",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "X".repeat(201),
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "The Doctor", count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("league_name"));
    assert(body.error.includes("200"));

    fetchMock.restore();
  },
);

// Test 6: Returns 400 for invalid device_id
quietTest(
  "v2-upload-community-data — returns 400 for invalid device_id",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: "not-a-uuid",
        cards: [{ card_name: "The Doctor", count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("device_id"));

    fetchMock.restore();
  },
);

// Test 7: Returns 400 when cards is empty array
quietTest(
  "v2-upload-community-data — returns 400 when cards is empty array",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: [],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("cards"));
    assert(body.error.includes("non-empty"));

    fetchMock.restore();
  },
);

// Test 8: Returns 400 when cards exceeds 1000 entries
quietTest(
  "v2-upload-community-data — returns 400 when cards exceeds 1000 entries",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const bigCards = Array.from({ length: 1001 }, (_, i) => ({
      card_name: `Card ${i}`,
      count: 1,
    }));

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: bigCards,
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("1000"));

    fetchMock.restore();
  },
);

// Test 9: Returns 400 for invalid card entry (not object)
quietTest(
  "v2-upload-community-data — returns 400 for invalid card entry (not object)",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: ["not-an-object"],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("cards[0]"));
    assert(body.error.includes("invalid"));

    fetchMock.restore();
  },
);

// Test 10: Returns 400 for empty card_name
quietTest(
  "v2-upload-community-data — returns 400 for empty card_name",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "", count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("card_name"));
    assert(body.error.includes("non-empty"));

    fetchMock.restore();
  },
);

// Test 11: Returns 400 for card_name too long
quietTest(
  "v2-upload-community-data — returns 400 for card_name exceeding 200 chars",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "A".repeat(201), count: 1 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("card_name"));
    assert(body.error.includes("200"));

    fetchMock.restore();
  },
);

// Test 12: Returns 400 for non-integer count
quietTest(
  "v2-upload-community-data — returns 400 for non-integer count",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "The Doctor", count: 1.5 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("count"));
    assert(body.error.includes("positive integer"));

    fetchMock.restore();
  },
);

// Test 13: Returns 400 for count <= 0
quietTest("v2-upload-community-data — returns 400 for count <= 0", async () => {
  const fetchMock = setupAuthorizedMocks();
  const testToken = createTestJwt({ sub: "test-user-id-001" });

  const req = createAuthorizedRequest(
    FUNCTION_URL,
    {
      league_name: "Dawn",
      game: "poe2",
      device_id: VALID_DEVICE_ID,
      cards: [{ card_name: "The Doctor", count: 0 }],
    },
    testToken,
  );
  const resp = await handler(req);

  assertEquals(resp.status, 400);
  const body = await responseBody<{ error: string }>(resp);
  assert(body.error.includes("count"));
  assert(body.error.includes("positive integer"));

  fetchMock.restore();
});

// Test 14: Returns 400 for count > 10M
quietTest(
  "v2-upload-community-data — returns 400 for count > 10,000,000",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: [{ card_name: "The Doctor", count: 10_000_001 }],
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("count"));
    assert(body.error.includes("10,000,000"));

    fetchMock.restore();
  },
);

quietTest(
  "v2-upload-community-data — returns 400 when card total exceeds integer range",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards: Array.from({ length: 215 }, (_, i) => ({
          card_name: `Card ${i}`,
          count: 10_000_000,
        })),
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("cards total"));

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Fraud Detection (statistical helpers)
// ═══════════════════════════════════════════════════════════════════════════════

// Tests 15-17 exercise the fraud detection logic indirectly through the full
// upload flow. The functions checkBenfordsLaw and checkRoundNumbers are private,
// so we test them by verifying the handler's behavior with crafted card data.

// Test 15: checkBenfordsLaw returns true for small sample (<50 counts)
// With <50 cards and total < 500, fraud detection is skipped entirely.
// We verify the upload succeeds without suspicion flags.
quietTest(
  "v2-upload-community-data — small sample (<50 cards) passes Benford's check (no suspicion)",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // 5 cards, total well under 500 → fraud detection skipped
    const cards = Array.from({ length: 5 }, (_, i) => ({
      card_name: `Card${i}`,
      count: 10,
    }));

    setupFullUploadMocks(fetchMock);

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards,
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{ success: boolean }>(resp);
    assertEquals(body.success, true);

    fetchMock.restore();
  },
);

// Test 16: checkRoundNumbers returns true for small sample (<10 counts)
// Similar to above — small sample passes without suspicion.
quietTest(
  "v2-upload-community-data — small sample (<10 cards) passes round numbers check",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // 3 cards, all round numbers but too few to trigger
    const cards = [
      { card_name: "Card0", count: 10 },
      { card_name: "Card1", count: 20 },
      { card_name: "Card2", count: 30 },
    ];

    setupFullUploadMocks(fetchMock);

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards,
      },
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{ success: boolean }>(resp);
    assertEquals(body.success, true);

    fetchMock.restore();
  },
);

// Test 17: checkRoundNumbers flags when >50% are round numbers
// We need effectiveTotal >= 500 to trigger fraud detection, so we craft
// enough cards with round-number counts to exceed the threshold.
quietTest(
  "v2-upload-community-data — flags suspicious when >50% counts are round numbers",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // 20 cards: 15 with round counts (multiples of 10), 5 with non-round.
    // Total needs to be >= 500 to trigger fraud checks.
    // 15 * 50 + 5 * 3 = 750 + 15 = 765, which is >= 500
    const cards: { card_name: string; count: number }[] = [];
    for (let i = 0; i < 15; i++) {
      cards.push({ card_name: `RoundCard${i}`, count: 50 });
    }
    for (let i = 0; i < 5; i++) {
      cards.push({ card_name: `OddCard${i}`, count: 3 });
    }

    // Setup auth + league lookup
    fetchMock.onUrlContaining("poe_leagues", () =>
      postgrestResponse({ id: VALID_LEAGUE_ID, game: "poe2" }),
    );

    fetchMock.onUrlContaining("community_uploads", (_url, init) => {
      if (init?.method === "PATCH") {
        return postgrestResponse({ id: "upload-id-suspicious" });
      }
      return postgrestResponse(null);
    });

    setupUploadMergeMock(fetchMock, {
      upload_id: "upload-id-suspicious",
      total_cards: 765,
      upload_count: 1,
      is_verified: false,
    });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      {
        league_name: "Dawn",
        game: "poe2",
        device_id: VALID_DEVICE_ID,
        cards,
      },
      testToken,
    );
    const resp = await handler(req);

    // The upload still succeeds even when flagged as suspicious
    assertEquals(resp.status, 200);
    const body = await responseBody<{ success: boolean }>(resp);
    assertEquals(body.success, true);

    // Verify that a PATCH to community_uploads was made (for suspicion flags)
    const patchCalls = fetchMock.calls.filter(
      (c) => c.url.includes("community_uploads") && c.init?.method === "PATCH",
    );
    // At least one PATCH should contain suspicion data
    assert(
      patchCalls.length > 0,
      "Expected PATCH call to update suspicion flags",
    );

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Link-GGG Action
// ═══════════════════════════════════════════════════════════════════════════════

// Test 18: Returns 400 for missing device_id in link-ggg
quietTest(
  "v2-upload-community-data — link-ggg returns 400 for missing device_id",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: {
        action: "link-ggg",
        // no device_id
      },
      bearerToken: testToken,
      apikey: "test-anon-key",
      headers: { "x-ggg-token": "some-token" },
    });
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("device_id"));

    fetchMock.restore();
  },
);

// Test 19: Returns 400 for missing ggg_access_token in link-ggg
quietTest(
  "v2-upload-community-data — link-ggg returns 400 for missing X-GGG-Token header",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: {
        action: "link-ggg",
        device_id: VALID_DEVICE_ID,
        // no x-ggg-token header
      },
      bearerToken: testToken,
      apikey: "test-anon-key",
    });
    const resp = await handler(req);

    assertEquals(resp.status, 400);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("X-GGG-Token"));

    fetchMock.restore();
  },
);

// Test 20: Successful GGG profile verification and link
quietTest(
  "v2-upload-community-data — link-ggg succeeds with valid GGG profile",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Mock GGG API
    fetchMock.onUrlContaining(
      "api.pathofexile.com/profile",
      () =>
        new Response(
          JSON.stringify({
            uuid: "ggg-uuid-123",
            name: "TestExile",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    fetchMock.onUrlContaining(
      supabaseUrls.rpc("resolve_community_upload_identity"),
      () =>
        rpcResponse({ device_id: VALID_DEVICE_ID, legacy_anonymous: false }),
    );

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: {
        action: "link-ggg",
        device_id: VALID_DEVICE_ID,
      },
      bearerToken: testToken,
      apikey: "test-anon-key",
      headers: { "x-ggg-token": "valid-ggg-token" },
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{
      success: boolean;
      ggg_username: string;
      ggg_uuid: string;
      device_id: string;
    }>(resp);
    assertEquals(body.success, true);
    assertEquals(body.ggg_uuid, "ggg-uuid-123");
    assertEquals(body.ggg_username, "TestExile");
    assertEquals(body.device_id, VALID_DEVICE_ID);

    fetchMock.restore();
  },
);

// The database resolves ownership. These cases exercise the returned RPC outcomes.
for (const scenario of [
  {
    name: "returns a fresh identity when the RPC preserves unverified history",
    restored: false,
    anonymous: true,
  },
  {
    name: "returns the verified identity selected by the RPC",
    restored: true,
    anonymous: false,
  },
  {
    name: "returns a fresh identity when the RPC cannot reuse legacy ownership",
    restored: false,
    anonymous: false,
  },
]) {
  quietTest(`v2-upload-community-data — ${scenario.name}`, async () => {
    const fetchMock = setupAuthorizedMocks();
    const candidate = "bbbbbbbb-bbbb-4ccc-9ddd-eeeeeeeeeeee";
    try {
      fetchMock.onUrlContaining("api.pathofexile.com/profile", () =>
        postgrestResponse({ uuid: "ggg-uuid-123", name: "TestExile" }),
      );
      fetchMock.onUrlContaining(
        supabaseUrls.rpc("resolve_community_upload_identity"),
        (_input, init) => {
          const body = JSON.parse(String(init?.body));
          assertEquals(body.p_device_id, candidate);
          assertEquals(body.p_legacy_device_id, VALID_DEVICE_ID);
          assertEquals(body.p_ggg_uuid, "ggg-uuid-123");
          return rpcResponse({
            device_id: scenario.restored ? VALID_DEVICE_ID : candidate,
            legacy_anonymous: scenario.anonymous,
          });
        },
      );
      const response = await handler(
        accountActionRequest({
          action: "link-ggg",
          device_id: candidate,
          legacy_device_id: VALID_DEVICE_ID,
        }),
      );
      assertEquals(response.status, 200);
      const body = await responseBody<{
        device_id: string;
        legacy_anonymous: boolean;
      }>(response);
      assertEquals(
        body.device_id,
        scenario.restored ? VALID_DEVICE_ID : candidate,
      );
      assertEquals(body.legacy_anonymous, scenario.anonymous);
    } finally {
      fetchMock.restore();
    }
  });
}

quietTest(
  "v2-upload-community-data — rejects a candidate with existing unrelated history",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    try {
      fetchMock.onUrlContaining("api.pathofexile.com/profile", () =>
        postgrestResponse({ uuid: "ggg-uuid-123", name: "TestExile" }),
      );
      fetchMock.onUrlContaining(
        supabaseUrls.rpc("resolve_community_upload_identity"),
        () => postgrestError("community_identity_conflict", "42501", 403),
      );
      assertEquals(
        (
          await handler(
            accountActionRequest({
              action: "link-ggg",
              device_id: VALID_DEVICE_ID,
            }),
          )
        ).status,
        409,
      );
    } finally {
      fetchMock.restore();
    }
  },
);

quietTest(
  "v2-upload-community-data — rejects historical unlinking without accessing GGG or changing records",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    try {
      fetchMock.onUrlContaining("api.pathofexile.com/profile", () => {
        throw new Error("Unexpected GGG request");
      });
      fetchMock.onUrlContaining("community_uploads", () => {
        throw new Error("Unexpected history request");
      });
      assertEquals(
        (
          await handler(
            accountActionRequest({
              action: "unlink-ggg",
              device_id: VALID_DEVICE_ID,
            }),
          )
        ).status,
        400,
      );
    } finally {
      fetchMock.restore();
    }
  },
);

for (const profile of [
  { status: 401, body: {} },
  { status: 200, body: { name: "missing-account-id" } },
]) {
  quietTest(
    "v2-upload-community-data — failed verification never falls back to an anonymous write",
    async () => {
      const fetchMock = setupAuthorizedMocks();
      try {
        fetchMock.onUrlContaining("poe_leagues", () =>
          postgrestResponse({ id: VALID_LEAGUE_ID }),
        );
        fetchMock.onUrlContaining("api.pathofexile.com/profile", () =>
          postgrestResponse(profile.body, profile.status),
        );
        const response = await handler(accountActionRequest(validUploadBody()));
        assertEquals(response.status, 502);
        assertEquals(
          fetchMock.calls.filter((call) =>
            call.url.includes("merge_community_upload_data"),
          ).length,
          0,
        );
      } finally {
        fetchMock.restore();
      }
    },
  );
}

quietTest(
  "v2-upload-community-data — verified upload cannot relabel anonymous or other-account history",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    try {
      fetchMock.onUrlContaining("poe_leagues", () =>
        postgrestResponse({ id: VALID_LEAGUE_ID }),
      );
      fetchMock.onUrlContaining("api.pathofexile.com/profile", () =>
        postgrestResponse({ uuid: "ggg-uuid-123", name: "TestExile" }),
      );
      fetchMock.onUrlContaining(
        supabaseUrls.rpc("merge_community_upload_data"),
        () => postgrestError("community_identity_conflict", "42501", 403),
      );
      const response = await handler(accountActionRequest(validUploadBody()));
      assertEquals(response.status, 409);
      assertEquals(
        fetchMock.calls.filter((call) =>
          call.url.includes("merge_community_upload_data"),
        ).length,
        1,
      );
    } finally {
      fetchMock.restore();
    }
  },
);

// Test 21: Returns 502 when GGG API returns error
quietTest(
  "v2-upload-community-data — link-ggg returns 502 when GGG API returns error",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Mock GGG API returning 401
    fetchMock.onUrlContaining(
      "api.pathofexile.com/profile",
      () =>
        new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { "Content-Type": "application/json" },
        }),
    );

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: {
        action: "link-ggg",
        device_id: VALID_DEVICE_ID,
      },
      bearerToken: testToken,
      apikey: "test-anon-key",
      headers: { "x-ggg-token": "bad-ggg-token" },
    });
    const resp = await handler(req);

    assertEquals(resp.status, 502);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("GGG profile verification failed"));

    fetchMock.restore();
  },
);

// Test 22: Returns 502 when GGG profile is missing uuid/name
quietTest(
  "v2-upload-community-data — link-ggg returns 502 when GGG profile missing uuid/name",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // Mock GGG API returning 200 but with incomplete profile
    fetchMock.onUrlContaining(
      "api.pathofexile.com/profile",
      () =>
        new Response(
          JSON.stringify({ realm: "pc" }), // missing uuid and name
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
    );

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: {
        action: "link-ggg",
        device_id: VALID_DEVICE_ID,
      },
      bearerToken: testToken,
      apikey: "test-anon-key",
      headers: { "x-ggg-token": "valid-ggg-token" },
    });
    const resp = await handler(req);

    assertEquals(resp.status, 502);
    const body = await responseBody<{ error: string }>(resp);
    assert(body.error.includes("verification failed"));

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Upload Flow
// ═══════════════════════════════════════════════════════════════════════════════

// Test 23: Successful upload with league_name + game lookup
quietTest(
  "v2-upload-community-data — successful upload with league_name + game",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    setupFullUploadMocks(fetchMock);

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      validUploadBody(),
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{
      success: boolean;
      upload_id: string;
      total_cards: number;
      unique_cards: number;
      upload_count: number;
      is_verified: boolean;
    }>(resp);

    assertEquals(body.success, true);
    assertEquals(body.upload_id, "upload-id-001");
    assertEquals(body.unique_cards, 2);
    assertEquals(body.upload_count, 1);
    assertEquals(body.is_verified, false);

    const mergeCalls = fetchMock.calls.filter((call) =>
      call.url.includes(supabaseUrls.rpc("merge_community_upload_data")),
    );
    assertEquals(mergeCalls.length, 1);
    const mergePayload = JSON.parse(mergeCalls[0].init?.body as string) as {
      p_league_id: string;
      p_device_id: string;
      p_ggg_uuid: string | null;
      p_ggg_username: string | null;
      p_is_verified: boolean;
      p_cards: { card_name: string; count: number }[];
    };
    assertEquals(mergePayload.p_league_id, VALID_LEAGUE_ID);
    assertEquals(mergePayload.p_device_id, VALID_DEVICE_ID);
    assertEquals(mergePayload.p_ggg_uuid, null);
    assertEquals(mergePayload.p_ggg_username, null);
    assertEquals(mergePayload.p_is_verified, false);
    assertEquals(mergePayload.p_cards, [
      { card_name: "The Doctor", count: 3 },
      { card_name: "Rain of Chaos", count: 12 },
    ]);

    const cardTableCalls = fetchMock.calls.filter((call) =>
      call.url.includes(supabaseUrls.table("cards")),
    );
    assertEquals(cardTableCalls.length, 0);

    fetchMock.restore();
  },
);

quietTest(
  "v2-upload-community-data — trims and dedupes card names before merge",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    setupFullUploadMocks(fetchMock, {
      upload_id: "upload-id-001",
      total_cards: 17,
      upload_count: 1,
      is_verified: false,
    });

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      validUploadBody({
        cards: [
          { card_name: " The Doctor ", count: 3 },
          { card_name: "The Doctor", count: 5 },
          { card_name: "Rain of Chaos", count: 12 },
        ],
      }),
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{
      success: boolean;
      total_cards: number;
      unique_cards: number;
    }>(resp);

    assertEquals(body.success, true);
    assertEquals(body.total_cards, 17);
    assertEquals(body.unique_cards, 2);

    const mergeCalls = fetchMock.calls.filter((call) =>
      call.url.includes(supabaseUrls.rpc("merge_community_upload_data")),
    );
    assertEquals(mergeCalls.length, 1);
    const mergePayload = JSON.parse(mergeCalls[0].init?.body as string) as {
      p_cards: { card_name: string; count: number }[];
    };
    assertEquals(mergePayload.p_cards, [
      { card_name: "The Doctor", count: 5 },
      { card_name: "Rain of Chaos", count: 12 },
    ]);

    fetchMock.restore();
  },
);

quietTest(
  "v2-upload-community-data — returns 500 when upload merge RPC returns invalid result",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    setupFullUploadMocks(fetchMock, "not-a-number");

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      validUploadBody(),
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 500);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "Invalid upload merge result");

    fetchMock.restore();
  },
);

// Test 24: Returns 404 when league not found
quietTest(
  "v2-upload-community-data — returns 404 when league not found",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // League lookup returns PostgREST error (no rows for .single())
    fetchMock.onUrlContaining(
      "poe_leagues",
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
          },
        ),
    );

    const req = createAuthorizedRequest(
      FUNCTION_URL,
      validUploadBody(),
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 404);
    const body = await responseBody<{ error: string }>(resp);
    assertEquals(body.error, "League not found");

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Device-scoped uploads with optional GGG verification
// ═══════════════════════════════════════════════════════════════════════════════

// Verification metadata is forwarded without looking up another device.
quietTest(
  "v2-upload-community-data — keeps the supplied device identity alongside verified GGG metadata",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    const NEW_DEVICE_ID = "aaaaaaaa-1111-2222-3333-ffffffffffff";
    const GGG_UUID = "ggg-uuid-merge-test";
    const UPLOAD_ID = "upload-for-supplied-device";

    // League lookup
    fetchMock.onUrlContaining("poe_leagues", () =>
      postgrestResponse({ id: VALID_LEAGUE_ID, game: "poe2" }),
    );

    // GGG profile verification — return a valid profile so gggUuid is set
    fetchMock.onUrlContaining(
      "api.pathofexile.com/profile",
      () =>
        new Response(JSON.stringify({ uuid: GGG_UUID, name: "MergePlayer" }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
    );

    setupUploadMergeMock(fetchMock, {
      upload_id: UPLOAD_ID,
      total_cards: 15,
      upload_count: 4,
      is_verified: true,
    });

    const req = createMockRequest(FUNCTION_URL, {
      method: "POST",
      body: validUploadBody({ device_id: NEW_DEVICE_ID }),
      bearerToken: testToken,
      apikey: "test-anon-key",
      headers: { "x-ggg-token": "mock-ggg-token" },
    });
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{
      success: boolean;
      upload_id: string;
      upload_count: number;
    }>(resp);
    assertEquals(body.success, true);
    // Return the merge result for the supplied device.
    assertEquals(body.upload_id, UPLOAD_ID);
    // upload_count should be incremented from 3 → 4
    assertEquals(body.upload_count, 4);

    const mergeCalls = fetchMock.calls.filter((call) =>
      call.url.includes(supabaseUrls.rpc("merge_community_upload_data")),
    );
    assertEquals(mergeCalls.length, 1);
    const mergePayload = JSON.parse(mergeCalls[0].init?.body as string) as {
      p_device_id: string;
      p_ggg_uuid: string | null;
      p_ggg_username: string | null;
      p_is_verified: boolean;
    };
    assertEquals(mergePayload.p_device_id, NEW_DEVICE_ID);
    assertEquals(mergePayload.p_ggg_uuid, GGG_UUID);
    assertEquals(mergePayload.p_ggg_username, "MergePlayer");
    assertEquals(mergePayload.p_is_verified, true);
    assertEquals(
      fetchMock.calls.filter((call) => call.url.includes("/community_uploads"))
        .length,
      0,
    );

    fetchMock.restore();
  },
);

// Anonymous uploads omit GGG account metadata.
quietTest(
  "v2-upload-community-data — omits GGG metadata for anonymous uploads",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // League lookup
    fetchMock.onUrlContaining("poe_leagues", () =>
      postgrestResponse({ id: VALID_LEAGUE_ID, game: "poe2" }),
    );

    // No GGG profile mock — anonymous upload (no x-ggg-token header)

    setupUploadMergeMock(fetchMock, {
      upload_id: "anon-upload-id",
      total_cards: 15,
      upload_count: 1,
      is_verified: false,
    });

    // No x-ggg-token header — anonymous
    const req = createAuthorizedRequest(
      FUNCTION_URL,
      validUploadBody(),
      testToken,
    );
    const resp = await handler(req);

    assertEquals(resp.status, 200);
    const body = await responseBody<{
      success: boolean;
      upload_id: string;
      upload_count: number;
    }>(resp);
    assertEquals(body.success, true);

    const mergeCalls = fetchMock.calls.filter((call) =>
      call.url.includes(supabaseUrls.rpc("merge_community_upload_data")),
    );
    assertEquals(mergeCalls.length, 1);
    const mergePayload = JSON.parse(mergeCalls[0].init?.body as string) as {
      p_device_id: string;
      p_ggg_uuid: string | null;
      p_ggg_username: string | null;
      p_is_verified: boolean;
    };
    assertEquals(mergePayload.p_device_id, VALID_DEVICE_ID);
    assertEquals(mergePayload.p_ggg_uuid, null);
    assertEquals(mergePayload.p_ggg_username, null);
    assertEquals(mergePayload.p_is_verified, false);

    fetchMock.restore();
  },
);
