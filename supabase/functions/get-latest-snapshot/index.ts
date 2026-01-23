import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import type { CardPriceData } from "../_shared/types.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-app-install-id",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const game = url.searchParams.get("game");
    const leagueId = url.searchParams.get("league");

    if (!game || !leagueId) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters: game, league" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    if (!["poe1", "poe2"].includes(game)) {
      return new Response(
        JSON.stringify({ error: "Invalid game. Must be poe1 or poe2" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // 1. Find league
    const { data: league, error: leagueError } = await supabase
      .from("poe_leagues")
      .select("id")
      .eq("game", game)
      .eq("league_id", leagueId)
      .single();

    if (leagueError || !league) {
      return new Response(JSON.stringify({ error: "League not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Get latest snapshot
    const { data: snapshot, error: snapshotError } = await supabase
      .from("snapshots")
      .select("*")
      .eq("league_id", league.id)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .single();

    if (snapshotError || !snapshot) {
      return new Response(
        JSON.stringify({ error: "No snapshot found for this league" }),
        {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 3. Get all card prices for this snapshot
    const { data: cardPrices, error: pricesError } = await supabase
      .from("card_prices")
      .select("*")
      .eq("snapshot_id", snapshot.id);

    if (pricesError) {
      throw pricesError;
    }

    // 4. Format response
    const exchangePrices: Record<string, CardPriceData> = {};
    const stashPrices: Record<string, CardPriceData> = {};

    for (const price of cardPrices || []) {
      const priceData = {
        chaosValue: price.chaos_value,
        divineValue: price.divine_value,
        stackSize: price.stack_size,
      };

      if (price.price_source === "exchange") {
        exchangePrices[price.card_name] = priceData;
      } else {
        stashPrices[price.card_name] = priceData;
      }
    }

    const response = {
      snapshot: {
        id: snapshot.id,
        leagueId: league.id,
        fetchedAt: snapshot.fetched_at,
        exchangeChaosToDivine: snapshot.exchange_chaos_to_divine,
        stashChaosToDivine: snapshot.stash_chaos_to_divine,
      },
      cardPrices: {
        exchange: exchangePrices,
        stash: stashPrices,
      },
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in get-latest-snapshot:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
