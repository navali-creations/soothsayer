import "jsr:@supabase/functions-js/edge-runtime.d.ts";

import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { authorize, responseJson } from "../_shared/utils.ts";

type Body = { game?: "poe1" | "poe2"; league?: string };

serve(async (req: Request) => {
  const authResult = await authorize({
    req,
    endpoint: "get-latest-snapshot",
    windowMs: 4 * 60 * 60 * 1000, // 4h
    maxHits: 10,
  });

  if (authResult instanceof Response) return authResult;

  const token = authResult;

  const body = (await req.json().catch(() => ({}))) as Body;
  const game = body.game;
  const leagueId = body.league;

  if (!game || !leagueId)
    return responseJson({
      status: 400,
      body: { error: "Missing required parameters: game, league" },
    });
  if (!["poe1", "poe2"].includes(game))
    return responseJson({
      status: 400,
      body: { error: "Invalid game. Must be poe1 or poe2" },
    });
  if (leagueId.length > 80)
    return responseJson({ status: 400, body: { error: "Invalid league" } });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );

  const { data: league, error: leagueError } = await supabase
    .from("poe_leagues")
    .select("id")
    .eq("game", game)
    .eq("league_id", leagueId)
    .single();

  if (leagueError || !league)
    return responseJson({ status: 404, body: { error: "League not found" } });

  const { data: snapshot, error: snapshotError } = await supabase
    .from("snapshots")
    .select(
      "id, league_id, fetched_at, exchange_chaos_to_divine, stash_chaos_to_divine, stacked_deck_chaos_cost",
    )
    .eq("league_id", league.id)
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  if (snapshotError || !snapshot)
    return responseJson({
      status: 404,
      body: { error: "No snapshot found for this league" },
    });

  const { data: cardPrices, error: pricesError } = await supabase
    .from("card_prices")
    .select("card_name, price_source, chaos_value, divine_value, stack_size")
    .eq("snapshot_id", snapshot.id);

  if (pricesError)
    return responseJson({ status: 500, body: { error: pricesError.message } });

  const exchangePrices: Record<string, any> = {};
  const stashPrices: Record<string, any> = {};

  for (const price of cardPrices ?? []) {
    const priceData = {
      chaosValue: price.chaos_value,
      divineValue: price.divine_value,
      stackSize: price.stack_size ?? undefined,
    };
    if (price.price_source === "exchange")
      exchangePrices[price.card_name] = priceData;
    else stashPrices[price.card_name] = priceData;
  }

  return responseJson({
    status: 200,
    body: {
      snapshot: {
        id: snapshot.id,
        leagueId: snapshot.league_id,
        fetchedAt: snapshot.fetched_at,
        exchangeChaosToDivine: snapshot.exchange_chaos_to_divine,
        stashChaosToDivine: snapshot.stash_chaos_to_divine,
        stackedDeckChaosCost: snapshot.stacked_deck_chaos_cost ?? 0,
      },
      cardPrices: { exchange: exchangePrices, stash: stashPrices },
    },
    headers: { "Cache-Control": "private, max-age=14400" }, // 4 hours cache
  });
});
