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

    console.log(`Creating snapshot for ${game}/${leagueId}...`);

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
      console.error("League not found:", leagueId);
      return responseJson({ status: 404, body: { error: "League not found" } });
    }

    // 2. Check for recent snapshot (< 10 minutes) to prevent duplicates
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
        `Recent snapshot exists (${recentSnapshot.fetched_at}), skipping...`,
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
    console.log(`Fetching poe.ninja exchange data for ${league.name}...`);
    const exchangeUrl = `https://poe.ninja/poe1/api/economy/exchange/current/overview?league=${encodeURIComponent(
      league.name,
    )}&type=DivinationCard`;
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

    console.log(`Fetched ${exchangeCardPrices.length} exchange prices`);

    // 4. Fetch Stacked Deck price from poe.ninja Currency API
    let stackedDeckChaosCost = 0;
    let stackedDeckMaxVolumeRate: number | null = null;
    try {
      console.log(`Fetching stacked deck price for ${league.name}...`);
      const currencyUrl = `https://poe.ninja/poe1/api/economy/exchange/current/overview?league=${encodeURIComponent(
        league.name,
      )}&type=Currency`;
      const currencyResponse = await fetch(currencyUrl);

      if (!currencyResponse.ok) {
        console.warn(
          `poe.ninja currency API failed: ${currencyResponse.statusText}, defaulting stacked deck cost to 0`,
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
          `Stacked Deck cost: ${stackedDeckChaosCost} chaos, maxVolumeRate: ${
            stackedDeckMaxVolumeRate ?? "N/A"
          } decks/divine`,
        );
      }
    } catch (currencyError) {
      console.warn(
        "Failed to fetch stacked deck price, defaulting to 0:",
        currencyError,
      );
    }

    // 5. Fetch from poe.ninja stash API
    console.log(`Fetching poe.ninja stash data for ${league.name}...`);
    const stashUrl = `https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(
      league.name,
    )}&type=DivinationCard`;
    const stashResponse = await fetch(stashUrl);

    if (!stashResponse.ok) {
      throw new Error(
        `poe.ninja stash API failed: ${stashResponse.statusText}`,
      );
    }

    const stashData = await stashResponse.json();

    // Calculate stash ratio
    let stashChaosToDivineRatio = 100;
    for (const card of stashData.lines || []) {
      if (card.divineValue > 0 && card.chaosValue > 0) {
        stashChaosToDivineRatio = card.chaosValue / card.divineValue;
        break;
      }
    }

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
    const stashCardPrices: Array<any> = [];
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
      `Fetched ${stashCardPrices.length} stash prices. Confidence: ${confidenceCounts[1]} high, ${confidenceCounts[2]} medium, ${confidenceCounts[3]} low`,
    );

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

    console.log(`Created snapshot ${snapshot.id}`);

    // 7. Insert all card prices
    const allCardPrices = [
      ...exchangeCardPrices.map((p) => ({ ...p, snapshot_id: snapshot.id })),
      ...stashCardPrices.map((p) => ({ ...p, snapshot_id: snapshot.id })),
    ];

    // Batch insert (Supabase handles this efficiently)
    const { error: pricesError } = await supabase
      .from("card_prices")
      .insert(allCardPrices);

    if (pricesError) {
      throw new Error(`Failed to insert card prices: ${pricesError.message}`);
    }

    console.log(`Inserted ${allCardPrices.length} card prices`);

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
