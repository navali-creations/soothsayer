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
  if (b.cards.length > 1000) {
    return { ok: false, error: "cards array exceeds maximum of 1000 entries" };
  }

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
      c.count > 10_000_000
    ) {
      return {
        ok: false,
        error: `cards[${i}].count must be a positive integer (max 10,000,000)`,
      };
    }
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

  // 7. Calculate total cards uploaded
  const totalCards = resolvedCards.reduce((sum, c) => sum + c.count, 0);

  // 8. Upsert community_uploads (select → insert or update)
  const { data: existingUpload } = await supabase
    .from("community_uploads")
    .select("id, ggg_uuid, ggg_username, is_verified, upload_count")
    .eq("league_id", league.id)
    .eq("device_id", deviceId)
    .maybeSingle();

  let uploadId: string;
  let uploadCount: number;

  if (existingUpload) {
    // Update existing row with COALESCE / OR logic in TypeScript
    uploadCount = existingUpload.upload_count + 1;

    const { error: updateErr } = await supabase
      .from("community_uploads")
      .update({
        total_cards_uploaded: totalCards,
        ggg_uuid: gggUuid ?? existingUpload.ggg_uuid,
        ggg_username: gggUsername ?? existingUpload.ggg_username,
        is_verified: isVerified || existingUpload.is_verified,
        last_uploaded_at: new Date().toISOString(),
        upload_count: uploadCount,
      })
      .eq("id", existingUpload.id);

    if (updateErr) {
      console.error(`${TAG} community_uploads update failed:`, updateErr);
      return responseJson({
        status: 500,
        body: { error: "Failed to update upload record" },
      });
    }

    uploadId = existingUpload.id;
    // Carry forward the most accurate verification status
    isVerified = isVerified || existingUpload.is_verified;
  } else {
    uploadCount = 1;

    const { data: newUpload, error: insertErr } = await supabase
      .from("community_uploads")
      .insert({
        league_id: league.id,
        device_id: deviceId,
        total_cards_uploaded: totalCards,
        ggg_uuid: gggUuid,
        ggg_username: gggUsername,
        is_verified: isVerified,
      })
      .select("id")
      .single();

    if (insertErr) {
      // Handle race condition: another request inserted between our SELECT and INSERT
      if (insertErr.code === "23505") {
        // Unique violation — retry as update
        const { data: raceUpload } = await supabase
          .from("community_uploads")
          .select("id, ggg_uuid, ggg_username, is_verified, upload_count")
          .eq("league_id", league.id)
          .eq("device_id", deviceId)
          .single();

        if (!raceUpload) {
          console.error(
            `${TAG} Race condition recovery failed — could not find upload after unique violation`,
          );
          return responseJson({
            status: 500,
            body: { error: "Failed to create upload record" },
          });
        }

        uploadCount = raceUpload.upload_count + 1;
        const { error: raceUpdateErr } = await supabase
          .from("community_uploads")
          .update({
            total_cards_uploaded: totalCards,
            ggg_uuid: gggUuid ?? raceUpload.ggg_uuid,
            ggg_username: gggUsername ?? raceUpload.ggg_username,
            is_verified: isVerified || raceUpload.is_verified,
            last_uploaded_at: new Date().toISOString(),
            upload_count: uploadCount,
          })
          .eq("id", raceUpload.id);

        if (raceUpdateErr) {
          console.error(`${TAG} Race condition update failed:`, raceUpdateErr);
          return responseJson({
            status: 500,
            body: { error: "Failed to create upload record" },
          });
        }

        uploadId = raceUpload.id;
        isVerified = isVerified || raceUpload.is_verified;
      } else {
        console.error(`${TAG} community_uploads insert failed:`, insertErr);
        return responseJson({
          status: 500,
          body: { error: "Failed to create upload record" },
        });
      }
    } else {
      uploadId = newUpload.id;
    }
  }

  // 9. Upsert community_card_data with GREATEST logic
  // Batch-fetch all existing card data rows for this upload
  const resolvedCardIds = resolvedCards.map((c) => c.cardId);

  const { data: existingCardData, error: existingCardDataError } =
    await supabase
      .from("community_card_data")
      .select("id, card_id, count")
      .eq("upload_id", uploadId)
      .in("card_id", resolvedCardIds);

  if (existingCardDataError) {
    console.error(
      `${TAG} community_card_data fetch failed:`,
      existingCardDataError,
    );
    return responseJson({
      status: 500,
      body: { error: "Failed to fetch existing card data" },
    });
  }

  const existingByCardId = new Map<string, { id: string; count: number }>();
  for (const row of existingCardData ?? []) {
    existingByCardId.set(row.card_id, { id: row.id, count: row.count });
  }

  const toInsert: { upload_id: string; card_id: string; count: number }[] = [];
  const toUpdate: { id: string; count: number }[] = [];

  for (const { cardId, count } of resolvedCards) {
    const existing = existingByCardId.get(cardId);
    if (!existing) {
      toInsert.push({ upload_id: uploadId, card_id: cardId, count });
    } else if (count > existing.count) {
      // GREATEST — only update when the new count is larger
      toUpdate.push({ id: existing.id, count });
    }
    // else: existing count >= new count, skip (GREATEST keeps higher value)
  }

  // Batch insert new card data rows
  if (toInsert.length > 0) {
    const { error: insertCardErr } = await supabase
      .from("community_card_data")
      .insert(toInsert);

    if (insertCardErr) {
      console.error(`${TAG} community_card_data insert failed:`, insertCardErr);
      return responseJson({
        status: 500,
        body: { error: "Failed to insert card data" },
      });
    }
  }

  // Batch update existing card data rows (one by one since each has different values)
  for (const { id, count } of toUpdate) {
    const { error: updateCardErr } = await supabase
      .from("community_card_data")
      .update({ count, updated_at: new Date().toISOString() })
      .eq("id", id);

    if (updateCardErr) {
      console.error(
        `${TAG} community_card_data update failed for id=${id}:`,
        updateCardErr,
      );
      // Non-fatal: continue with the rest
    }
  }

  // Recompute actual total_cards_uploaded from server-side data (accounts for GREATEST logic)
  const { data: actualTotalRow } = await supabase
    .from("community_card_data")
    .select("count")
    .eq("upload_id", uploadId);

  const actualTotal = (actualTotalRow ?? []).reduce(
    (sum: number, r: { count: number }) => sum + r.count,
    0,
  );

  if (actualTotal !== totalCards) {
    const { error: totalUpdateErr } = await supabase
      .from("community_uploads")
      .update({ total_cards_uploaded: actualTotal })
      .eq("id", uploadId);

    if (totalUpdateErr) {
      console.warn(
        `${TAG} Failed to update actual total_cards_uploaded: ${totalUpdateErr.message}`,
      );
    }
  }

  // Use the accurate total for fraud detection
  const effectiveTotal = actualTotal || totalCards;

  // 10. Statistical fraud checks (Layer 1.5) — only if effectiveTotal >= 500
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
    `${TAG} Upload successful: upload_id=${uploadId}, total_cards=${effectiveTotal}, unique_cards=${uniqueCards}, upload_count=${uploadCount}, is_verified=${isVerified}`,
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
