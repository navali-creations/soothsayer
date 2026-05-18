import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";
import { authorize, responseJson } from "../_shared/utils.ts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CardEntry {
  card_name: string;
  count: number;
}

interface RequestBody {
  league_id?: string;
  league_name?: string;
  game?: "poe1" | "poe2";
  device_id: string;
  is_packaged?: boolean;
  cards: CardEntry[];
}

// ---------------------------------------------------------------------------
// Statistical helpers (Layer 1.5 fraud detection)
// ---------------------------------------------------------------------------

/** Benford's Law expected distribution for leading digits 1-9 */
const BENFORD_EXPECTED = [
  0.301, 0.176, 0.125, 0.097, 0.079, 0.067, 0.058, 0.051, 0.046,
];

/**
 * Returns `true` if the leading-digit distribution looks natural (passes).
 * Returns `false` if the distribution is suspicious (fails chi-squared at p < 0.01).
 */
function checkBenfordsLaw(counts: number[]): boolean {
  const leadingDigits = counts
    .filter((c) => c > 0)
    .map((c) => parseInt(String(c)[0], 10));

  const total = leadingDigits.length;
  if (total < 50) return true; // not enough data to judge

  const observed = new Array(9).fill(0);
  for (const d of leadingDigits) {
    if (d >= 1 && d <= 9) observed[d - 1]++;
  }

  // Chi-squared test
  let chiSquared = 0;
  for (let i = 0; i < 9; i++) {
    const expected = BENFORD_EXPECTED[i] * total;
    chiSquared += (observed[i] - expected) ** 2 / expected;
  }

  // Critical value for 8 degrees of freedom at p = 0.01 is ~20.09
  return chiSquared < 20.09;
}

/**
 * Returns `true` if NOT suspicious (passes).
 * Returns `false` if > 50 % of counts are multiples of 10.
 */
function checkRoundNumbers(counts: number[]): boolean {
  if (counts.length < 10) return true;
  const roundCount = counts.filter((c) => c % 10 === 0).length;
  return roundCount / counts.length <= 0.5;
}

// ---------------------------------------------------------------------------
// Validation helpers
// ---------------------------------------------------------------------------

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Keep these values in sync with the Postgres community_upload_limits() RPC.
// The edge function validates early for cheap rejection; Postgres enforces the
// same limits again inside the atomic merge transaction.
const COMMUNITY_UPLOAD_LIMITS = {
  // PoE has ~450 unique divination cards per game; 1000 leaves safe headroom
  // without allowing oversized request bodies.
  maxCards: 1000,
  // Per-card count guardrail. This is far above realistic user data, but keeps
  // malicious or corrupt payloads bounded.
  maxCardCount: 10_000_000,
  // community_uploads.total_cards_uploaded is an INT, so keep accepted payload
  // totals within the signed 32-bit integer range.
  maxTotalCards: 2_147_483_647,
} as const;

type MergeCommunityUploadResult = {
  upload_id: string;
  total_cards: number;
  upload_count: number;
  is_verified: boolean;
};

function parseMergeCommunityUploadResult(
  data: unknown,
): MergeCommunityUploadResult | null {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  const result = data as Record<string, unknown>;
  if (
    typeof result.upload_id !== "string" ||
    typeof result.total_cards !== "number" ||
    !Number.isInteger(result.total_cards) ||
    typeof result.upload_count !== "number" ||
    !Number.isInteger(result.upload_count) ||
    typeof result.is_verified !== "boolean"
  ) {
    return null;
  }

  if (result.total_cards < 0 || result.upload_count <= 0) {
    return null;
  }

  return {
    upload_id: result.upload_id,
    total_cards: result.total_cards,
    upload_count: result.upload_count,
    is_verified: result.is_verified,
  };
}

function validateBody(
  body: unknown,
): { ok: true; data: RequestBody } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "Invalid request body" };
  }

  const b = body as Record<string, unknown>;

  const hasLeagueId = typeof b.league_id === "string" && b.league_id.length > 0;
  const hasLeagueName =
    typeof b.league_name === "string" && b.league_name.length > 0;
  const hasGame = b.game === "poe1" || b.game === "poe2";

  if (!hasLeagueId && !hasLeagueName) {
    return {
      ok: false,
      error: "Either league_id (UUID) or league_name + game must be provided",
    };
  }

  if (hasLeagueId && !UUID_RE.test(b.league_id as string)) {
    return { ok: false, error: "league_id must be a valid UUID string" };
  }

  if (hasLeagueName && !hasGame) {
    return {
      ok: false,
      error: 'game must be "poe1" or "poe2" when league_name is provided',
    };
  }

  if (hasLeagueName && (b.league_name as string).length > 200) {
    return {
      ok: false,
      error: "league_name exceeds maximum length of 200 characters",
    };
  }

  if (typeof b.device_id !== "string" || !UUID_RE.test(b.device_id)) {
    return {
      ok: false,
      error: "device_id must be a valid UUID v4 string",
    };
  }

  if (!Array.isArray(b.cards) || b.cards.length === 0) {
    return { ok: false, error: "cards must be a non-empty array" };
  }

  // PoE has ~450 unique divination cards per game — 1000 is generous headroom
  if (b.cards.length > COMMUNITY_UPLOAD_LIMITS.maxCards) {
    return {
      ok: false,
      error: `cards array exceeds maximum of ${COMMUNITY_UPLOAD_LIMITS.maxCards} entries`,
    };
  }

  let totalCards = 0;
  for (let i = 0; i < b.cards.length; i++) {
    const c = b.cards[i];
    if (!c || typeof c !== "object") {
      return { ok: false, error: `cards[${i}] is invalid` };
    }
    if (typeof c.card_name !== "string" || c.card_name.length === 0) {
      return {
        ok: false,
        error: `cards[${i}].card_name must be a non-empty string`,
      };
    }
    if (c.card_name.length > 200) {
      return {
        ok: false,
        error: `cards[${i}].card_name exceeds maximum length of 200 characters`,
      };
    }
    if (
      typeof c.count !== "number" ||
      !Number.isInteger(c.count) ||
      c.count <= 0 ||
      c.count > COMMUNITY_UPLOAD_LIMITS.maxCardCount
    ) {
      return {
        ok: false,
        error: `cards[${i}].count must be a positive integer (max ${COMMUNITY_UPLOAD_LIMITS.maxCardCount.toLocaleString(
          "en-US",
        )})`,
      };
    }
    totalCards += c.count;
  }

  if (totalCards > COMMUNITY_UPLOAD_LIMITS.maxTotalCards) {
    return {
      ok: false,
      error: "cards total exceeds maximum supported upload size",
    };
  }

  // is_packaged is optional; if present it must be a boolean
  if (b.is_packaged !== undefined && typeof b.is_packaged !== "boolean") {
    return { ok: false, error: "is_packaged must be a boolean" };
  }

  return {
    ok: true,
    data: {
      league_id: hasLeagueId ? (b.league_id as string) : undefined,
      league_name: hasLeagueName ? (b.league_name as string) : undefined,
      game: hasGame ? (b.game as "poe1" | "poe2") : undefined,
      device_id: b.device_id as string,
      is_packaged:
        typeof b.is_packaged === "boolean" ? b.is_packaged : undefined,
      cards: b.cards as CardEntry[],
    },
  };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TAG = "[upload-community-data]";

// ---------------------------------------------------------------------------
// link-ggg: retroactively link a GGG account to existing upload records
// ---------------------------------------------------------------------------

async function handleLinkGgg(
  body: Record<string, unknown>,
  gggAccessToken: string | null,
): Promise<Response> {
  const deviceId = body.device_id;
  const isPackaged = body.is_packaged !== false;

  if (
    typeof deviceId !== "string" ||
    !UUID_RE.test(deviceId) ||
    typeof gggAccessToken !== "string" ||
    !gggAccessToken
  ) {
    return responseJson({
      status: 400,
      body: {
        error:
          "link-ggg requires: device_id (UUID), X-GGG-Token header (string)",
      },
    });
  }

  // 1. Verify GGG identity
  let gggUuid: string;
  let gggUsername: string;

  try {
    const gggResp = await fetch("https://api.pathofexile.com/profile", {
      headers: {
        Authorization: `Bearer ${gggAccessToken}`,
        "User-Agent": "OAuth soothsayer/1.0.0 (contact: eskrzy@gmail.com)",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!gggResp.ok) {
      console.warn(
        `${TAG} link-ggg: GGG profile request returned ${gggResp.status}`,
      );
      return responseJson({
        status: 502,
        body: { error: "GGG profile verification failed" },
      });
    }

    const profile = await gggResp.json();
    if (typeof profile.uuid !== "string" || typeof profile.name !== "string") {
      return responseJson({
        status: 502,
        body: { error: "GGG profile response missing uuid/name" },
      });
    }

    gggUuid = profile.uuid;
    gggUsername = isPackaged ? profile.name : `${profile.name} (internal)`;
  } catch (err) {
    console.error(`${TAG} link-ggg: GGG profile fetch error:`, err);
    return responseJson({
      status: 502,
      body: { error: "GGG profile request failed" },
    });
  }

  // 2. Update all community_uploads rows for this device_id
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const { data: updatedRows, error: updateErr } = await supabase
    .from("community_uploads")
    .update({
      ggg_uuid: gggUuid,
      ggg_username: gggUsername,
      is_verified: true,
    })
    .eq("device_id", deviceId)
    .select("id");

  if (updateErr) {
    console.error(`${TAG} link-ggg: update failed:`, updateErr);
    return responseJson({
      status: 500,
      body: { error: "Failed to update upload records" },
    });
  }

  const count = updatedRows?.length ?? 0;
  console.log(
    `${TAG} link-ggg: linked GGG account "${gggUsername}" (${gggUuid}) to ${count} upload record(s) for device ${deviceId}`,
  );

  return responseJson({
    status: 200,
    body: {
      success: true,
      ggg_username: gggUsername,
      ggg_uuid: gggUuid,
      updated_records: count,
    },
  });
}

// ---------------------------------------------------------------------------
// Main handler
// ---------------------------------------------------------------------------

Deno.serve(async (req: Request) => {
  // 1. Authenticate & rate-limit (10 req / hour)
  const authResult = await authorize({
    req,
    endpoint: "upload-community-data",
    windowMs: 60 * 60 * 1000, // 1 hour
    maxHits: 10,
  });

  if (authResult instanceof Response) return authResult;

  // authResult is the JWT token string — we don't need it further since we use
  // a service-role client for all DB writes.

  // 2. Parse & validate body
  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return responseJson({
      status: 400,
      body: { error: "Invalid JSON body" },
    });
  }

  const gggAccessTokenHeader = req.headers.get("x-ggg-token");
  const gggAccessToken: string | null =
    typeof gggAccessTokenHeader === "string" &&
    gggAccessTokenHeader.length > 0 &&
    gggAccessTokenHeader.length <= 4096
      ? gggAccessTokenHeader
      : null;

  // ─── Handle link-ggg action (early return) ─────────────────────────────
  if (
    rawBody &&
    typeof rawBody === "object" &&
    (rawBody as Record<string, unknown>).action === "link-ggg"
  ) {
    return handleLinkGgg(rawBody as Record<string, unknown>, gggAccessToken);
  }

  const validation = validateBody(rawBody);
  if (!validation.ok) {
    return responseJson({ status: 400, body: { error: validation.error } });
  }

  const {
    league_id: leagueId,
    league_name: leagueName,
    game: gameParam,
    device_id: deviceId,
    cards,
  } = validation.data;

  const isPackaged = validation.data.is_packaged ?? true;

  // 3. Create service-role Supabase client
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  // 4. Verify league exists
  let league: { id: string; game: string } | null = null;
  let leagueError: unknown = null;

  if (leagueId) {
    // Lookup by UUID
    const result = await supabase
      .from("poe_leagues")
      .select("id, game")
      .eq("id", leagueId)
      .single();
    league = result.data;
    leagueError = result.error;
  } else if (leagueName && gameParam) {
    // Lookup by GGG league name + game
    const result = await supabase
      .from("poe_leagues")
      .select("id, game")
      .eq("league_id", leagueName)
      .eq("game", gameParam)
      .single();
    league = result.data;
    leagueError = result.error;
  }

  if (leagueError || !league) {
    return responseJson({ status: 404, body: { error: "League not found" } });
  }

  // 5. Optional GGG account verification (token now read from header)
  let gggUuid: string | null = null;
  let gggUsername: string | null = null;
  let isVerified = false;

  if (gggAccessToken) {
    try {
      const gggResp = await fetch("https://api.pathofexile.com/profile", {
        headers: {
          Authorization: `Bearer ${gggAccessToken}`,
          "User-Agent": "OAuth soothsayer/1.0.0 (contact: eskrzy@gmail.com)",
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (gggResp.ok) {
        const profile = await gggResp.json();
        if (
          typeof profile.uuid === "string" &&
          typeof profile.name === "string"
        ) {
          gggUuid = profile.uuid;
          gggUsername = isPackaged
            ? profile.name
            : `${profile.name} (internal)`;
          isVerified = true;
          console.log(
            `${TAG} GGG verification succeeded for user "${gggUsername}"`,
          );
        } else {
          console.warn(
            `${TAG} GGG profile response missing uuid/name — proceeding as anonymous`,
          );
        }
      } else {
        console.warn(
          `${TAG} GGG profile request returned ${gggResp.status} — proceeding as anonymous`,
        );
      }
    } catch (err) {
      console.warn(
        `${TAG} GGG profile request failed: ${
          err instanceof Error ? err.message : "unknown error"
        }`,
      );
    }
  }

  // 6. Resolve card names → card IDs
  const uniqueNames = [...new Set(cards.map((c) => c.card_name))];

  // Upsert new card names into the cards table
  const cardRows = uniqueNames.map((name) => ({
    game: league.game,
    name,
  }));

  const { error: upsertCardsError } = await supabase
    .from("cards")
    .upsert(cardRows, { onConflict: "game,name", ignoreDuplicates: true });

  if (upsertCardsError) {
    console.error(`${TAG} Card upsert failed:`, upsertCardsError);
    return responseJson({
      status: 500,
      body: { error: "Failed to resolve card names" },
    });
  }

  // Fetch all card IDs for this league that we care about
  const { data: cardRecords, error: cardFetchError } = await supabase
    .from("cards")
    .select("id, name")
    .eq("game", league.game)
    .in("name", uniqueNames);

  if (cardFetchError || !cardRecords) {
    console.error(`${TAG} Card fetch failed:`, cardFetchError);
    return responseJson({
      status: 500,
      body: { error: "Failed to resolve card names" },
    });
  }

  const cardNameToId = new Map<string, string>();
  for (const rec of cardRecords) {
    cardNameToId.set(rec.name, rec.id);
  }

  // Build resolved cards list (skip any that couldn't be resolved, defensively)
  const resolvedCards: { cardId: string; count: number }[] = [];
  for (const c of cards) {
    const cardId = cardNameToId.get(c.card_name);
    if (cardId) {
      resolvedCards.push({ cardId, count: c.count });
    } else {
      console.warn(`${TAG} Could not resolve card "${c.card_name}" — skipping`);
    }
  }

  if (resolvedCards.length === 0) {
    return responseJson({
      status: 400,
      body: { error: "No valid cards could be resolved" },
    });
  }

  // 7. Atomically create/update the upload row and merge card counts.
  const uploadMergeStartedAt = Date.now();
  const { data: uploadMergeData, error: uploadMergeError } = await supabase.rpc(
    "merge_community_upload_data",
    {
      p_league_id: league.id,
      p_device_id: deviceId,
      p_ggg_uuid: gggUuid,
      p_ggg_username: gggUsername,
      p_is_verified: isVerified,
      p_cards: resolvedCards.map((card) => ({
        card_id: card.cardId,
        count: card.count,
      })),
    },
  );

  if (uploadMergeError) {
    console.error(`${TAG} community upload merge failed:`, uploadMergeError);
    return responseJson({
      status: 500,
      body: { error: "Failed to merge upload data" },
    });
  }

  const uploadMergeResult = parseMergeCommunityUploadResult(uploadMergeData);
  if (!uploadMergeResult) {
    console.error(
      `${TAG} community upload merge returned invalid result type=${typeof uploadMergeData}`,
    );
    return responseJson({
      status: 500,
      body: { error: "Invalid upload merge result" },
    });
  }

  const uploadId = uploadMergeResult.upload_id;
  const effectiveTotal = uploadMergeResult.total_cards;
  const uploadCount = uploadMergeResult.upload_count;
  isVerified = uploadMergeResult.is_verified;
  const uploadMergeMs = Date.now() - uploadMergeStartedAt;

  // 8. Statistical fraud checks (Layer 1.5) — only if effectiveTotal >= 500
  if (effectiveTotal >= 500) {
    const allCounts = resolvedCards.map((c) => c.count);
    const suspicionReasons: string[] = [];

    if (!checkBenfordsLaw(allCounts)) {
      suspicionReasons.push("benfords_law_violation");
    }
    if (!checkRoundNumbers(allCounts)) {
      suspicionReasons.push("excessive_round_numbers");
    }

    if (suspicionReasons.length > 0) {
      console.warn(
        `${TAG} Suspicious upload detected (upload_id=${uploadId}): ${suspicionReasons.join(
          ", ",
        )}`,
      );

      // Fetch existing suspicion reasons to merge rather than overwrite
      const { data: currentUpload } = await supabase
        .from("community_uploads")
        .select("suspicion_reasons")
        .eq("id", uploadId)
        .single();

      const existingReasons: string[] = currentUpload?.suspicion_reasons ?? [];
      const mergedReasons = [
        ...new Set([...existingReasons, ...suspicionReasons]),
      ];

      const { error: suspicionErr } = await supabase
        .from("community_uploads")
        .update({
          is_suspicious: true,
          suspicion_reasons: mergedReasons,
        })
        .eq("id", uploadId);

      if (suspicionErr) {
        console.error(`${TAG} Failed to update suspicion flags:`, suspicionErr);
        // Non-fatal — don't fail the whole request
      }
    }
  }

  // 11. Return success
  const uniqueCards = new Set(resolvedCards.map((c) => c.cardId)).size;

  console.log(
    `${TAG} Upload successful: upload_id=${uploadId}, total_cards=${effectiveTotal}, unique_cards=${uniqueCards}, upload_count=${uploadCount}, is_verified=${isVerified}, upload_merge_ms=${uploadMergeMs}`,
  );

  return responseJson({
    status: 200,
    body: {
      success: true,
      upload_id: uploadId,
      total_cards: effectiveTotal,
      unique_cards: uniqueCards,
      upload_count: uploadCount,
      is_verified: isVerified,
    },
  });
});
