import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

serve(async (req) => {
  try {
    // Only allow POST requests
    if (req.method !== "POST") {
      return new Response("Method not allowed", { status: 405 });
    }

    // Verify service role (this function should only be called internally)
    const authHeader = req.headers.get("Authorization");
    if (
      !authHeader?.includes(Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "")
    ) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { game, leagueId } = await req.json();

    if (!game || !leagueId) {
      return new Response(
        JSON.stringify({
          error: "Missing required parameters: game, leagueId",
        }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
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
      return new Response(JSON.stringify({ error: "League not found" }), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
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
      return new Response(
        JSON.stringify({
          message: "Recent snapshot exists",
          snapshot: recentSnapshot,
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    // 3. Fetch from poe.ninja exchange API
    console.log(`Fetching poe.ninja exchange data for ${league.name}...`);
    const exchangeUrl = `https://poe.ninja/poe1/api/economy/exchange/current/overview?league=${encodeURIComponent(league.name)}&type=DivinationCard`;
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

    // Build exchange card prices
    const exchangeCardPrices: Array<any> = [];
    exchangeData.items?.forEach((item: any, index: number) => {
      const line = exchangeData.lines[index];
      if (line && item.category === "Cards") {
        exchangeCardPrices.push({
          card_name: item.name,
          price_source: "exchange",
          chaos_value: line.primaryValue,
          divine_value: line.primaryValue / chaosToDivineRatio,
          stack_size: null,
        });
      }
    });

    console.log(`Fetched ${exchangeCardPrices.length} exchange prices`);

    // 4. Fetch from poe.ninja stash API
    console.log(`Fetching poe.ninja stash data for ${league.name}...`);
    const stashUrl = `https://poe.ninja/api/data/itemoverview?league=${encodeURIComponent(league.name)}&type=DivinationCard`;
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

    // Build stash card prices
    const stashCardPrices: Array<any> = [];
    stashData.lines?.forEach((card: any) => {
      stashCardPrices.push({
        card_name: card.name,
        price_source: "stash",
        chaos_value: card.chaosValue,
        divine_value: card.divineValue,
        stack_size: card.stackSize,
      });
    });

    console.log(`Fetched ${stashCardPrices.length} stash prices`);

    // 5. Insert snapshot and card prices in transaction
    const { data: snapshot, error: snapshotError } = await supabase
      .from("snapshots")
      .insert({
        league_id: league.id,
        fetched_at: new Date().toISOString(),
        exchange_chaos_to_divine: chaosToDivineRatio,
        stash_chaos_to_divine: stashChaosToDivineRatio,
      })
      .select()
      .single();

    if (snapshotError || !snapshot) {
      throw new Error(`Failed to create snapshot: ${snapshotError?.message}`);
    }

    console.log(`Created snapshot ${snapshot.id}`);

    // 6. Insert all card prices
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

    return new Response(
      JSON.stringify({
        success: true,
        snapshot: {
          id: snapshot.id,
          leagueId: league.id,
          fetchedAt: snapshot.fetched_at,
          exchangeChaosToDivine: snapshot.exchange_chaos_to_divine,
          stashChaosToDivine: snapshot.stash_chaos_to_divine,
          cardCount: allCardPrices.length,
        },
      }),
      { headers: { "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("Error in create-snapshot-internal:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
