import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { createClient } from "jsr:@supabase/supabase-js@2";

/** poe.ninja price confidence: 1 = high/reliable, 2 = medium/thin sample, 3 = low/unreliable */
type Confidence = 1 | 2 | 3;

import { responseJson } from "../_shared/utils.ts";

Deno.serve(async (req) => {
  try {
    const secret = req.headers.get("x-cron-secret");
    const expectedSecret = Deno.env.get("INTERNAL_CRON_SECRET");

    if (secret !== expectedSecret) {
      return responseJson({ status: 401, body: { error: "Unauthorized" } });
    }

    // Only allow POST requests
    if (req.method !== "POST") {
      return responseJson({
        status: 405,
        body: { error: "Method not allowed" },
      });
    }

    const { game, leagueId } = await req.json();

    if (!game || !leagueId) {
      return responseJson({
        status: 400,
        body: { error: "Missing required parameters: game, leagueId" },
      });
    }

    // Build a tag for every log line so concurrent invocations are traceable
    const tag = `[${game}/${leagueId}]`;

    console.log(`${tag} Creating snapshot...`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
        },
      },
    );

    // 1. Find league
    const { data: league, error: leagueError } = await supabase
      .from("poe_leagues")
      .select("id, name")
      .eq("game", game)
      .eq("league_id", leagueId)
      .single();

    if (leagueError || !league) {
      console.error(`${tag} League not found: ${leagueId}`);
      return responseJson({ status: 404, body: { error: "League not found" } });
    }

    console.log(
      `${tag} Resolved league: id=${league.id}, name="${league.name}"`,
    );

    // // 2. Check for recent snapshot (< 10 minutes) to prevent duplicates
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: recentSnapshot } = await supabase
      .from("snapshots")
      .select("id, fetched_at")
      .eq("league_id", league.id)
      .gte("fetched_at", tenMinutesAgo)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();

    if (recentSnapshot) {
      console.log(
        `${tag} Recent snapshot exists (${recentSnapshot.fetched_at}), skipping...`,
      );
      return responseJson({
        status: 200,
        body: {
          message: "Recent snapshot exists",
          snapshot: recentSnapshot,
        },
      });
    }

    // 3. Fetch from poe.ninja exchange API
    const gamePrefix = game === "poe2" ? "poe2" : "poe1";
    const exchangeUrl = `https://poe.ninja/${gamePrefix}/api/economy/exchange/current/overview?league=${encodeURIComponent(
      league.name,
    )}&type=DivinationCard`;
    console.log(`${tag} Fetching exchange API: ${exchangeUrl}`);
    const exchangeResponse = await fetch(exchangeUrl);

    if (!exchangeResponse.ok) {
      throw new Error(
        `poe.ninja exchange API failed: ${exchangeResponse.statusText}`,
      );
    }

    const exchangeData = await exchangeResponse.json();

    // Calculate chaos to divine ratio
    const chaosToDivineRatio = exchangeData.core?.rates?.divine
      ? 1 / exchangeData.core.rates.divine
      : 100;

    console.log(`${tag} Exchange chaos-to-divine ratio: ${chaosToDivineRatio}`);

    // Build exchange card prices (exchange data is always high confidence)
    const exchangeCardPrices: Array<any> = [];
    const items = exchangeData.items ?? [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const line = exchangeData.lines[i];
      if (line && item.category === "Cards") {
        exchangeCardPrices.push({
          card_name: item.name,
          price_source: "exchange",
          chaos_value: line.primaryValue,
          divine_value:
            Math.round((line.primaryValue / chaosToDivineRatio) * 100) / 100,
          confidence: 1,
        });
      }
    }

    console.log(`${tag} Fetched ${exchangeCardPrices.length} exchange prices`);

    // 4. Fetch Stacked Deck price from poe.ninja Currency API
    let stackedDeckChaosCost = 0;
    let stackedDeckMaxVolumeRate: number | null = null;
    try {
      const currencyUrl = `https://poe.ninja/${gamePrefix}/api/economy/exchange/current/overview?league=${encodeURIComponent(
        league.name,
      )}&type=Currency`;
      console.log(`${tag} Fetching currency API: ${currencyUrl}`);
      const currencyResponse = await fetch(currencyUrl);

      if (!currencyResponse.ok) {
        console.warn(
          `${tag} Currency API failed: ${currencyResponse.statusText}, defaulting stacked deck cost to 0`,
        );
      } else {
        const currencyData = await currencyResponse.json();
        const stackedDeck = currencyData.lines?.find(
          (line: any) => line.id === "stacked-deck",
        );
        stackedDeckChaosCost = stackedDeck?.primaryValue || 0;
        const rawMaxVolumeRate = stackedDeck?.maxVolumeRate ?? null;
        stackedDeckMaxVolumeRate =
          rawMaxVolumeRate != null ? Math.floor(rawMaxVolumeRate) : null;
        console.log(
          `${tag} Stacked Deck cost: ${stackedDeckChaosCost} chaos, maxVolumeRate: ${
            stackedDeckMaxVolumeRate ?? "N/A"
          } decks/divine`,
        );
      }
    } catch (currencyError) {
      console.warn(
        `${tag} Failed to fetch stacked deck price, defaulting to 0:`,
        currencyError,
      );
    }

    // 5. Fetch from poe.ninja stash API (poe1 only — no stash API for poe2)
    let stashChaosToDivineRatio = 100;
    const stashCardPrices: Array<any> = [];

    if (game === "poe2") {
      console.log(`${tag} Skipping stash API (not available for poe2)`);
    } else {
      const stashUrl = `https://poe.ninja/poe1/api/economy/stash/current/item/overview?league=${encodeURIComponent(
        league.name,
      )}&type=DivinationCard`;
      console.log(`${tag} Fetching stash API: ${stashUrl}`);
      const stashResponse = await fetch(stashUrl);

      if (!stashResponse.ok) {
        throw new Error(
          `poe.ninja stash API failed: ${stashResponse.statusText}`,
        );
      }

      const stashData = await stashResponse.json();

      // Calculate stash ratio
      for (const card of stashData.lines || []) {
        if (card.divineValue > 0 && card.chaosValue > 0) {
          stashChaosToDivineRatio = card.chaosValue / card.divineValue;
          break;
        }
      }

      console.log(
        `${tag} Stash chaos-to-divine ratio: ${stashChaosToDivineRatio}`,
      );

      // Compute confidence level from poe.ninja stash data.
      //
      // poe.ninja signals its own confidence via sparkLine vs lowConfidenceSparkLine:
      //   - sparkLine.data is empty → poe.ninja considers data low confidence
      //   - sparkLine.data is populated → poe.ninja considers data reliable
      // We combine this with the sample count for a three-tier classification:
      //   - 3 (low):    sparkLine empty (regardless of count)
      //   - 2 (medium): sparkLine populated but count < 10
      //   - 1 (high):   sparkLine populated and count >= 10
      function computeConfidence(card: any): Confidence {
        const hasSparkLine =
          Array.isArray(card.sparkLine?.data) && card.sparkLine.data.length > 0;

        if (!hasSparkLine) return 3;
        if ((card.count ?? 0) >= 10) return 1;
        return 2;
      }

      // Build stash card prices with confidence
      const confidenceCounts = { 1: 0, 2: 0, 3: 0 };
      for (const card of stashData.lines ?? []) {
        const confidence = computeConfidence(card);
        confidenceCounts[confidence]++;
        stashCardPrices.push({
          card_name: card.name,
          price_source: "stash",
          chaos_value: card.chaosValue,
          divine_value: Math.round(card.divineValue * 100) / 100,
          confidence,
        });
      }

      console.log(
        `${tag} Fetched ${stashCardPrices.length} stash prices — confidence: ${confidenceCounts[1]} high, ${confidenceCounts[2]} medium, ${confidenceCounts[3]} low`,
      );
    }

    // 6. Insert snapshot and card prices in transaction
    const { data: snapshot, error: snapshotError } = await supabase
      .from("snapshots")
      .insert({
        league_id: league.id,
        fetched_at: new Date().toISOString(),
        exchange_chaos_to_divine: chaosToDivineRatio,
        stash_chaos_to_divine: stashChaosToDivineRatio,
        stacked_deck_chaos_cost: stackedDeckChaosCost,
        stacked_deck_max_volume_rate: stackedDeckMaxVolumeRate,
      })
      .select()
      .single();

    if (snapshotError || !snapshot) {
      throw new Error(`Failed to create snapshot: ${snapshotError?.message}`);
    }

    console.log(`${tag} Created snapshot ${snapshot.id}`);

    // 6b. Upsert unique card names into `cards` table
    const uniqueCardNames = [
      ...new Set([
        ...exchangeCardPrices.map((p) => p.card_name),
        ...stashCardPrices.map((p) => p.card_name),
      ]),
    ];

    if (uniqueCardNames.length > 0) {
      const cardRows = uniqueCardNames.map((name) => ({
        game,
        name,
      }));

      const { error: cardsUpsertError } = await supabase
        .from("cards")
        .upsert(cardRows, {
          onConflict: "game,name",
          ignoreDuplicates: true,
        });

      if (cardsUpsertError) {
        console.warn(
          `${tag} Failed to upsert cards (non-fatal): ${cardsUpsertError.message}`,
        );
      }
    }

    // 6c. Build card name → card_id map
    const { data: cardIdRows, error: cardIdError } = await supabase
      .from("cards")
      .select("id, name")
      .eq("game", game);

    const cardIdMap = new Map<string, string>();
    if (cardIdRows) {
      for (const row of cardIdRows) {
        cardIdMap.set(row.name, row.id);
      }
    }

    if (cardIdError) {
      console.warn(
        `${tag} Failed to fetch card IDs (non-fatal): ${cardIdError.message}`,
      );
    }

    console.log(
      `${tag} Upserted ${uniqueCardNames.length} card names, resolved ${cardIdMap.size} card IDs`,
    );

    if (uniqueCardNames.length > 0 && cardIdMap.size === 0) {
      console.error(
        `${tag} ALERT: Had ${uniqueCardNames.length} card names but resolved 0 card IDs — all prices will be skipped for this snapshot`,
      );
    }

    // 7. Insert all card prices (card_name is NOT stored — resolved via card_id FK)
    const allCardPrices: Array<{
      snapshot_id: string;
      card_id: string;
      price_source: string;
      chaos_value: number;
      divine_value: number;
      confidence: number;
    }> = [];

    let skippedCount = 0;
    for (const p of [...exchangeCardPrices, ...stashCardPrices]) {
      const cardId = cardIdMap.get(p.card_name);
      if (!cardId) {
        skippedCount++;
        console.warn(`${tag} No card_id for "${p.card_name}" — skipping`);
        continue;
      }
      allCardPrices.push({
        snapshot_id: snapshot.id,
        card_id: cardId,
        price_source: p.price_source,
        chaos_value: p.chaos_value,
        divine_value: p.divine_value,
        confidence: p.confidence,
      });
    }

    if (skippedCount > 0) {
      console.warn(
        `${tag} Skipped ${skippedCount} prices due to missing card_id`,
      );
    }

    // Batch insert (Supabase handles this efficiently)
    const { error: pricesError } = await supabase
      .from("card_prices")
      .insert(allCardPrices);

    if (pricesError) {
      throw new Error(`Failed to insert card prices: ${pricesError.message}`);
    }

    console.log(
      `${tag} Inserted ${allCardPrices.length} card prices (${exchangeCardPrices.length} exchange + ${stashCardPrices.length} stash)`,
    );

    console.log(
      `${tag} ✅ Snapshot complete: id=${snapshot.id}, cards=${
        allCardPrices.length
      }${skippedCount > 0 ? `, skipped=${skippedCount}` : ""}`,
    );

    return responseJson({
      status: 200,
      body: {
        success: true,
        snapshot: {
          id: snapshot.id,
          leagueId: league.id,
          fetchedAt: snapshot.fetched_at,
          exchangeChaosToDivine: snapshot.exchange_chaos_to_divine,
          stashChaosToDivine: snapshot.stash_chaos_to_divine,
          stackedDeckChaosCost: snapshot.stacked_deck_chaos_cost,
          stackedDeckMaxVolumeRate:
            snapshot.stacked_deck_max_volume_rate ?? null,
          cardCount: allCardPrices.length,
        },
      },
    });
  } catch (error: unknown) {
    console.error("Error in create-snapshot-internal:", error);
    const message = error instanceof Error ? error.message : String(error);
    return responseJson({ status: 500, body: { error: message } });
  }
});
