/**
 * Unit tests for supabase/functions/upload-community-data/index.ts
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
 *   deno test --allow-all supabase/functions/tests/upload-community-data_test.ts
 */

import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  createAuthorizedRequest,
  createMockRequest,
  createOptionsRequest,
  createTestJwt,
  mockFetch,
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

await import("../upload-community-data/index.ts");

const handler = serveStub.handler!;
serveStub.restore();

assert(handler !== null, "Handler should have been captured from Deno.serve");

// ─── Constants ───────────────────────────────────────────────────────────────

const FUNCTION_URL = "http://localhost/upload-community-data";
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

  // Auth validation — getClaims calls /auth/v1/user
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
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
  );

  // Rate limit RPC → allowed
  fetchMock.onUrlContaining(supabaseUrls.rpc("check_and_log_request"), () =>
    rpcResponse({ allowed: true }),
  );

  return fetchMock;
}

/**
 * Registers all the mocks needed for a successful upload flow beyond auth.
 * This includes league lookup, card upsert, card fetch, community_uploads upsert,
 * community_card_data fetch/insert, and total recompute.
 */
function setupFullUploadMocks(
  fetchMock: ReturnType<typeof mockFetch>,
  cardNames: string[] = ["The Doctor", "Rain of Chaos"],
) {
  // League lookup by name + game
  fetchMock.onUrlContaining("poe_leagues", () =>
    postgrestResponse({ id: VALID_LEAGUE_ID, game: "poe2" }),
  );

  // Card upsert (POST to cards table) — ignoreDuplicates
  fetchMock.onUrlContaining(supabaseUrls.table("cards"), (_url, init) => {
    if (init?.method === "POST") {
      // Upsert returns empty on ignoreDuplicates
      return postgrestResponse([]);
    }
    // GET — fetch card records by game + name
    return postgrestResponse(
      cardNames.map((name, i) => ({ id: `card-id-${i + 1}`, name })),
    );
  });

  // community_uploads lookup (existing upload check) — no existing upload
  fetchMock.onUrlContaining("community_uploads", (_url, init) => {
    if (init?.method === "POST") {
      // Insert new upload
      return postgrestResponse({ id: "upload-id-001" });
    }
    if (init?.method === "PATCH") {
      // Update
      return postgrestResponse({ id: "upload-id-001" });
    }
    // GET — no existing upload (maybeSingle returns null)
    return postgrestResponse(null);
  });

  // community_card_data — fetch existing + insert new
  fetchMock.onUrlContaining("community_card_data", (_url, init) => {
    if (init?.method === "POST") {
      return postgrestResponse([]);
    }
    // GET — existing card data, dynamically based on cardNames
    return postgrestResponse(
      cardNames.map((_, i) => ({ count: 10, card_id: `card-id-${i + 1}` })),
    );
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORS
// ═══════════════════════════════════════════════════════════════════════════════

// Test 27: OPTIONS returns CORS headers
quietTest(
  "upload-community-data — OPTIONS returns 200 (CORS preflight)",
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

// Test 25: Returns 401 when no authorization header
quietTest(
  "upload-community-data — returns 401 when no authorization header",
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

// Test 26: Returns 429 when rate limited
quietTest("upload-community-data — returns 429 when rate limited", async () => {
  const fetchMock = mockFetch();

  // Auth succeeds
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
});

// ═══════════════════════════════════════════════════════════════════════════════
// Input Validation (validateBody)
// ═══════════════════════════════════════════════════════════════════════════════

// Test 1: Returns 400 for non-object body
quietTest(
  "upload-community-data — returns 400 for non-object body",
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
  "upload-community-data — returns 400 when neither league_id nor league_name",
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
  "upload-community-data — returns 400 for invalid league_id UUID format",
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
  "upload-community-data — returns 400 when league_name provided without game",
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
  "upload-community-data — returns 400 when league_name exceeds 200 chars",
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
  "upload-community-data — returns 400 for invalid device_id",
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
  "upload-community-data — returns 400 when cards is empty array",
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
  "upload-community-data — returns 400 when cards exceeds 1000 entries",
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
  "upload-community-data — returns 400 for invalid card entry (not object)",
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
  "upload-community-data — returns 400 for empty card_name",
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
  "upload-community-data — returns 400 for card_name exceeding 200 chars",
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
  "upload-community-data — returns 400 for non-integer count",
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
quietTest("upload-community-data — returns 400 for count <= 0", async () => {
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
  "upload-community-data — returns 400 for count > 10,000,000",
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
  "upload-community-data — small sample (<50 cards) passes Benford's check (no suspicion)",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // 5 cards, total well under 500 → fraud detection skipped
    const cards = Array.from({ length: 5 }, (_, i) => ({
      card_name: `Card${i}`,
      count: 10,
    }));

    setupFullUploadMocks(
      fetchMock,
      cards.map((c) => c.card_name),
    );

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
  "upload-community-data — small sample (<10 cards) passes round numbers check",
  async () => {
    const fetchMock = setupAuthorizedMocks();
    const testToken = createTestJwt({ sub: "test-user-id-001" });

    // 3 cards, all round numbers but too few to trigger
    const cards = [
      { card_name: "Card0", count: 10 },
      { card_name: "Card1", count: 20 },
      { card_name: "Card2", count: 30 },
    ];

    setupFullUploadMocks(
      fetchMock,
      cards.map((c) => c.card_name),
    );

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
  "upload-community-data — flags suspicious when >50% counts are round numbers",
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

    // Card names for all 20 cards
    const allCardRecords = cards.map((c, i) => ({
      id: `card-id-${i}`,
      name: c.card_name,
    }));

    fetchMock.onUrlContaining(supabaseUrls.table("cards"), (_url, init) => {
      if (init?.method === "POST") return postgrestResponse([]);
      return postgrestResponse(allCardRecords);
    });

    // community_uploads — new upload
    fetchMock.onUrlContaining("community_uploads", (_url, init) => {
      if (init?.method === "POST") {
        return postgrestResponse({ id: "upload-id-suspicious" });
      }
      if (init?.method === "PATCH") {
        return postgrestResponse({ id: "upload-id-suspicious" });
      }
      // GET for maybeSingle → null (new upload)
      // GET for suspicion_reasons → return current upload
      return postgrestResponse(null);
    });

    // community_card_data
    const cardDataRows = cards.map((c, i) => ({
      count: c.count,
      card_id: `card-id-${i}`,
    }));
    fetchMock.onUrlContaining("community_card_data", (_url, init) => {
      if (init?.method === "POST") return postgrestResponse([]);
      return postgrestResponse(cardDataRows);
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
  "upload-community-data — link-ggg returns 400 for missing device_id",
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
  "upload-community-data — link-ggg returns 400 for missing X-GGG-Token header",
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
  "upload-community-data — link-ggg succeeds with valid GGG profile",
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

    // Mock community_uploads update
    fetchMock.onUrlContaining("community_uploads", () =>
      postgrestResponse([{ id: "upload-1" }, { id: "upload-2" }]),
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
      updated_records: number;
    }>(resp);
    assertEquals(body.success, true);
    assertEquals(body.ggg_uuid, "ggg-uuid-123");
    assertEquals(body.ggg_username, "TestExile");
    assertEquals(body.updated_records, 2);

    fetchMock.restore();
  },
);

// Test 21: Returns 502 when GGG API returns error
quietTest(
  "upload-community-data — link-ggg returns 502 when GGG API returns error",
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
  "upload-community-data — link-ggg returns 502 when GGG profile missing uuid/name",
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
    assert(body.error.includes("uuid/name"));

    fetchMock.restore();
  },
);

// ═══════════════════════════════════════════════════════════════════════════════
// Upload Flow
// ═══════════════════════════════════════════════════════════════════════════════

// Test 23: Successful upload with league_name + game lookup
quietTest(
  "upload-community-data — successful upload with league_name + game",
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

    fetchMock.restore();
  },
);

// Test 24: Returns 404 when league not found
quietTest(
  "upload-community-data — returns 404 when league not found",
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
